import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { coaches, groupMembers, invitations, sessionVersions, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import {
  acceptInvitation, createClub, createGroup, DomainError, getGroupAccess, groupDetails, hashToken,
  inviteCoach, inviteRegisteredCoach, removeCoach, saveCoach,
} from "../../src/lib/domain.ts";
import { createTrainingEvent, saveSessionPlan, sessionCoaches, trainingEventDetails } from "../../src/lib/planning-domain.ts";
import { emptySessionPlan } from "../../src/lib/planning.ts";

test("team coaches can plan without accounts and gain access only by accepting an invitation", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "klubbokter-coaches-"));
  await migrateLocalDatabase(directory);
  const { db, close } = await connectLocalDatabase(directory);
  try {
    const [admin, head, member, guest, outsider] = await db.insert(users).values(
      ["admin", "head", "member", "guest", "outsider"].map((name) => ({ email: `${name}@example.invalid` })),
    ).returning();
    const club = await createClub(db, admin.id, "Testklubb");
    const otherClub = await createClub(db, outsider.id, "Annen testklubb");
    const { group, token } = await createGroup(db, admin.id, club.id, "Testlag", head.email);
    const { group: sibling } = await createGroup(db, admin.id, club.id, "Annet lag", admin.email);
    const { group: foreign } = await createGroup(db, outsider.id, otherClub.id, "Annet lag", outsider.email);
    await acceptInvitation(db, head.id, token);
    await acceptInvitation(db, member.id, (await inviteCoach(db, head.id, group.id, member.email)).token);
    const offline = await saveCoach(db, head.id, group.id, { name: "Testtrener", email: "" });
    const joining = await saveCoach(db, admin.id, group.id, { name: "Invitert testtrener", email: guest.email });
    let eventId: string;

    await t.test("registration is team-scoped, validates input and grants no account access", async () => {
      const details = await groupDetails(db, member.id, group.id);
      assert.equal(details.coaches.length, 4);
      assert.equal(details.members.length, 2);
      assert.equal(details.coaches.find((coach) => coach.id === offline)?.email, null);
      assert.equal(details.coaches.find((coach) => coach.id === joining)?.userId, null);
      assert.equal((await groupDetails(db, admin.id, sibling.id)).coaches.length, 0);
      await assert.rejects(getGroupAccess(db, guest.id, group.id), DomainError);
      await assert.rejects(saveCoach(db, member.id, group.id, { name: "Test", email: "" }), DomainError);
      await assert.rejects(saveCoach(db, outsider.id, group.id, { name: "Test", email: "" }), DomainError);
      await assert.rejects(saveCoach(db, head.id, group.id, { name: "X", email: "" }));
      await assert.rejects(saveCoach(db, head.id, group.id, { name: "Test", email: "ugyldig" }));
      await assert.rejects(saveCoach(db, head.id, group.id, { name: "Duplikat", email: guest.email.toUpperCase() }), /allerede registrert/);
      await assert.rejects(saveCoach(db, admin.id, sibling.id, { name: "Test", email: "" }, offline), DomainError);
      await assert.rejects(removeCoach(db, admin.id, sibling.id, offline), DomainError);
      await assert.rejects(inviteRegisteredCoach(db, admin.id, sibling.id, offline), DomainError);
      await assert.rejects(removeCoach(db, outsider.id, foreign.id, offline), DomainError);
      await assert.rejects(inviteRegisteredCoach(db, head.id, group.id, offline), /e-postadresse/);
      assert.equal((await db.select().from(invitations)).filter((invite) => invite.email === guest.email).length, 0);
    });

    await t.test("offline coaches are selectable and counted without changing account permissions", async () => {
      const input = { date: "2026-11-18", startTime: "18:00", endTime: "19:00", title: "Testøkt", theme: "", objectives: "" };
      eventId = await createTrainingEvent(db, head.id, group.id, input);
      const details = await trainingEventDetails(db, member.id, group.id, eventId);
      assert.equal(details.versions[0].plan.confirmedCoaches, 4);
      assert.deepEqual(new Set(details.versions[0].plan.coachIds), new Set([head.id, member.id, offline, joining]));
      assert.equal(details.versions[0].plan.coachAttendanceConfirmed, undefined);
      assert.equal(details.coaches.find((coach) => coach.id === offline)?.name, "Testtrener");
      await saveSessionPlan(db, member.id, group.id, eventId, input,
        { ...details.versions[0].plan, confirmedCoaches: 1, coachIds: [offline] }, 1, "draft");
      assert.deepEqual((await trainingEventDetails(db, head.id, group.id, eventId)).versions[0].plan.coachIds, [offline]);
      await assert.rejects(createTrainingEvent(db, admin.id, sibling.id, input, null, false, "", [offline]), /medlemmer/);
    });

    await t.test("email can be added later but cannot be changed or removed; names remain editable", async () => {
      await saveCoach(db, head.id, group.id, { name: "Uten e-post", email: "" }, offline);
      await saveCoach(db, head.id, group.id, { name: "Endret testtrener", email: "offline@example.invalid" }, offline);
      await assert.rejects(saveCoach(db, head.id, group.id, { name: "Feil navn", email: "annen@example.invalid" }, offline), /kan ikke endres eller fjernes/);
      const invitation = await inviteRegisteredCoach(db, head.id, group.id, offline);
      await assert.rejects(saveCoach(db, head.id, group.id, { name: "Feil navn", email: "" }, offline), /kan ikke endres eller fjernes/);
      assert.equal((await db.select().from(invitations).where(eq(invitations.tokenHash,
        hashToken(invitation.token)))).length, 1);
      await saveCoach(db, head.id, group.id, { name: "Endret testtrener", email: "OFFLINE@example.invalid" }, offline);
      const selected = (await trainingEventDetails(db, head.id, group.id, eventId)).versions[0];
      assert.deepEqual(selected.plan.coachIds, [offline]);
      assert.equal((await sessionCoaches(db, group.id)).find((coach) => coach.id === offline)?.name, "Endret testtrener");
    });

    await t.test("invitation is single-use, email-bound and preserves the registered coach identity", async () => {
      await assert.rejects(inviteRegisteredCoach(db, member.id, group.id, joining), DomainError);
      const first = await inviteRegisteredCoach(db, head.id, group.id, joining);
      const second = await inviteRegisteredCoach(db, head.id, group.id, joining);
      await assert.rejects(acceptInvitation(db, guest.id, first.token), DomainError);
      await assert.rejects(acceptInvitation(db, outsider.id, second.token), DomainError);
      await assert.rejects(getGroupAccess(db, guest.id, group.id), DomainError);
      await acceptInvitation(db, guest.id, second.token);
      await assert.rejects(acceptInvitation(db, guest.id, second.token), DomainError);
      assert.equal((await getGroupAccess(db, guest.id, group.id)).canManage, false);
      const details = await groupDetails(db, head.id, group.id);
      assert.equal(details.coaches.length, 4);
      assert.equal(details.members.length, 3);
      assert.deepEqual(details.coaches.find((coach) => coach.id === joining),
        { id: joining, name: "Invitert testtrener", email: guest.email, userId: guest.id, role: "coach" });
      assert.ok((await sessionCoaches(db, group.id)).some((coach) => coach.id === joining));
      await assert.rejects(inviteRegisteredCoach(db, head.id, group.id, joining), /allerede tilgang/);
      await assert.rejects(saveCoach(db, head.id, group.id, { name: "Test", email: "" }, joining), /kan ikke endres eller fjernes/);
      await assert.rejects(saveCoach(db, head.id, group.id, { name: "Test", email: "ny@example.invalid" }, joining), /kan ikke endres eller fjernes/);
      await saveCoach(db, head.id, group.id, { name: "Nytt navn", email: guest.email }, joining);
    });

    await t.test("removal revokes membership or pending invitations and preserves historical selections", async () => {
      await assert.rejects(removeCoach(db, member.id, group.id, offline), DomainError);
      await assert.rejects(removeCoach(db, head.id, group.id, head.id), DomainError);
      await removeCoach(db, head.id, group.id, joining);
      await assert.rejects(getGroupAccess(db, guest.id, group.id), DomainError);
      const [offlineUser] = await db.insert(users).values({ email: "offline@example.invalid" }).returning();
      const invite = await inviteRegisteredCoach(db, head.id, group.id, offline);
      await removeCoach(db, head.id, group.id, offline);
      await assert.rejects(acceptInvitation(db, offlineUser.id, invite.token), DomainError);
      assert.equal((await sessionCoaches(db, group.id)).length, 2);
      assert.deepEqual((await trainingEventDetails(db, head.id, group.id, eventId)).versions[0].plan.coachIds, [offline]);
      await removeCoach(db, admin.id, group.id, head.id);
      await assert.rejects(getGroupAccess(db, head.id, group.id), DomainError);
    });
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("coach migration preserves existing memberships, invitations and coach IDs across teams", async () => {
  const directory = await mkdtemp(join(tmpdir(), "klubbokter-coach-migration-"));
  const database = join(directory, "database");
  const migrations = join(directory, "migrations");
  await mkdir(join(migrations, "meta"), { recursive: true });
  const journal: { entries: { idx: number; tag: string }[] } =
    JSON.parse(await readFile(join("drizzle", "meta", "_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry) => entry.idx < 19);
  await writeFile(join(migrations, "meta", "_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) await copyFile(join("drizzle", `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
  let connection = await connectLocalDatabase(database);
  try {
    await migrate(connection.db, { migrationsFolder: migrations });
    const [user] = await connection.db.insert(users).values({ email: "migration@example.invalid" }).returning();
    const club = await createClub(connection.db, user.id, "Migreringstest");
    const first = await createGroup(connection.db, user.id, club.id, "Første lag", user.email);
    const second = await createGroup(connection.db, user.id, club.id, "Andre lag", user.email);
    await connection.db.insert(groupMembers).values([first, second].map(({ group }) => ({
      clubId: club.id, groupId: group.id, userId: user.id, role: "head_coach" as const,
    })));
    const event = await connection.client.query<{ id: string }>(
      "insert into training_events (club_id, group_id, date, start_time, end_time, duration_minutes, title) values ($1, $2, '2026-11-18', '18:00', '19:00', 60, 'Historisk testøkt') returning id",
      [club.id, first.group.id],
    );
    await connection.client.query(
      "insert into session_versions (club_id, group_id, event_id, version, created_by, origin, event_snapshot, plan, planning_context) values ($1, $2, $3, 1, $4, 'manual', $5::jsonb, $6::jsonb, $7::jsonb)",
      [club.id, first.group.id, event.rows[0].id, user.id,
        JSON.stringify({ date: "2026-11-18", startTime: "18:00", endTime: "19:00", durationMinutes: 60, title: "Historisk testøkt", theme: "", objectives: "", status: "draft" }),
        JSON.stringify({ ...emptySessionPlan(), coachIds: [user.id], confirmedCoaches: 1 }),
        JSON.stringify({ year: 2026, birthYear: null, annualObjectives: "", periods: [] })],
    );
    const beforeMembers = await connection.db.select().from(groupMembers);
    const beforeInvitations = await connection.db.select().from(invitations);
    const beforeVersions = await connection.db.select().from(sessionVersions);
    await connection.close();
    await migrateLocalDatabase(database);
    await migrateLocalDatabase(database);
    connection = await connectLocalDatabase(database);
    assert.deepEqual(await connection.db.select().from(groupMembers), beforeMembers);
    assert.deepEqual(await connection.db.select().from(invitations), beforeInvitations);
    assert.deepEqual(await connection.db.select().from(sessionVersions), beforeVersions);
    for (const { group } of [first, second]) {
      assert.deepEqual(await sessionCoaches(connection.db, group.id), [{ id: user.id, name: user.email }]);
      const [coach] = await connection.db.select().from(coaches).where(eq(coaches.groupId, group.id));
      assert.equal(coach.userId, user.id);
    }
  } finally {
    await connection.close();
    await rm(directory, { recursive: true, force: true });
  }
});
