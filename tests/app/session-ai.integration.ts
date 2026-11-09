import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { sessionVersions, trainingEvents, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, createClub, createGroup, DomainError, inviteCoach, removeMember, updateGroupSettings } from "../../src/lib/domain.ts";
import { annualPlanning, setTrainingCancellation, createTrainingEvent, saveAnnualEvent, saveAnnualPlan, savePlanPeriod, saveSessionPlan, saveSessionFocus, trainingEventDetails } from "../../src/lib/planning-domain.ts";
import { objectivesForSkill, skillProgression } from "../../src/lib/planning.ts";
import { scheduledSessionAIContext, sessionAIContext as buildSessionAIContext } from "../../src/lib/session-ai-context.ts";
import { prepareAIProposal } from "../../src/lib/session-ai.ts";
import { aiEvent, aiProposal } from "./session-ai-fixtures.ts";
import { defaultPlanningPriorities } from "../../src/lib/planning-priorities.ts";
import { completePlan } from "./planning-fixtures.ts";
import { archiveClubDocument, getClubDocument, listClubDocuments, saveClubMarkdown, uploadClubDocuments } from "../../src/lib/club-documents.ts";

const requestedAges: (number | null)[] = [];
const sessionAIContext: typeof buildSessionAIContext = (db, userId, groupId, eventId, revision, draft) =>
  buildSessionAIContext(db, userId, groupId, eventId, revision, draft, async (age) => {
    requestedAges.push(age);
    return { topics: [], fetchedAt: "2026-11-08T12:00:00Z", warnings: ["Fiktiv NFF-kilde"] };
  });

test("AI context scopes and bounds historical plans, follows unsaved date and never saves automatically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "session-ai-"));
  await migrateLocalDatabase(directory);
  const connection = await connectLocalDatabase(directory);
  try {
    const { db } = connection;
    const [admin, head, coach, outsider] = await db.insert(users).values(
      ["ai-admin", "ai-head", "ai-coach", "ai-outsider"].map((name) => ({ email: `${name}@example.invalid` })),
    ).returning();
    const club = await createClub(db, admin.id, "AI test club");
    const otherClub = await createClub(db, outsider.id, "Other AI club");
    const { group, token } = await createGroup(db, admin.id, club.id, "G2017", head.email, 2017);
    const { group: otherTeam } = await createGroup(db, outsider.id, otherClub.id, "G2017", outsider.email);
    await acceptInvitation(db, head.id, token);
    const invite = await inviteCoach(db, head.id, group.id, coach.email);
    await acceptInvitation(db, coach.id, invite.token);
    const priorities = [...defaultPlanningPriorities].reverse();
    await assert.rejects(updateGroupSettings(db, coach.id, group.id, { generationDaysBefore: 3, aiPriorities: priorities }), DomainError);
    await assert.rejects(updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 3, aiPriorities: ["coach_input"] }));
    await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 3, aiPriorities: priorities });
    await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2 });
    await saveAnnualPlan(db, head.id, group.id, { year: 2026, objectives: "Bli spillbar" }, 0);
    await saveAnnualPlan(db, head.id, group.id, { year: 2027, objectives: "Neste års retning" }, 0);
    await savePlanPeriod(db, head.id, group.id, 2026, {
      startDate: "2026-11-01", endDate: "2026-11-30", theme: "Pasning", objectives: "Se opp", progression: "Fra par til spill",
      sourceUrl: "https://tiim.no/artikkel/fagplan-8-9-ar-femmerfotball",
    }, 1);
    await saveAnnualEvent(db, head.id, group.id, { title: "Cupdag", kind: "cup", startDate: aiEvent.date, endDate: aiEvent.date, description: "Kortere belastning" });
    for (let day = 1; day <= 7; day++) {
      const input = { ...aiEvent, date: `2026-11-0${day}`, startTime: "17:00", endTime: "18:00", title: `Tidligere plan ${day}` };
      const id = await createTrainingEvent(db, head.id, group.id, input);
      await saveSessionPlan(db, head.id, group.id, id, input, completePlan(), 1, "draft");
    }
    const excludedId = await createTrainingEvent(db, head.id, group.id, { ...aiEvent, date: "2026-10-31", title: "Avlyst plan" });
    await setTrainingCancellation(db, head.id, group.id, excludedId, 1, true);
    const otherId = await createTrainingEvent(db, outsider.id, otherTeam.id, { ...aiEvent, date: "2026-11-05", title: "OTHER TENANT" });
    const id = await createTrainingEvent(db, coach.id, group.id, aiEvent, null, false, "Behold kjent smålagsspill og juster banestørrelsen.");
    const draft = { event: { ...aiEvent }, plan: completePlan() };
    const before = (await db.select().from(sessionVersions)).length;
    const context = await sessionAIContext(db, coach.id, group.id, id, 1, draft);
    assert.equal(context.history.length, 5);
    assert.deepEqual(context.history.map((item) => item.date), ["2026-11-06", "2026-11-05", "2026-11-04", "2026-11-03", "2026-11-02"]);
    assert.equal(context.age.age, 9);
    assert.equal(context.periods[0].theme, "Pasning");
    assert.equal(context.periods[0].sourceUrl, "https://tiim.no/artikkel/fagplan-8-9-ar-femmerfotball");
    assert.equal(context.periods[0].progression, "Fra par til spill");
    assert.equal(context.events[0].title, "Cupdag");
    assert.equal(context.annualObjectives, "Bli spillbar");
    assert.deepEqual(context.priorities, priorities);
    assert.deepEqual(context.prioritySources.map((source) => source.id), priorities);
    assert.equal(context.coachInput, "Behold kjent smålagsspill og juster banestørrelsen.");
    assert.equal(context.prioritySources.find((source) => source.id === "club_guidelines")?.status, "unavailable");
    assert.equal(context.prioritySources.find((source) => source.id === "previous_evaluations")?.status, "partial");
    assert.equal(context.previousPlan?.date, "2026-11-06");
    assert.equal(context.curriculum.fetchedAt, "2026-11-08T12:00:00Z");
    assert.deepEqual(context.curriculum.warnings, ["Fiktiv NFF-kilde"]);
    const scheduled = await scheduledSessionAIContext(db, coach.id, group.id, draft, async () => ({ topics: [], fetchedAt: "", warnings: [] }));
    assert.deepEqual(scheduled.history.map((item) => item.date), context.history.map((item) => item.date));
    assert.equal((await db.select().from(sessionVersions)).length, before);
    await assert.rejects(scheduledSessionAIContext(db, outsider.id, group.id, draft), DomainError);
    const serialized = JSON.stringify(context);
    assert.doesNotMatch(serialized, /OTHER TENANT|@example.invalid|createdBy|userId|clubId|groupId|logoData/);
    assert.match(context.limitations, /ikke dokumentasjon på gjennomføring/);
    await assert.rejects(uploadClubDocuments(db, coach.id, club.id, [new File(["Nei"], "plan.md")]), DomainError);
    await uploadClubDocuments(db, admin.id, club.id, [new File(["# Klubbplan\nSpillglede"], "plan.md"), new File(["Retningslinjer"], "veiledning.md")]);
    await uploadClubDocuments(db, outsider.id, otherClub.id, [new File(["HEMMELIG ANNEN KLUBB"], "andre.md")]);
    const docs = await listClubDocuments(db, coach.id, club.id);
    assert.equal(docs.length, 2);
    assert.equal((await getClubDocument(db, coach.id, club.id, docs[0].id)).name, "plan.md");
    await assert.rejects(getClubDocument(db, outsider.id, club.id, docs[0].id), DomainError);
    await assert.rejects(archiveClubDocument(db, coach.id, club.id, docs[0].id), DomainError);
    const withDocuments = await sessionAIContext(db, coach.id, group.id, id, 1, draft);
    assert.equal(withDocuments.prioritySources.find((source) => source.id === "club_guidelines")?.status, "available");
    assert.match(JSON.stringify(withDocuments.clubGuidelines), /Spillglede/);
    assert.doesNotMatch(JSON.stringify(withDocuments), /HEMMELIG ANNEN KLUBB/);
    await saveClubMarkdown(db, admin.id, club.id, docs[0].id, docs[0].name, "# Revidert sportsplan");
    const revised = (await listClubDocuments(db, coach.id, club.id)).find((item) => item.name === "plan.md")!;
    const updatedContext = await sessionAIContext(db, coach.id, group.id, id, 1, draft);
    assert.match(JSON.stringify(updatedContext.clubGuidelines), /Revidert sportsplan/);
    assert.doesNotMatch(JSON.stringify(updatedContext.clubGuidelines), /Spillglede/);
    await archiveClubDocument(db, admin.id, club.id, revised.id);
    await assert.rejects(getClubDocument(db, coach.id, club.id, docs[0].id), DomainError);
    assert.deepEqual((await listClubDocuments(db, coach.id, club.id)).map((item) => item.name), ["veiledning.md"]);
    const afterArchive = await sessionAIContext(db, coach.id, group.id, id, 1, draft);
    assert.deepEqual(afterArchive.clubGuidelines, [{ name: "veiledning.md", text: "Retningslinjer" }]);
    requestedAges.splice(-3);
    const future = await sessionAIContext(db, admin.id, group.id, id, 1, {
      ...draft, event: { ...draft.event, date: "2027-01-02", theme: "Manuelt endret tema" },
    });
    assert.equal(future.annualObjectives, "Neste års retning");
    assert.equal(future.age.age, 10);
    assert.equal(future.draft.event.theme, "Manuelt endret tema");
    assert.deepEqual(requestedAges, [9, 10]);
    assert.equal((await db.select().from(sessionVersions)).length, before);
    assert.equal((await db.select().from(trainingEvents).where(eq(trainingEvents.id, id)))[0].theme, aiEvent.theme);
    await assert.rejects(sessionAIContext(db, outsider.id, group.id, id, 1, draft), DomainError);
    await assert.rejects(sessionAIContext(db, coach.id, group.id, otherId, 1, draft), DomainError);
    await assert.rejects(sessionAIContext(db, coach.id, group.id, id, 99, draft), /endret/);
    assert.deepEqual(requestedAges, [9, 10], "unauthorized or stale requests never crawl");
    const proposal = prepareAIProposal(aiProposal(), draft, context.sources);
    assert.equal((await db.select().from(sessionVersions)).length, before, "suggestion does not save");
    await saveSessionPlan(db, coach.id, group.id, id, proposal.draft.event, proposal.draft.plan, 1, "draft", "ai");
    const saved = await trainingEventDetails(db, coach.id, group.id, id);
    assert.equal(saved.event.status, "draft");
    assert.equal(saved.versions.length, 2);
    assert.equal(saved.versions[0].origin, "ai");
    assert.equal(saved.versions[0].createdBy, coach.id);
    assert.equal(saved.versions[1].origin, "manual");
    assert.equal(saved.versions[1].plan.exercises.length, 0);
    await assert.rejects(saveSessionPlan(db, coach.id, group.id, id, proposal.draft.event, proposal.draft.plan, 1, "draft", "ai"), /endret/);
    await setTrainingCancellation(db, head.id, group.id, id, 2, true);
    await assert.rejects(sessionAIContext(db, head.id, group.id, id, 3, draft), /Angre avlysningen/);
    await removeMember(db, head.id, group.id, coach.id);
    await assert.rejects(sessionAIContext(db, coach.id, group.id, id, 3, draft), DomainError);
    const annual = await annualPlanning(db, head.id, group.id, 2026);
    const mainTheme = "Spille seg framover i banen";
    const progression = skillProgression([{ title: "Pasning", sessions: 3 }, { title: "Medtak", sessions: 2 }], "Fra par til spill");
    await savePlanPeriod(db, head.id, group.id, 2026, { ...annual.periods[0], theme: mainTheme, progression }, annual.plan!.revision, annual.periods[0].id);
    const objectives = objectivesForSkill("Se opp", { title: "Pasning", moments: ["Finn medspiller"] });
    for (const date of ["2026-11-10", "2026-11-11", "2026-11-12"]) {
      const input = { ...aiEvent, date, theme: mainTheme, objectives };
      const previousId = await createTrainingEvent(db, head.id, group.id, input);
      await saveSessionPlan(db, head.id, group.id, previousId, input, completePlan(), 1, "draft");
    }
    const event = { ...aiEvent, date: "2026-11-13", theme: mainTheme, objectives };
    const nextId = await createTrainingEvent(db, head.id, group.id, event);
    const continuity = await sessionAIContext(db, head.id, group.id, nextId, 1, { event, plan: completePlan() });
    assert.equal(continuity.draft.event.theme, mainTheme);
    assert.match(continuity.draft.event.objectives, /Delferdighet: Pasning/);
    assert.equal(continuity.periods[0].progression, progression);
    assert.ok(continuity.history.slice(0, 3).every((item) => item.theme === mainTheme && item.objectives === objectives));
    assert.deepEqual(continuity.history[0].exercises.map((item) => item.id), completePlan().exercises.map((item) => item.id));
    const original = await trainingEventDetails(db, head.id, group.id, nextId);
    const focus = { theme: mainTheme, objectives: objectivesForSkill("Se opp", { title: "Medtak", moments: ["Første touch mot ledig rom"] }) };
    await assert.rejects(saveSessionFocus(db, outsider.id, group.id, nextId, 1, focus), DomainError);
    await saveSessionFocus(db, head.id, group.id, nextId, 1, focus);
    const locked = await trainingEventDetails(db, head.id, group.id, nextId);
    assert.equal(locked.event.objectives, focus.objectives);
    assert.equal(locked.versions.length, original.versions.length + 1);
    assert.deepEqual(locked.versions[0].plan, original.versions[0].plan);
    assert.equal(locked.versions[1].eventSnapshot.objectives, objectives);
    const { group: cohortTeam } = await createGroup(db, admin.id, club.id, "Annet lag samme årskull", admin.email, 2017);
    const oldInput = { ...aiEvent, date: "2025-11-04", title: "Autorisert årskullshistorikk" };
    const oldId = await createTrainingEvent(db, admin.id, cohortTeam.id, oldInput);
    await saveSessionPlan(db, admin.id, cohortTeam.id, oldId, oldInput, completePlan(), 1, "draft");
    const headContext = await sessionAIContext(db, head.id, group.id, nextId, 2, { event, plan: completePlan() });
    assert.equal(headContext.clubCohortHistory.length, 0, "head coach cannot read unrelated teams without membership");
    const adminContext = await sessionAIContext(db, admin.id, group.id, nextId, 2, { event, plan: completePlan() });
    assert.equal(adminContext.clubCohortHistory[0]?.title, "Autorisert årskullshistorikk");
    assert.doesNotMatch(JSON.stringify(adminContext), /@example.invalid|userId|clubId|groupId/);
    await assert.rejects(saveSessionFocus(db, head.id, group.id, nextId, 1, focus), /endret/);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});
