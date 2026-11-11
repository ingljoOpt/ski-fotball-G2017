import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { generationJobs, planningHistory, sessionVersions, trainingEvents, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, addTrainingTime, createClub, createGroup, DomainError, groupDetails, inviteCoach, saveCoach, updateGroupSettings, updateTrainingTime, updateTrainingTimeCounts } from "../../src/lib/domain.ts";
import { createTrainingEvent, groupCalendar, saveSessionPlan, trainingEventDetails } from "../../src/lib/planning-domain.ts";
import { datesInYear, weekdayFor } from "../../src/lib/planning.ts";
import { prepareAIProposal } from "../../src/lib/session-ai.ts";
import { runScheduledDrafts } from "../../src/lib/scheduled-drafts.ts";
import { completePlan } from "./planning-fixtures.ts";

test("scheduled generation is opt-in, idempotent, retryable and never overwrites a manual plan", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scheduled-drafts-"));
  await migrateLocalDatabase(directory);
  const connection = await connectLocalDatabase(directory);
  try {
    const { db } = connection;
    const [admin, head] = await db.insert(users).values([{ email: "admin@example.invalid" }, { email: "head@example.invalid" }]).returning();
    const club = await createClub(db, admin.id, "Testklubb");
    const { group, token } = await createGroup(db, admin.id, club.id, "Testlag", head.email, 2017);
    await acceptInvitation(db, head.id, token);
    const offline = await saveCoach(db, head.id, group.id, { name: "Trener uten konto", email: "" });
    await addTrainingTime(db, head.id, group.id, { weekday: 3, startTime: "18:00", endTime: "19:00" });
    const now = new Date("2026-11-09T05:00:00Z");
    const generate: Parameters<typeof runScheduledDrafts>[2] = async (context) => {
      const sample = completePlan().exercises[0];
      const plan = { ...context.draft.plan, exercises: [{ ...sample, simultaneousGroups: null, assignedPlayers: null, coaches: null,
        balls: null, reserveBalls: null, smallGoals: null, largeGoals: null }] };
      return prepareAIProposal({ title: "AI-utkast", theme: "Pasning", objectives: "Se opp", plan }, context.draft, []);
    };
    assert.deepEqual(await runScheduledDrafts(db, now, generate), { created: 0, skipped: 0, failed: 0, remaining: 0 });
    await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, autoDraftEnabled: true });
    const failed = await runScheduledDrafts(db, now, async () => { throw new Error("Fiktiv modellfeil"); });
    assert.equal(failed.failed, 1);
    assert.equal((await db.select().from(trainingEvents)).length, 0);
    assert.equal((await db.select().from(generationJobs))[0].status, "failed");
    const retry = new Date("2026-11-10T05:00:00Z");
    const result = await runScheduledDrafts(db, retry, generate);
    assert.equal(result.created, 1);
    assert.equal((await runScheduledDrafts(db, retry, generate)).created, 0);
    const [event] = await db.select().from(trainingEvents);
    const [version] = await db.select().from(sessionVersions).where(eq(sessionVersions.eventId, event.id));
    const [history] = await db.select().from(planningHistory).where(eq(planningHistory.entityId, event.id));
    assert.equal(event.date, "2026-11-11");
    assert.equal(event.status, "planned");
    assert.equal(version.eventSnapshot.status, "planned");
    assert.equal(version.origin, "ai");
    assert.equal(version.createdBy, null);
    assert.deepEqual(new Set(version.plan.coachIds), new Set([head.id, offline]));
    assert.equal(version.plan.confirmedCoaches, 2);
    assert.equal(version.plan.coachAttendanceConfirmed, undefined);
    assert.equal(history.actorType, "system");
    assert.equal(history.actorId, null);

    const later = new Date("2026-11-16T05:00:00Z");
    const manual = await runScheduledDrafts(db, later, async (context, signal) => {
      const proposal = await generate(context, signal);
      await createTrainingEvent(db, head.id, group.id, context.draft.event, `${context.draft.event.date}T${context.draft.event.startTime}`);
      return proposal;
    });
    assert.equal(manual.created, 0);
    const events = await db.select().from(trainingEvents);
    assert.equal(events.length, 2);
    const manualEvent = events.find((item) => item.date === "2026-11-18")!;
    assert.equal((await db.select().from(sessionVersions).where(eq(sessionVersions.eventId, manualEvent.id)))[0].origin, "manual");

    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const concurrentNow = new Date("2026-11-23T05:00:00Z");
    const first = runScheduledDrafts(db, concurrentNow, async (context, signal) => {
      calls++;
      started();
      await gate;
      return generate(context, signal);
    });
    await entered;
    const second = await runScheduledDrafts(db, concurrentNow, async (context, signal) => {
      calls++;
      return generate(context, signal);
    });
    release();
    assert.equal((await first).created, 1);
    assert.equal(second.created, 0);
    assert.equal(second.skipped, 1);
    assert.equal(calls, 1);

    const changedNow = new Date("2026-11-30T05:00:00Z");
    const changed = await runScheduledDrafts(db, changedNow, async (context, signal) => {
      const proposal = await generate(context, signal);
      await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, autoDraftEnabled: false });
      return proposal;
    });
    assert.equal(changed.created, 0);
    assert.equal((await db.select().from(trainingEvents)).length, 3);
    await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, autoDraftEnabled: true });
    assert.equal((await runScheduledDrafts(db, changedNow, generate)).created, 1);

    await addTrainingTime(db, head.id, group.id, { weekday: 1, startTime: "06:01", endTime: "07:01" });
    await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 0, autoDraftEnabled: true });
    const early = new Date("2026-12-07T05:00:00Z");
    const late = await runScheduledDrafts(db, early, async (context, signal) => {
      const proposal = await generate(context, signal);
      early.setUTCMinutes(2);
      return proposal;
    });
    assert.equal(late.created, 0);
    assert.equal((await db.select().from(trainingEvents)).length, 4);

    const [newCoach] = await db.insert(users).values({ email: "new-coach@example.invalid" }).returning();
    const membershipChanged = await runScheduledDrafts(db, new Date("2026-12-14T05:00:00Z"), async (context, signal) => {
      const proposal = await generate(context, signal);
      const invitation = await inviteCoach(db, head.id, group.id, newCoach.email);
      await acceptInvitation(db, newCoach.id, invitation.token);
      return proposal;
    });
    assert.equal(membershipChanged.created, 0);
    assert.equal(membershipChanged.skipped, 1);
    assert.equal((await db.select().from(trainingEvents)).length, 4);
    const rosterChanged = await runScheduledDrafts(db, new Date("2026-12-21T05:00:00Z"), async (context, signal) => {
      const proposal = await generate(context, signal);
      await saveCoach(db, head.id, group.id, { name: "Ny trener uten konto", email: "" });
      return proposal;
    });
    assert.equal(rosterChanged.created, 0);
    assert.equal(rosterChanged.skipped, 1);
    assert.equal((await db.select().from(trainingEvents)).length, 4);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});

test("attendance expectations inherit, remain snapshots and reach automatic planning", async () => {
  const directory = await mkdtemp(join(tmpdir(), "session-counts-"));
  await migrateLocalDatabase(directory);
  const connection = await connectLocalDatabase(directory);
  try {
    const { db } = connection;
    const [admin, head, outsider] = await db.insert(users).values(
      ["admin-count", "head-count", "outsider-count"].map((name) => ({ email: `${name}@example.invalid` })),
    ).returning();
    const club = await createClub(db, admin.id, "Antall klubb");
    const { group, token } = await createGroup(db, admin.id, club.id, "Antall lag", head.email, 2017);
    await acceptInvitation(db, head.id, token);
    await addTrainingTime(db, head.id, group.id, { weekday: 3, startTime: "18:00", endTime: "19:00" });
    const time = (await groupDetails(db, head.id, group.id)).times[0];
    await assert.rejects(updateGroupSettings(db, outsider.id, group.id, { generationDaysBefore: 2, playerCount: 20 }), DomainError);
    await assert.rejects(updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, playerCount: 501 }));
    await assert.rejects(updateTrainingTimeCounts(db, outsider.id, group.id, time.id, { expectedPlayers: 1, expectedCoaches: 1 }), DomainError);
    await assert.rejects(updateTrainingTimeCounts(db, head.id, group.id, time.id, { expectedPlayers: -1, expectedCoaches: 1 }));
    const differentiation = { enabled: true, levels: [{ players: 4, groups: 1 }, { players: 6, groups: 0 }, { players: 12, groups: 3 }] };
    await assert.rejects(updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, playerCount: 21, differentiation }), DomainError);
    await assert.rejects(updateGroupSettings(db, outsider.id, group.id, { generationDaysBefore: 2, playerCount: 22, differentiation }), DomainError);
    const withoutGroups = { ...differentiation, levels: differentiation.levels.map((level) => ({ ...level, groups: 0 })) };
    await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, playerCount: 22, differentiation: withoutGroups });
    assert.deepEqual((await groupDetails(db, head.id, group.id)).group.differentiation, withoutGroups);
    await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, autoDraftEnabled: true, playerCount: 22, coachCount: 4, differentiation });
    assert.deepEqual((await groupDetails(db, head.id, group.id)).group.differentiation, differentiation);
    const wednesdays = datesInYear(2099).filter((date) => weekdayFor(date) === 3);
    const event = { date: wednesdays[0], startTime: "18:00", endTime: "19:00", title: "Trening", theme: "", objectives: "" };
    const inherited = await createTrainingEvent(db, head.id, group.id, event);
    let details = await trainingEventDetails(db, head.id, group.id, inherited);
    assert.equal(details.versions[0].plan.expectedPlayers, 22);
    assert.equal(details.versions[0].plan.confirmedCoaches, 4);
    assert.equal(details.versions[0].plan.coachIds, undefined);
    await updateTrainingTimeCounts(db, head.id, group.id, time.id, { expectedPlayers: 17, expectedCoaches: 0 });
    const overridden = await createTrainingEvent(db, head.id, group.id, { ...event, date: wednesdays[1] });
    details = await trainingEventDetails(db, head.id, group.id, overridden);
    assert.equal(details.versions[0].plan.expectedPlayers, 17);
    assert.equal(details.versions[0].plan.confirmedCoaches, 0);
    await saveSessionPlan(db, head.id, group.id, overridden, details.event,
      { ...details.versions[0].plan, expectedPlayers: 12, confirmedCoaches: 2 }, details.event.revision, "planned", "manual", false);
    const edited = await trainingEventDetails(db, head.id, group.id, overridden);
    assert.equal(edited.versions[0].plan.expectedPlayers, 12);
    assert.equal(edited.versions[0].plan.confirmedCoaches, 2);
    assert.equal(edited.versions[1].plan.confirmedCoaches, 0);
    const single = await createTrainingEvent(db, head.id, group.id, { ...event, date: wednesdays[2] }, null, false, "", undefined,
      { expectedPlayers: "0", expectedCoaches: "3" });
    const singlePlan = (await trainingEventDetails(db, head.id, group.id, single)).versions[0].plan;
    assert.equal(singlePlan.expectedPlayers, 0);
    assert.equal(singlePlan.confirmedCoaches, 3);
    const now = new Date("2026-11-09T05:00:00Z");
    const generate: Parameters<typeof runScheduledDrafts>[2] = async (context) => {
      assert.equal(context.draft.plan.expectedPlayers, 17);
      assert.equal(context.draft.plan.confirmedCoaches, 0);
      assert.equal(context.differentiation?.teamPlayers, 22);
      assert.equal(context.differentiation?.sessionPlayers, 17);
      assert.deepEqual(context.differentiation?.settings.levels.map((level) => level.players), [4, 6, 12]);
      const sample = completePlan().exercises[0];
      const plan = { ...context.draft.plan, exercises: [{ ...sample, simultaneousGroups: null, assignedPlayers: null, coaches: null,
        balls: null, reserveBalls: null, smallGoals: null, largeGoals: null }] };
      return prepareAIProposal({ title: "AI-utkast", theme: "Pasning", objectives: "Se opp", plan }, context.draft, []);
    };
    const stale = await runScheduledDrafts(db, now, async (context, signal) => {
      const proposal = await generate(context, signal);
      await updateTrainingTimeCounts(db, head.id, group.id, time.id, { expectedPlayers: "", expectedCoaches: "" });
      return proposal;
    });
    assert.equal(stale.created, 0);
    assert.equal(stale.skipped, 1);
    assert.equal((await trainingEventDetails(db, head.id, group.id, inherited)).versions[0].plan.expectedPlayers, 22);
    const result = await runScheduledDrafts(db, now, async (context) => {
      assert.equal(context.draft.plan.expectedPlayers, 22);
      assert.equal(context.draft.plan.confirmedCoaches, 4);
      const sample = completePlan().exercises[0];
      return prepareAIProposal({ title: "AI-utkast", theme: "Pasning", objectives: "Se opp", plan: { ...context.draft.plan,
        exercises: [{ ...sample, simultaneousGroups: null, assignedPlayers: null, coaches: null, balls: null, reserveBalls: null, smallGoals: null, largeGoals: null }] } }, context.draft, []);
    });
    assert.equal(result.created, 1);
    const automatic = (await db.select().from(trainingEvents)).find((item) => item.date === "2026-11-11")!;
    const generated = (await trainingEventDetails(db, head.id, group.id, automatic.id)).versions[0].plan;
    assert.equal(generated.expectedPlayers, 22);
    assert.equal(generated.confirmedCoaches, 4);
    const changed = await runScheduledDrafts(db, new Date("2026-11-16T05:00:00Z"), async (context) => {
      assert.equal(context.differentiation?.settings.enabled, true);
      const sample = completePlan().exercises[0];
      const proposal = prepareAIProposal({ title: "AI-utkast", theme: "Pasning", objectives: "Se opp", plan: { ...context.draft.plan,
        exercises: [{ ...sample, simultaneousGroups: null, assignedPlayers: null, coaches: null, balls: null, reserveBalls: null, smallGoals: null, largeGoals: null }] } }, context.draft, []);
      await updateGroupSettings(db, head.id, group.id, { generationDaysBefore: 2, differentiation: { ...differentiation, enabled: false } });
      return proposal;
    });
    assert.equal(changed.created, 0);
    assert.equal(changed.skipped, 1);
    await updateTrainingTime(db, head.id, group.id, time.id, { weekday: 4, startTime: "17:00", endTime: "18:30", expectedPlayers: 12, expectedCoaches: 2 });
    const calendar = await groupCalendar(db, head.id, group.id, 2026);
    assert.ok(calendar.entries.some((item) => item.date === "2026-11-19" && item.startTime === "17:00" && item.virtual));
    assert.ok(!calendar.entries.some((item) => item.date === "2026-11-18" && item.startTime === "18:00" && item.virtual));
    const saved = await trainingEventDetails(db, head.id, group.id, automatic.id);
    assert.equal(saved.event.startTime, "18:00");
    assert.equal(saved.versions[0].plan.expectedPlayers, 22);
    assert.equal(saved.versions[0].plan.confirmedCoaches, 4);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});