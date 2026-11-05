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
  acceptInvitation, addTrainingTime, createClub, createGroup, DomainError, inviteCoach, removeMember,
} from "../../src/lib/domain.ts";
import {
  annualPlanning, changeTrainingStatus, createTrainingEvent, groupCalendar, removePlanPeriod,
  saveAnnualPlan, savePlanPeriod, saveSessionPlan, trainingEventDetails,
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
    const { group, token } = await createGroup(db, admin.id, club.id, "G2017", head.email);
    const { group: otherGroup } = await createGroup(db, outsider.id, otherClub.id, "G2017", outsider.email);
    await acceptInvitation(db, head.id, token);
    const invitation = await inviteCoach(db, head.id, group.id, coach.email);
    await acceptInvitation(db, coach.id, invitation.token);
    await addTrainingTime(db, head.id, group.id, { weekday: 3, startTime: "18:00", endTime: "19:00" });
    await addTrainingTime(db, head.id, group.id, { weekday: 3, startTime: "19:30", endTime: "21:00" });
    const periodInput = { startDate: "2026-11-01", endDate: "2026-11-30", theme: "Pasning", objectives: "Se før pasning", progression: "Fra par til spill", sourceUrl: "" };
    const eventInput = { date: "2026-11-04", startTime: "18:00", endTime: "19:00", durationMinutes: 60, title: "Planøkt", theme: "Pasning", objectives: "Se før pasning" };
    let eventId: string;

    await t.test("all coaches can plan, while outsiders and other clubs are denied", async () => {
      await assert.rejects(annualPlanning(db, outsider.id, group.id, 2026), DomainError);
      await assert.rejects(saveAnnualPlan(db, outsider.id, group.id, { year: 2026, birthYear: 2017, objectives: "" }, 0), DomainError);
      await saveAnnualPlan(db, coach.id, group.id, { year: 2026, birthYear: 2017, objectives: "Utvikle samspill" }, 0);
      const annual = await annualPlanning(db, head.id, group.id, 2026);
      assert.equal(annual.plan?.birthYear, 2017);
      assert.equal(annual.periods.length, 0, "NFF themes are not generated or seeded");
      await assert.rejects(savePlanPeriod(db, outsider.id, group.id, 2026, periodInput, 1), DomainError);
      await savePlanPeriod(db, head.id, group.id, 2026, periodInput, 1);
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2026, periodInput, 1), /endret av en annen/);
      await assert.rejects(savePlanPeriod(db, coach.id, group.id, 2026, periodInput, 2), /overlappe/);
      await assert.rejects(saveAnnualPlan(db, head.id, group.id, { year: 2026, birthYear: 2017, objectives: "" }, 0), /endret av en annen/);
      assert.equal((await annualPlanning(db, outsider.id, otherGroup.id, 2026)).periods.length, 0);
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
      assert.equal(details.versions.length, 1);
      assert.equal(details.versions[0].origin, "manual");
      assert.equal(details.versions[0].planningContext.curriculum.provider, "nff");
      assert.equal(details.versions[0].planningContext.curriculum.suggestions, "pending_ai");
      assert.equal(details.versions[0].planningContext.periods[0].theme, "Pasning");
      assert.equal(details.versions[0].plan.availableBalls, null);
      assert.equal((await groupCalendar(db, coach.id, group.id, 2026)).entries.length, 104);
      await assert.rejects(createTrainingEvent(db, coach.id, group.id, eventInput), /allerede/);
      await assert.rejects(createTrainingEvent(db, coach.id, group.id, { ...eventInput, date: "2026-11-05" }, "2026-11-04T18:00"), DomainError);
      await assert.rejects(createTrainingEvent(db, coach.id, group.id, { ...eventInput, date: "2026-11-05" }, "2026-11-05T18:00"), DomainError);
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
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, eventId, eventInput, emptySessionPlan(), 1, "planned"), /godkjennes/);
      await saveSessionPlan(db, coach.id, group.id, eventId, eventInput, completePlan(), 1, "planned");
      const saved = await trainingEventDetails(db, head.id, group.id, eventId);
      assert.equal(saved.event.status, "planned");
      assert.equal(saved.versions[0].eventSnapshot.status, "planned");
      assert.equal(saved.versions.length, 2);
      assert.equal(saved.versions[1].plan.exercises.length, 0);
      assert.equal(saved.versions[0].plan.exercises[0].title, "Lokalt smålagsspill");
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, eventId, eventInput, completePlan(), 1, "draft"), /endret av en annen/);
      await saveSessionPlan(db, head.id, group.id, eventId, { ...eventInput, theme: "Endret tema" }, completePlan(), 2, "draft");
      const revised = await trainingEventDetails(db, coach.id, group.id, eventId);
      assert.equal(revised.event.status, "draft", "editing an approved plan does not silently retain approval");
      assert.equal(revised.versions[1].eventSnapshot.theme, "Pasning");
      assert.equal(revised.versions[1].eventSnapshot.status, "planned");
      assert.equal(revised.versions[0].eventSnapshot.theme, "Endret tema");
    });

    await t.test("annual plan changes do not retroactively alter session snapshots", async () => {
      const annual = await annualPlanning(db, coach.id, group.id, 2026);
      await savePlanPeriod(db, coach.id, group.id, 2026, { ...periodInput, theme: "Vending" }, annual.plan!.revision, annual.periods[0].id);
      const session = await trainingEventDetails(db, coach.id, group.id, eventId);
      assert.equal(session.context.periods[0].theme, "Vending");
      assert.equal(session.versions[0].planningContext.periods[0].theme, "Pasning");
      assert.equal(session.event.theme, "Endret tema");
      const updated = await annualPlanning(db, coach.id, group.id, 2026);
      await assert.rejects(removePlanPeriod(db, outsider.id, group.id, updated.periods[0].id, updated.plan!.revision), DomainError);
      await removePlanPeriod(db, coach.id, group.id, updated.periods[0].id, updated.plan!.revision);
      assert.equal((await trainingEventDetails(db, coach.id, group.id, eventId)).versions[0].planningContext.periods[0].theme, "Pasning");
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
      await assert.rejects(saveSessionPlan(db, coach.id, group.id, cancelledId, cancelledInput, completePlan(), 1, "draft"), /Gjenåpne/);
      await changeTrainingStatus(db, coach.id, group.id, cancelledId, 1, "draft");
      assert.equal((await trainingEventDetails(db, coach.id, group.id, cancelledId)).versions.length, 1);
      await assert.rejects(changeTrainingStatus(db, coach.id, group.id, cancelledId, 1, "cancelled"), /endret av en annen/);
      await changeTrainingStatus(db, coach.id, group.id, cancelledId, 2, "cancelled");
    });

    await t.test("session access and composite foreign keys isolate tenant writes and version history", async () => {
      await assert.rejects(trainingEventDetails(db, outsider.id, group.id, eventId), DomainError);
      await assert.rejects(trainingEventDetails(db, outsider.id, otherGroup.id, eventId), DomainError);
      await assert.rejects(saveSessionPlan(db, outsider.id, otherGroup.id, eventId, eventInput, completePlan(), 4, "draft"), DomainError);
      await assert.rejects(changeTrainingStatus(db, outsider.id, group.id, eventId, 4, "cancelled"), DomainError);
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
