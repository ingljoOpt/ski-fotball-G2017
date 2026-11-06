import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { sessionVersions, trainingEvents, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, createClub, createGroup, DomainError, inviteCoach, removeMember } from "../../src/lib/domain.ts";
import { changeTrainingStatus, createTrainingEvent, saveAnnualEvent, saveAnnualPlan, savePlanPeriod, saveSessionPlan, trainingEventDetails } from "../../src/lib/planning-domain.ts";
import { sessionAIContext } from "../../src/lib/session-ai-context.ts";
import { prepareAIProposal } from "../../src/lib/session-ai.ts";
import { aiEvent, aiProposal } from "./session-ai-fixtures.ts";
import { completePlan } from "./planning-fixtures.ts";

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
    await saveAnnualPlan(db, head.id, group.id, { year: 2026, objectives: "Bli spillbar" }, 0);
    await saveAnnualPlan(db, head.id, group.id, { year: 2027, objectives: "Neste års retning" }, 0);
    await savePlanPeriod(db, head.id, group.id, 2026, {
      startDate: "2026-11-01", endDate: "2026-11-30", theme: "Pasning", objectives: "Se opp", progression: "Fra par til spill", sourceUrl: "",
    }, 1);
    await saveAnnualEvent(db, head.id, group.id, { title: "Cupdag", kind: "cup", startDate: aiEvent.date, endDate: aiEvent.date, description: "Kortere belastning" });
    for (let day = 1; day <= 7; day++) {
      const input = { ...aiEvent, date: `2026-11-0${day}`, startTime: "17:00", endTime: "18:00", title: `Tidligere plan ${day}` };
      const id = await createTrainingEvent(db, head.id, group.id, input);
      await saveSessionPlan(db, head.id, group.id, id, input, completePlan(), 1, "draft");
    }
    const excludedId = await createTrainingEvent(db, head.id, group.id, { ...aiEvent, date: "2026-10-31", title: "Avlyst plan" });
    await changeTrainingStatus(db, head.id, group.id, excludedId, 1, "cancelled");
    const otherId = await createTrainingEvent(db, outsider.id, otherTeam.id, { ...aiEvent, date: "2026-11-05", title: "OTHER TENANT" });
    const id = await createTrainingEvent(db, coach.id, group.id, aiEvent);
    const draft = { event: { ...aiEvent }, plan: completePlan() };
    const before = (await db.select().from(sessionVersions)).length;
    const context = await sessionAIContext(db, coach.id, group.id, id, 1, draft);
    assert.equal(context.history.length, 5);
    assert.deepEqual(context.history.map((item) => item.date), ["2026-11-06", "2026-11-05", "2026-11-04", "2026-11-03", "2026-11-02"]);
    assert.equal(context.age.age, 9);
    assert.equal(context.periods[0].theme, "Pasning");
    assert.equal(context.events[0].title, "Cupdag");
    assert.equal(context.annualObjectives, "Bli spillbar");
    const serialized = JSON.stringify(context);
    assert.doesNotMatch(serialized, /OTHER TENANT|@example.invalid|createdBy|userId|clubId|groupId|logoData/);
    assert.match(context.limitations, /ikke dokumentasjon på gjennomføring/);
    const future = await sessionAIContext(db, admin.id, group.id, id, 1, {
      ...draft, event: { ...draft.event, date: "2027-01-02", theme: "Manuelt endret tema" },
    });
    assert.equal(future.annualObjectives, "Neste års retning");
    assert.equal(future.age.age, 10);
    assert.equal(future.draft.event.theme, "Manuelt endret tema");
    assert.equal((await db.select().from(sessionVersions)).length, before);
    assert.equal((await db.select().from(trainingEvents).where(eq(trainingEvents.id, id)))[0].theme, aiEvent.theme);
    await assert.rejects(sessionAIContext(db, outsider.id, group.id, id, 1, draft), DomainError);
    await assert.rejects(sessionAIContext(db, coach.id, group.id, otherId, 1, draft), DomainError);
    await assert.rejects(sessionAIContext(db, coach.id, group.id, id, 99, draft), /endret/);
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
    await changeTrainingStatus(db, head.id, group.id, id, 2, "cancelled");
    await assert.rejects(sessionAIContext(db, head.id, group.id, id, 3, draft), /Gjenåpne/);
    await removeMember(db, head.id, group.id, coach.id);
    await assert.rejects(sessionAIContext(db, coach.id, group.id, id, 3, draft), DomainError);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});
