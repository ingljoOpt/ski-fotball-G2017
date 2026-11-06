import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { annualEvents, trainingEvents, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, addTrainingTime, createClub, createGroup, DomainError, inviteCoach, removeMember } from "../../src/lib/domain.ts";
import { annualPlanning, createTrainingEvent, groupCalendar, removeAnnualEvent, saveAnnualEvent, trainingEventDetails } from "../../src/lib/planning-domain.ts";
import { canonicalDestination } from "../../src/lib/tenant-routing.ts";

test("annual events are separate from training, tenant-scoped, revision-protected and persistent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "annual-events-"));
  await migrateLocalDatabase(directory);
  let connection = await connectLocalDatabase(directory);
  try {
    const { db } = connection;
    const [admin, head, coach, outsider] = await db.insert(users).values(
      ["admin", "head", "coach", "outsider"].map((name) => ({ email: `${name}@example.invalid` })),
    ).returning();
    const club = await createClub(db, admin.id, "Event club");
    const otherClub = await createClub(db, outsider.id, "Other event club");
    const { group, token } = await createGroup(db, admin.id, club.id, "G2017", head.email);
    const { group: otherGroup } = await createGroup(db, outsider.id, otherClub.id, "G2017", outsider.email);
    await acceptInvitation(db, head.id, token);
    const invite = await inviteCoach(db, head.id, group.id, coach.email);
    await acceptInvitation(db, coach.id, invite.token);
    await addTrainingTime(db, head.id, group.id, { weekday: 3, startTime: "18:00", endTime: "19:00" });
    const holiday = { title: "Juleferie", kind: "holiday", startDate: "2026-12-20", endDate: "2027-01-04", description: "Planlegg pausen" };
    const id = await saveAnnualEvent(db, coach.id, group.id, holiday);
    const cupId = await saveAnnualEvent(db, head.id, group.id, { ...holiday, title: "Cup", kind: "cup", startDate: "2026-12-23", endDate: "2026-12-23" });
    assert.equal((await annualPlanning(db, coach.id, group.id, 2026)).plan, null, "events do not require a saved annual plan");
    assert.equal((await annualPlanning(db, head.id, group.id, 2026)).events.length, 2);
    assert.equal((await annualPlanning(db, head.id, group.id, 2027)).events.length, 1);
    assert.equal((await annualPlanning(db, head.id, group.id, 2028)).events.length, 0);
    assert.equal((await db.select().from(trainingEvents)).length, 0, "events never create training drafts");
    const calendar = await groupCalendar(db, coach.id, group.id, 2026);
    const christmasTraining = calendar.entries.find((entry) => entry.date === "2026-12-23");
    assert.equal(christmasTraining?.status, "scheduled", "holiday does not silently cancel recurring training");
    assert.equal(calendar.events.length, 2);
    const input = { date: "2026-12-23", startTime: "18:00", endTime: "19:00", title: "Trening", theme: "", objectives: "" };
    const trainingId = await createTrainingEvent(db, coach.id, group.id, input, "2026-12-23T18:00");
    const original = await trainingEventDetails(db, coach.id, group.id, trainingId);
    assert.equal(original.versions[0].planningContext.events?.length, 2);
    await saveAnnualEvent(db, admin.id, group.id, { ...holiday, title: "Oppdatert ferie" }, id, 1);
    await assert.rejects(saveAnnualEvent(db, coach.id, group.id, holiday, id, 1), /endret av en annen/);
    await assert.rejects(removeAnnualEvent(db, coach.id, group.id, id, 1), /endret av en annen/);
    const updated = (await annualPlanning(db, head.id, group.id, 2027)).events[0];
    assert.equal(updated.revision, 2);
    assert.equal(updated.createdBy, coach.id);
    assert.equal(updated.updatedBy, admin.id);
    assert.ok(updated.updatedAt >= updated.createdAt);
    assert.equal(updated.title, "Oppdatert ferie");
    await assert.rejects(saveAnnualEvent(db, outsider.id, group.id, holiday), DomainError);
    await assert.rejects(saveAnnualEvent(db, outsider.id, otherGroup.id, holiday, id, 2), DomainError);
    await assert.rejects(removeAnnualEvent(db, outsider.id, otherGroup.id, id, 2), DomainError);
    await assert.rejects(db.transaction(async (tx) => {
      await tx.insert(annualEvents).values({ ...holiday, kind: "holiday", clubId: otherClub.id, groupId: group.id, createdBy: outsider.id, updatedBy: outsider.id });
    }));
    assert.deepEqual((await trainingEventDetails(db, coach.id, group.id, trainingId)).versions, original.versions, "updated events do not rewrite historical planning context");
    assert.equal(await canonicalDestination(db, coach.id, `/grupper/${group.id}/kalender?year=2027&month=1`),
      `/${club.slug}/${group.slug}/aarsplan?year=2027&month=1`);
    await removeAnnualEvent(db, head.id, group.id, cupId, 1);
    assert.equal((await annualPlanning(db, head.id, group.id, 2026)).events.length, 1);
    assert.deepEqual((await trainingEventDetails(db, coach.id, group.id, trainingId)).versions, original.versions);
    await removeMember(db, head.id, group.id, coach.id);
    await assert.rejects(saveAnnualEvent(db, coach.id, group.id, holiday, id, 2), DomainError);
    await connection.close();
    await migrateLocalDatabase(directory);
    connection = await connectLocalDatabase(directory);
    assert.equal((await annualPlanning(connection.db, admin.id, group.id, 2027)).events[0].title, "Oppdatert ferie");
    await removeAnnualEvent(connection.db, admin.id, group.id, id, 2);
    assert.equal((await annualPlanning(connection.db, admin.id, group.id, 2027)).events.length, 0);
    assert.equal((await connection.db.select().from(trainingEvents).where(eq(trainingEvents.id, trainingId))).length, 1);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});
