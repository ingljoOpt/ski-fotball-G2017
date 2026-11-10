import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { generationJobs, planningHistory, sessionVersions, trainingEvents, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, addTrainingTime, createClub, createGroup, inviteCoach, updateGroupSettings } from "../../src/lib/domain.ts";
import { createTrainingEvent } from "../../src/lib/planning-domain.ts";
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
    assert.equal(event.status, "draft");
    assert.equal(version.origin, "ai");
    assert.equal(version.createdBy, null);
    assert.deepEqual(version.plan.coachIds, [head.id]);
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
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});