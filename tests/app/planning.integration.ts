import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { annualPlans, planPeriods, sessionVersions, trainingEvents, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import {
  acceptInvitation, addTrainingTime, createClub, createGroup, DomainError, groupDetails, inviteCoach, removeMember, updateGroupSettings,
} from "../../src/lib/domain.ts";
import {
  annualPlanHistory, annualPlanning, createTrainingEvent, groupCalendar, groupSessions, removePlanPeriod, unlockPlanMonth,
  deleteSessionPlan, saveAnnualPlan, savePlanPeriod, saveSessionPlan, sessionHistory, setTrainingCancellation, trainingEventDetails,
} from "../../src/lib/planning-domain.ts";
import { emptySessionPlan, slotKey } from "../../src/lib/planning.ts";
import { completePlan } from "./planning-fixtures.ts";

test("calendar, annual themes and immutable session plans", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "klubbokter-planning-"));
  await migrateLocalDatabase(directory);
  await migrateLocalDatabase(directory);
  let connection = await connectLocalDatabase(directory);
  const { db } = connection;
  try {
    const [admin, head, coach, outsider] = await db.insert(users).values(
      ["admin", "head", "coach", "outsider"].map((role) => ({ email: `${role}@example.invalid` })),
    ).returning();
    const club = await createClub(db, admin.id, "Planning club");
    const otherClub = await createClub(db, outsider.id, "Other club");
    const { group, token } = await createGroup(db, admin.id, club.id, "G2017", head.email, 2017);
    const { group: otherGroup } = await createGroup(db, outsider.id, otherClub.id, "G2017", outsider.email);
    await acceptInvitation(db, head.id, token);
    const invitation = await inviteCoach(db, head.id, group.id, coach.email);
    await acceptInvitation(db, coach.id, invitation.token);
    await addTrainingTime(db, head.id, group.id, { weekday: 3, startTime: "18:00", endTime: "19:00" });
    await addTrainingTime(db, head.id, group.id, { weekday: 3, startTime: "19:30", endTime: "21:00" });
    const periodInput = { startDate: "2026-11-01", endDate: "2026-11-30", theme: "Pasning", objectives: "Se før pasning", progression: "Fra par til spill", sourceUrl: "" };
    const eventInput = { date: "2026-11-04", startTime: "18:00", endTime: "19:00", durationMinutes: 60, title: "Planøkt", theme: "Pasning", objectives: "Se før pasning" };
    let eventId: string;

    await t.test("team settings own the cohort, enforce roles and do not infer it from names", async () => {
      assert.equal(otherGroup.birthYear, null, "name G2017 does not imply cohort");
      await assert.rejects(updateGroupSettings(db, coach.id, group.id, { generationDaysBefore: 3, birthYear: 2018 }), DomainError);
      await assert.rejects(updateGroupSettings(db, outsider.id, group.id, { generationDaysBefore: 3, birthYear: 2018 }), DomainError);
      await assert.rejects(updateGroupSettings(db, admin.id, group.id, { generationDaysBefore: 3, birthYear: 2017.5 }));
      await updateGroupSettings(db, admin.id, group.id, { generationDaysBefore: 3, birthYear: "" });
      assert.equal((await groupDetails(db, head.id, group.id)).group.birthYear, null);
      await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 3, birthYear: "2017" });
      await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2 });
      assert.equal((await groupDetails(db, coach.id, group.id)).group.birthYear, 2017);
      await db.insert(annualPlans).values([
        { clubId: otherClub.id, groupId: otherGroup.id, year: 2026, legacyBirthYear: 2017 },
        { clubId: otherClub.id, groupId: otherGroup.id, year: 2027, legacyBirthYear: 2018 },
      ]);
      assert.deepEqual((await groupDetails(db, outsider.id, otherGroup.id)).conflictingBirthYears.sort(), [2017, 2018]);
      await updateGroupSettings(db, outsider.id, otherGroup.id, { generationDaysBefore: 3, birthYear: 2017 });
      assert.deepEqual((await groupDetails(db, outsider.id, otherGroup.id)).conflictingBirthYears, []);
      await updateGroupSettings(db, outsider.id, otherGroup.id, { generationDaysBefore: 3, birthYear: null });
    });

    await t.test("all coaches can plan, while outsiders and other clubs are denied", async () => {
      await assert.rejects(annualPlanning(db, outsider.id, group.id, 2026), DomainError);
      await assert.rejects(annualPlanHistory(db, outsider.id, group.id, 2026), DomainError);
      await assert.rejects(saveAnnualPlan(db, outsider.id, group.id, { year: 2026, birthYear: 2017, objectives: "" }, 0), DomainError);
      await saveAnnualPlan(db, coach.id, group.id, { year: 2026, birthYear: 2018, objectives: "Utvikle samspill" }, 0);
      const annual = await annualPlanning(db, head.id, group.id, 2026);
      assert.equal(Object.hasOwn(annual, "history"), false, "AI and calendar planning data excludes actor history");
      const annualHistory = await annualPlanHistory(db, head.id, group.id, 2026);
      assert.equal(annual.group.birthYear, 2017, "annual input cannot change the team's cohort");
      assert.equal(annual.plan?.legacyBirthYear, null, "annual input no longer stores a cohort");
      assert.equal(annual.periods.length, 0, "NFF themes are not generated or seeded");
      assert.equal(annualHistory.length, 1);
      assert.equal(annualHistory[0].entityType, "annual_plan");
      assert.equal(annualHistory[0].actorType, "user");
      assert.equal(annualHistory[0].actorEmail, coach.email);
      assert.equal(annualHistory[0].afterSnapshot?.objectives, "Utvikle samspill");
      await assert.rejects(savePlanPeriod(db, outsider.id, group.id, 2026, periodInput, 1), DomainError);
      await savePlanPeriod(db, head.id, group.id, 2026, periodInput, 1);
      const periodHistory = await annualPlanHistory(db, head.id, group.id, 2026);
      const createdPeriod = periodHistory.find((entry) => entry.entityType === "plan_period");
      assert.equal(createdPeriod?.action, "created");
      assert.equal(createdPeriod?.afterSnapshot?.theme, "Pasning");
      assert.equal(createdPeriod?.actorEmail, head.email);
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2026, periodInput, 1), /endret av en annen/);
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2026, periodInput, 2), /overlappe/);
      assert.equal((await annualPlanHistory(db, head.id, group.id, 2026)).length, 2, "rejected writes do not create audit rows");
      await assert.rejects(saveAnnualPlan(db, head.id, group.id, { year: 2026, birthYear: 2017, objectives: "" }, 0), /endret av en annen/);
      assert.equal((await annualPlanning(db, outsider.id, otherGroup.id, 2026)).periods.length, 0);
    });

    await t.test("confirming a first period creates the annual plan atomically and preserves revision protection", async () => {
      const input = { ...periodInput, startDate: "2028-01-01", endDate: "2028-03-31" };
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2028, input, 0), /Lagre årsplanen/);
      await assert.rejects(savePlanPeriod(db, outsider.id, group.id, 2028, input, 0, undefined, true), DomainError);
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2028, input, 9, undefined, true), /endret/);
      assert.equal((await annualPlanning(db, head.id, group.id, 2028)).plan, null);
      await savePlanPeriod(db, coach.id, group.id, 2028, input, 0, undefined, true);
      const annual = await annualPlanning(db, head.id, group.id, 2028);
      assert.equal(annual.plan?.objectives, "");
      assert.equal(annual.periods.length, 1);
      assert.equal((await annualPlanHistory(db, head.id, group.id, 2028)).length, 2);
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2028, input, 0, undefined, true), /endret/);
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2028, input, annual.plan!.revision, undefined, true), /overlappe/);
      assert.equal((await annualPlanning(db, head.id, group.id, 2028)).periods.length, 1);
    });

    await t.test("unlocking one month preserves the other months, audit history and session versions", async () => {
      const annual = await annualPlanning(db, head.id, group.id, 2028);
      const period = annual.periods[0];
      await assert.rejects(unlockPlanMonth(db, outsider.id, group.id, period.id, 2, annual.plan!.revision), DomainError);
      await assert.rejects(unlockPlanMonth(db, head.id, group.id, period.id, 2, 0), /endret/);
      await assert.rejects(unlockPlanMonth(db, head.id, group.id, period.id, 13, annual.plan!.revision));
      const versionCount = (await db.select().from(sessionVersions)).length;
      await unlockPlanMonth(db, head.id, group.id, period.id, 2, annual.plan!.revision);
      const unlocked = await annualPlanning(db, head.id, group.id, 2028);
      assert.deepEqual(unlocked.periods.map(({ startDate, endDate }) => ({ startDate, endDate })).sort((first, second) => first.startDate.localeCompare(second.startDate)),
        [{ startDate: "2028-01-01", endDate: "2028-01-31" }, { startDate: "2028-03-01", endDate: "2028-03-31" }]);
      assert.ok(unlocked.periods.every((item) => item.theme === period.theme && item.objectives === period.objectives));
      assert.equal((await db.select().from(sessionVersions)).length, versionCount);
      assert.ok((await annualPlanHistory(db, head.id, group.id, 2028)).some((item) => item.beforeSnapshot?.endDate === "2028-03-31"));
      const january = unlocked.periods.find((item) => item.startDate === "2028-01-01")!;
      await unlockPlanMonth(db, head.id, group.id, january.id, 1, unlocked.plan!.revision);
      assert.equal((await annualPlanning(db, head.id, group.id, 2028)).periods.length, 1);
    });

    await t.test("recurring calendar is virtual, includes both same-day slots and year themes", async () => {
      const calendar = await groupCalendar(db, coach.id, group.id, 2026);
      assert.equal(calendar.entries.length, 104);
      assert.equal(calendar.entries.filter((event) => event.date === "2026-11-04").length, 2);
      assert.equal(calendar.entries.find((event) => event.date === "2026-11-04")?.theme, "Pasning");
      assert.equal(calendar.entries.find((event) => event.date === "2026-01-07")?.theme, "");
      assert.equal(calendar.entries.find((event) => event.startTime === "18:00")?.durationMinutes, 60);
      assert.equal(calendar.entries.find((event) => event.startTime === "19:30")?.durationMinutes, 90);
      assert.equal(calendar.entries.find((event) => event.startTime === "19:30")?.endTime, "21:00");
      assert.equal((await db.select().from(trainingEvents)).length, 0);
      await assert.rejects(groupCalendar(db, coach.id, otherGroup.id, 2026), DomainError);
    });

    await t.test("creating repeated drafts is idempotent and snapshots annual context", async () => {
      const results = await Promise.all([
        createTrainingEvent(db, coach.id, group.id, eventInput, slotKey(eventInput.date, eventInput.startTime)),
        createTrainingEvent(db, head.id, group.id, eventInput, slotKey(eventInput.date, eventInput.startTime)),
      ]);
      assert.equal(results[0], results[1]);
      eventId = results[0];
      const details = await trainingEventDetails(db, coach.id, group.id, eventId);
      const history = await sessionHistory(db, coach.id, group.id, eventId);
      assert.equal(details.versions.length, 1);
      assert.equal(history.length, 1);
      assert.equal(history[0].action, "created");
      assert.equal(history[0].actorType, "user");
      assert.equal(history[0].actorEmail, coach.email);
      assert.equal(history[0].afterSnapshot?.event && (history[0].afterSnapshot.event as { title: string }).title, eventInput.title);
      assert.equal(details.versions[0].origin, "manual");
      assert.equal(details.versions[0].planningContext.curriculum.provider, "nff");
      assert.equal(details.versions[0].planningContext.curriculum.suggestions, "pending_ai");
      assert.equal(details.versions[0].planningContext.birthYear, 2017);
      assert.equal(details.versions[0].planningContext.periods[0].theme, "Pasning");
      assert.equal(details.versions[0].plan.availableBalls, null);
      assert.equal((await groupCalendar(db, coach.id, group.id, 2026)).entries.length, 104);
      await assert.rejects(createTrainingEvent(db, coach.id, group.id, eventInput), /allerede/);
      await assert.rejects(createTrainingEvent(db, coach.id, group.id, { ...eventInput, date: "2026-11-05" }, "2026-11-04T18:00"), DomainError);
      await assert.rejects(createTrainingEvent(db, coach.id, group.id, { ...eventInput, date: "2026-11-05" }, "2026-11-05T18:00"), DomainError);
    });

    await t.test("sessions overview distinguishes saved history, upcoming drafts and virtual placeholders across years", async () => {
      const before = await groupSessions(db, coach.id, group.id, new Date("2026-11-04T16:30:00Z"));
      assert.equal(before.upcoming?.id, eventId, "existing upcoming draft replaces its virtual slot");
      assert.equal(before.upcoming?.virtual, false);
      assert.equal(before.recent.length, 0, "virtual historical training times are not claimed as saved sessions");
      const after = await groupSessions(db, coach.id, group.id, new Date("2026-11-04T18:01:00Z"));
      assert.equal(after.recent[0].id, eventId);
      assert.equal(after.upcoming?.startTime, "19:30", "next same-day training is preserved");
      assert.equal(after.upcoming?.virtual, true);
      const nextYear = await groupSessions(db, coach.id, group.id, new Date("2026-12-31T20:00:00Z"));
      assert.equal(nextYear.upcoming?.date, "2027-01-06");
      assert.equal(nextYear.recent[0].id, eventId);
      await assert.rejects(groupSessions(db, outsider.id, group.id), DomainError);
      const empty = await groupSessions(db, outsider.id, otherGroup.id, new Date("2026-12-31T20:00:00Z"));
      assert.equal(empty.upcoming, null);
      assert.equal(empty.recent.length, 0);
      const futureId = await createTrainingEvent(db, outsider.id, otherGroup.id, { ...eventInput, date: "2029-01-03" });
      const future = await groupSessions(db, outsider.id, otherGroup.id, new Date("2026-12-31T20:00:00Z"));
      assert.equal(future.upcoming?.id, futureId, "saved future sessions are found even beyond next year without recurring times");
    });

    await t.test("AI-generated plan revisions are attributed privately", async () => {
      const aiInput = { ...eventInput, date: "2026-11-25", title: "AI-assistert økt" };
      const aiEventId = await createTrainingEvent(db, coach.id, group.id, aiInput);
      await saveSessionPlan(db, coach.id, group.id, aiEventId, aiInput, completePlan(), 1, "draft", "ai");
      const aiHistory = await sessionHistory(db, head.id, group.id, aiEventId);
      assert.equal(aiHistory[0].actorType, "ai");
      assert.equal(aiHistory[0].actorEmail, coach.email);
      assert.equal(Object.hasOwn(aiHistory[0], "actorId"), false, "private actor ids are not exposed in the history view model");
    });

    await t.test("calendar drafts inherit the actual slot and edits derive duration without changing the schedule", async () => {
      const input = { ...eventInput, date: "2026-11-18", startTime: "19:30", endTime: "20:00", durationMinutes: 30 };
      const id = await createTrainingEvent(db, coach.id, group.id, input, "2026-11-18T19:30");
      const initial = await trainingEventDetails(db, coach.id, group.id, id);
      assert.equal(initial.event.endTime, "21:00", "server uses the weekly time, not stale or forged form values");
      assert.equal(initial.event.durationMinutes, 90);
      assert.equal(initial.versions[0].eventSnapshot.durationMinutes, 90);
      await saveSessionPlan(db, coach.id, group.id, id, { ...input, endTime: "20:45", durationMinutes: 999 }, emptySessionPlan(), 1, "draft");
      const edited = await trainingEventDetails(db, coach.id, group.id, id);
      assert.equal(edited.event.durationMinutes, 75);
      assert.equal(edited.versions[0].eventSnapshot.endTime, "20:45");
      assert.equal(edited.versions[1].eventSnapshot.endTime, "21:00", "previous timing is retained");
      const next = (await groupCalendar(db, coach.id, group.id, 2026)).entries
        .find((event) => event.date === "2026-11-25" && event.startTime === "19:30");
      assert.equal(next?.durationMinutes, 90);
      const single = await createTrainingEvent(db, coach.id, group.id, { ...input, date: "2026-11-19", endTime: "20:15" });
      assert.equal((await trainingEventDetails(db, coach.id, group.id, single)).event.durationMinutes, 45);
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, single, { ...input, date: "2026-11-19", endTime: "20:45" }, completePlan(), 1, "planned"), /60 minutter.*75/);
      await assert.rejects(db.transaction(async (tx) => {
        await tx.update(trainingEvents).set({ durationMinutes: 60 }).where(eq(trainingEvents.id, id));
      }), (error: unknown) => error instanceof Error && error.cause instanceof Error && "code" in error.cause && error.cause.code === "23514");
    });

    await t.test("draft validation, approval, immutable versions and stale-edit protection", async () => {
      const initialHistoryCount = (await sessionHistory(db, coach.id, group.id, eventId)).length;
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, eventId, eventInput, emptySessionPlan(), 1, "planned"), /godkjennes/);
      assert.equal((await sessionHistory(db, coach.id, group.id, eventId)).length, initialHistoryCount);
      await saveSessionPlan(db, coach.id, group.id, eventId, eventInput, completePlan(), 1, "planned");
      const saved = await trainingEventDetails(db, head.id, group.id, eventId);
      const savedHistory = await sessionHistory(db, head.id, group.id, eventId);
      assert.equal(saved.event.status, "planned");
      assert.equal(saved.versions[0].eventSnapshot.status, "planned");
      assert.equal(saved.versions.length, 2);
      assert.equal(saved.versions[1].plan.exercises.length, 0);
      assert.equal(saved.versions[0].plan.exercises[0].title, "Lokalt smålagsspill");
      const approval = savedHistory.find((entry) => entry.action === "status_changed");
      assert.equal(approval?.beforeSnapshot?.event && (approval.beforeSnapshot.event as { status: string }).status, "draft");
      assert.equal(approval?.afterSnapshot?.event && (approval.afterSnapshot.event as { status: string }).status, "planned");
      assert.equal(approval?.actorEmail, coach.email);
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, eventId, eventInput, completePlan(), 1, "draft"), /endret av en annen/);
      assert.equal((await sessionHistory(db, head.id, group.id, eventId)).length, savedHistory.length);
      await saveSessionPlan(db, head.id, group.id, eventId, { ...eventInput, theme: "Endret tema" }, completePlan(), 2, "draft");
      const revised = await trainingEventDetails(db, coach.id, group.id, eventId);
      const revisedHistory = await sessionHistory(db, coach.id, group.id, eventId);
      assert.equal(revised.event.status, "draft", "editing an approved plan does not silently retain approval");
      assert.equal(revised.versions[1].eventSnapshot.theme, "Pasning");
      assert.equal(revised.versions[1].eventSnapshot.status, "planned");
      assert.equal(revised.versions[0].eventSnapshot.theme, "Endret tema");
      assert.ok(revisedHistory.some((entry) => entry.beforeSnapshot?.event && (entry.beforeSnapshot.event as { theme: string }).theme === "Pasning"
        && entry.afterSnapshot?.event && (entry.afterSnapshot.event as { theme: string }).theme === "Endret tema"));
    });

    await t.test("approval does not require session inventory and preserves historical equipment", async () => {
      const input = { ...eventInput, date: "2029-01-03" };
      const id = await createTrainingEvent(db, head.id, group.id, input);
      const legacy = { ...completePlan(), assumptions: "Tidligere forutsetning" };
      await saveSessionPlan(db, head.id, group.id, id, input, legacy, 1, "draft");
      const withoutInventory = { ...legacy, availableBalls: null, availableSmallGoals: null, availableLargeGoals: null, equipmentConfirmed: false, assumptions: "" };
      await saveSessionPlan(db, head.id, group.id, id, input, withoutInventory, 2, "planned");
      const details = await trainingEventDetails(db, head.id, group.id, id);
      assert.equal(details.event.status, "planned");
      assert.equal(details.versions[0].plan.availableBalls, null);
      assert.equal(details.versions[1].plan.availableBalls, legacy.availableBalls);
      assert.equal(details.versions[1].plan.assumptions, legacy.assumptions);
    });

    await t.test("annual plan changes do not retroactively alter session snapshots", async () => {
      const annual = await annualPlanning(db, coach.id, group.id, 2026);
      await savePlanPeriod(db, coach.id, group.id, 2026, { ...periodInput, theme: "Vending" }, annual.plan!.revision, annual.periods[0].id);
      const session = await trainingEventDetails(db, coach.id, group.id, eventId);
      assert.equal(session.context.periods[0].theme, "Vending");
      assert.equal(session.versions[0].planningContext.periods[0].theme, "Pasning");
      assert.equal(session.event.theme, "Endret tema");
      const updated = await annualPlanning(db, coach.id, group.id, 2026);
      const updatedHistory = await annualPlanHistory(db, coach.id, group.id, 2026);
      assert.ok(updatedHistory.some((entry) => entry.action === "updated" && entry.beforeSnapshot?.theme === "Pasning"
        && entry.afterSnapshot?.theme === "Vending"));
      await assert.rejects(removePlanPeriod(db, outsider.id, group.id, updated.periods[0].id, updated.plan!.revision), DomainError);
      await removePlanPeriod(db, coach.id, group.id, updated.periods[0].id, updated.plan!.revision);
      const afterDelete = await annualPlanHistory(db, coach.id, group.id, 2026);
      const deletion = afterDelete.find((entry) => entry.action === "deleted");
      assert.equal(deletion?.beforeSnapshot?.theme, "Vending");
      assert.equal(deletion?.afterSnapshot, null);
      assert.equal(deletion?.actorEmail, coach.email);
      assert.equal((await trainingEventDetails(db, coach.id, group.id, eventId)).versions[0].planningContext.periods[0].theme, "Pasning");
    });

    await t.test("cohort changes affect future contexts but preserve every historical version", async () => {
      const original = await trainingEventDetails(db, coach.id, group.id, eventId);
      await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 3, birthYear: 2018 });
      const revised = await trainingEventDetails(db, coach.id, group.id, eventId);
      assert.equal(revised.context.birthYear, 2018);
      assert.deepEqual(revised.versions, original.versions);
      const newId = await createTrainingEvent(db, coach.id, group.id, { ...eventInput, date: "2027-02-01" });
      const newDetails = await trainingEventDetails(db, coach.id, group.id, newId);
      assert.equal(newDetails.versions[0].planningContext.birthYear, 2018, "team cohort is used even without an annual plan");
      assert.ok(newDetails.versions[0].planningContext.curriculum.url.endsWith("/barn_8-9/"));
      await updateGroupSettings(db, admin.id, group.id, { generationDaysBefore: 3, birthYear: 2017 });
    });

    await t.test("moving a recurring event across years suppresses the original without changing weekly times", async () => {
      await saveSessionPlan(db, coach.id, group.id, eventId, { ...eventInput, date: "2027-01-02", startTime: "12:00", endTime: "13:00" }, completePlan(), 3, "draft");
      const oldYear = await groupCalendar(db, coach.id, group.id, 2026);
      assert.equal(oldYear.entries.some((event) => event.date === "2026-11-04" && event.startTime === "18:00"), false);
      assert.equal(oldYear.entries.some((event) => event.date === "2026-11-11" && event.startTime === "18:00"), true);
      const nextYear = await groupCalendar(db, coach.id, group.id, 2027);
      assert.equal(nextYear.entries.find((event) => event.id === eventId)?.date, "2027-01-02");
      assert.equal((await trainingEventDetails(db, coach.id, group.id, eventId)).versions[0].planningContext.year, 2027);
      await assert.rejects(createTrainingEvent(db, coach.id, group.id, eventInput), /allerede/);
    });

    await t.test("single-session cancellation survives recurrence and preserves the plan", async () => {
      const cancelledInput = { ...eventInput, date: "2026-11-11" };
      const cancelledId = await createTrainingEvent(db, coach.id, group.id, cancelledInput, "2026-11-11T18:00", true);
      const calendar = await groupCalendar(db, coach.id, group.id, 2026);
      assert.equal(calendar.entries.filter((event) => event.date === "2026-11-11" && event.startTime === "18:00").length, 1);
      assert.equal(calendar.entries.find((event) => event.id === cancelledId)?.status, "cancelled");
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, cancelledId, cancelledInput, completePlan(), 1, "draft"), /Angre avlysningen/);
      await setTrainingCancellation(db, coach.id, group.id, cancelledId, 1, false);
      assert.equal((await trainingEventDetails(db, coach.id, group.id, cancelledId)).versions.length, 1);
      await assert.rejects(setTrainingCancellation(db, coach.id, group.id, cancelledId, 1, true), /endret av en annen/);
      await setTrainingCancellation(db, coach.id, group.id, cancelledId, 2, true);
      const history = await sessionHistory(db, head.id, group.id, cancelledId);
      assert.equal(history.filter((entry) => entry.action === "status_changed").length, 2);
      const reopened = history.find((entry) => entry.action === "status_changed" && entry.beforeSnapshot?.cancelled === true);
      assert.equal(reopened?.afterSnapshot?.cancelled, false);
      assert.equal((reopened?.beforeSnapshot?.event as { status: string } | undefined)?.status, "draft");
      assert.equal(reopened?.actorType, "user");
    });

    await t.test("deleting a plan preserves its session, and cancellation is independent and reversible", async () => {
      const input = { ...eventInput, date: "2028-03-01", title: "Uten plan" };
      const id = await createTrainingEvent(db, coach.id, group.id, input);
      await saveSessionPlan(db, coach.id, group.id, id, input, completePlan(), 1, "draft");
      await deleteSessionPlan(db, coach.id, group.id, id, 2);
      let details = await trainingEventDetails(db, head.id, group.id, id);
      assert.equal(details.event.status, "no_plan");
      assert.equal(details.event.cancelledAt, null);
      assert.equal(details.versions.length, 2, "deleted active plans remain in revision history");
      assert.equal((await groupCalendar(db, head.id, group.id, 2028)).entries.find((item) => item.id === id)?.status, "no_plan");
      let history = await sessionHistory(db, head.id, group.id, id);
      assert.ok(history.some((entry) => entry.action === "deleted" && entry.afterSnapshot === null));

      await setTrainingCancellation(db, head.id, group.id, id, 3, true);
      details = await trainingEventDetails(db, head.id, group.id, id);
      assert.equal(details.event.status, "cancelled");
      assert.ok(details.event.cancelledAt);
      assert.ok(details.event.planDeletedAt);
      await setTrainingCancellation(db, head.id, group.id, id, 4, false);
      details = await trainingEventDetails(db, head.id, group.id, id);
      assert.equal(details.event.status, "no_plan", "undoing cancellation does not restore a deleted plan");
      assert.equal(details.event.cancelledAt, null);

      await saveSessionPlan(db, head.id, group.id, id, input, completePlan(), 5, "draft");
      details = await trainingEventDetails(db, head.id, group.id, id);
      assert.equal(details.event.status, "draft");
      assert.equal(details.event.planDeletedAt, null);
      assert.equal(details.versions.length, 3, "a new plan starts a new revision without deleting prior versions");
      history = await sessionHistory(db, head.id, group.id, id);
      assert.ok(history.some((entry) => entry.action === "deleted"));
    });

    await t.test("session coach participants are scoped, versioned and editable", async () => {
      const input = { ...eventInput, date: "2028-04-04" };
      const id = await createTrainingEvent(db, head.id, group.id, input);
      let details = await trainingEventDetails(db, head.id, group.id, id);
      assert.deepEqual(new Set(details.versions[0].plan.coachIds), new Set([head.id, coach.id]));
      assert.equal(details.versions[0].plan.confirmedCoaches, 2);
      const selected = { ...completePlan(), coachIds: [head.id], confirmedCoaches: 1, coachAttendanceConfirmed: false,
        coachIdsForExercises: [head.id, coach.id] };
      await assert.rejects(saveSessionPlan(db, outsider.id, group.id, id, input, selected, 1, "draft"), DomainError);
      await assert.rejects(saveSessionPlan(db, head.id, group.id, id, input, { ...selected, coachIds: [outsider.id] }, 1, "draft"), /medlemmer/);
      await assert.rejects(saveSessionPlan(db, head.id, group.id, id, input, { ...selected, confirmedCoaches: 2 }, 1, "draft"));
      await assert.rejects(saveSessionPlan(db, head.id, group.id, id, input, selected, 1, "planned"), /Trenere: trenger 2, tilgjengelig 1/);
      await saveSessionPlan(db, head.id, group.id, id, input, selected, 1, "draft");
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, id, input, selected, 1, "draft"), /endret/);
      details = await trainingEventDetails(db, coach.id, group.id, id);
      assert.deepEqual(details.versions[0].plan.coachIds, [head.id]);
      assert.deepEqual(new Set(details.versions[1].plan.coachIds), new Set([head.id, coach.id]));
      const readded = { ...selected, coachIds: [head.id, coach.id], confirmedCoaches: 2 };
      await saveSessionPlan(db, coach.id, group.id, id, input, readded, 2, "planned");
      const approved = await trainingEventDetails(db, head.id, group.id, id);
      assert.deepEqual(approved.versions[0].plan.coachIds, [head.id, coach.id]);
      assert.equal(approved.event.status, "planned");
      assert.equal(approved.versions[0].plan.coachAttendanceConfirmed, undefined);
      const selectedId = await createTrainingEvent(db, head.id, group.id, { ...input, date: "2028-04-05" }, null, false, "", []);
      assert.deepEqual((await trainingEventDetails(db, head.id, group.id, selectedId)).versions[0].plan.coachIds, []);
      await assert.rejects(createTrainingEvent(db, head.id, group.id, { ...input, date: "2028-04-06" }, null, false, "", [outsider.id]), /medlemmer/);
    });

    await t.test("session access and composite foreign keys isolate tenant writes and version history", async () => {
      await assert.rejects(trainingEventDetails(db, outsider.id, group.id, eventId), DomainError);
      await assert.rejects(sessionHistory(db, outsider.id, group.id, eventId), DomainError);
      await assert.rejects(trainingEventDetails(db, outsider.id, otherGroup.id, eventId), DomainError);
      assert.equal(Object.hasOwn(await trainingEventDetails(db, head.id, group.id, eventId), "history"), false,
        "AI planning inputs exclude private actor history");
      await assert.rejects(saveSessionPlan(db, outsider.id, otherGroup.id, eventId, eventInput, completePlan(), 4, "draft"), DomainError);
      await assert.rejects(setTrainingCancellation(db, outsider.id, group.id, eventId, 4, true), DomainError);
      await assert.rejects(createTrainingEvent(db, outsider.id, group.id, { ...eventInput, date: "2026-11-12" }), DomainError);
      await assert.rejects(db.transaction(async (tx) => {
        await tx.insert(trainingEvents).values({ ...eventInput, clubId: otherClub.id, groupId: group.id });
      }), (error: unknown) => error instanceof Error && error.cause instanceof Error && "code" in error.cause && error.cause.code === "23503");
      const [version] = await db.select().from(sessionVersions).where(eq(sessionVersions.eventId, eventId));
      await assert.rejects(db.transaction(async (tx) => {
        await tx.insert(sessionVersions).values({ ...version, id: crypto.randomUUID(), groupId: otherGroup.id, clubId: otherClub.id, version: 99 });
      }), (error: unknown) => error instanceof Error && error.cause instanceof Error && "code" in error.cause && error.cause.code === "23503");
      const [annual] = await db.select().from(annualPlans).where(eq(annualPlans.groupId, group.id));
      await assert.rejects(db.transaction(async (tx) => {
        await tx.insert(planPeriods).values({ ...periodInput, annualPlanId: annual.id, groupId: otherGroup.id, clubId: otherClub.id });
      }), (error: unknown) => error instanceof Error && error.cause instanceof Error && "code" in error.cause && error.cause.code === "23503");
      await removeMember(db, head.id, group.id, coach.id);
      await assert.rejects(saveAnnualPlan(db, coach.id, group.id, { year: 2027, objectives: "" }, 0), DomainError);
      await assert.rejects(trainingEventDetails(db, coach.id, group.id, eventId), DomainError);
    });

    await t.test("calendar exceptions and plan versions persist after reopening the local database", async () => {
      await connection.close();
      await migrateLocalDatabase(directory);
      connection = await connectLocalDatabase(directory);
      const saved = await trainingEventDetails(connection.db, admin.id, group.id, eventId);
      assert.equal(saved.event.date, "2027-01-02");
      assert.equal(saved.versions.length, 4);
      assert.equal(saved.versions[2].eventSnapshot.status, "planned");
      const calendar = await groupCalendar(connection.db, admin.id, group.id, 2026);
      assert.equal(calendar.entries.find((event) => event.date === "2026-11-11" && event.startTime === "18:00")?.status, "cancelled");
      assert.equal(calendar.entries.some((event) => event.date === "2026-11-04" && event.startTime === "18:00"), false);
    });
  } finally {
    await connection.close();
    await rm(directory, { recursive: true, force: true });
  }
});
