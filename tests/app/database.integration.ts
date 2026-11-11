import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { DEFAULT_ACCENT, DEFAULT_PRIMARY } from "../../src/lib/branding.ts";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { clubInvitations, groupMembers, invitations, loginLinks, users } from "../../src/db/schema.ts";
import {
  acceptInvitation, addTrainingTime, consumeLoginLink, createClub, createGroup,
  createLoginLink, DomainError, getGroupAccess, groupDetails, hashToken, inviteCoach,
  listClubs, listClubGroups, removeMember, removeTrainingTime,
  revokeSession, updateGroupSettings, userForSession, acceptClubInvitation,
  cancelClubInvitation, clubAdministration, inviteClubAdmin, removeClubAdmin, transferHeadCoach,
  resetClubBranding, updateClubBranding, updateTrainingTime,
} from "../../src/lib/domain.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";

test("PGlite: migrations, login, invitations and tenant authorization", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "klubbokter-pglite-"));
  await migrateLocalDatabase(directory);
  await migrateLocalDatabase(directory);
  const { client, db, close } = await connectLocalDatabase(directory);
  const rollback = new Error("Rollback synthetic integration data");
  try {
    const migrations = await client.query<{ count: number }>("select count(*)::int as count from drizzle.__drizzle_migrations");
    assert.ok(migrations.rows[0].count > 0, "migrations persist and are not reapplied");
    await assert.rejects(connectLocalDatabase(directory), /låst av en annen prosess/);
    await assert.rejects(db.transaction(async (tx) => {
      const suffix = randomUUID();
      const [admin, head, coach, outsider] = await tx.insert(users).values(
        ["admin", "head", "coach", "outsider"].map((role) => ({ email: `${role}-${suffix}@example.invalid` })),
      ).returning();
      const club = await createClub(tx, admin.id, "Testklubb A");
      assert.equal(club.primaryColor, DEFAULT_PRIMARY);
      assert.equal(club.accentColor, DEFAULT_ACCENT);
      const otherClub = await createClub(tx, outsider.id, "Testklubb B");
      const firstGroup = await createGroup(tx, admin.id, club.id, "G2017", head.email);
      const otherGroup = await createGroup(tx, outsider.id, otherClub.id, "G2018", outsider.email);

      await t.test("single-use login, expiry and logout", async () => {
        const token = await createLoginLink(tx, coach.email);
        const session = await consumeLoginLink(tx, token);
        assert.equal((await userForSession(tx, session.sessionToken))?.id, coach.id);
        await assert.rejects(consumeLoginLink(tx, token), DomainError);
        await revokeSession(tx, session.sessionToken);
        assert.equal(await userForSession(tx, session.sessionToken), null);
        const expired = await createLoginLink(tx, coach.email);
        await tx.update(loginLinks).set({ expiresAt: new Date(0) }).where(eq(loginLinks.tokenHash, hashToken(expired)));
        await assert.rejects(consumeLoginLink(tx, expired), DomainError);
      });

      await t.test("head coach is the first member and invitations bind the email", async () => {
        assert.equal((await groupDetails(tx, admin.id, firstGroup.group.id)).members.length, 0);
        const earlyCoachInvite = await inviteCoach(tx, admin.id, firstGroup.group.id, coach.email);
        await assert.rejects(acceptInvitation(tx, coach.id, earlyCoachInvite.token), DomainError);
        await assert.rejects(acceptInvitation(tx, outsider.id, firstGroup.token), DomainError);
        assert.equal(await acceptInvitation(tx, head.id, firstGroup.token), firstGroup.group.id);
        assert.equal((await getGroupAccess(tx, head.id, firstGroup.group.id)).canManage, true);
        await assert.rejects(acceptInvitation(tx, head.id, firstGroup.token), DomainError);
      });

      await t.test("head invites coaches; regular coaches cannot manage", async () => {
        const invitation = await inviteCoach(tx, head.id, firstGroup.group.id, coach.email);
        await acceptInvitation(tx, coach.id, invitation.token);
        assert.equal((await getGroupAccess(tx, coach.id, firstGroup.group.id)).canManage, false);
        await assert.rejects(inviteCoach(tx, coach.id, firstGroup.group.id, outsider.email), DomainError);
        await assert.rejects(updateGroupSettings(tx, coach.id, firstGroup.group.id, { durationMinutes: 90, generationDaysBefore: 5 }), DomainError);
      });

      await t.test("clubs and groups cannot be accessed across tenants", async () => {
        assert.deepEqual((await listClubs(tx, coach.id)).map((item) => item.id), [club.id]);
        await assert.rejects(listClubGroups(tx, head.id, otherClub.id), DomainError);
        await assert.rejects(getGroupAccess(tx, head.id, otherGroup.group.id), DomainError);
        await assert.rejects(createGroup(tx, head.id, club.id, "Unauthorized", head.email), DomainError);
        await assert.rejects(tx.transaction(async (savepoint) => {
          await savepoint.insert(groupMembers).values({
            clubId: otherClub.id, groupId: firstGroup.group.id, userId: outsider.id, role: "coach",
          });
        }), (error: unknown) => error instanceof Error && error.cause instanceof Error &&
          "code" in error.cause && error.cause.code === "23503");
      });

      await t.test("settings and multiple training times persist", async () => {
        await updateGroupSettings(tx, head.id, firstGroup.group.id, { generationDaysBefore: 4 });
        await addTrainingTime(tx, head.id, firstGroup.group.id, { weekday: 3, startTime: "18:00", endTime: "19:15" });
        await addTrainingTime(tx, head.id, firstGroup.group.id, { weekday: 7, startTime: "11:00", endTime: "12:30" });
        await assert.rejects(addTrainingTime(tx, head.id, firstGroup.group.id, { weekday: 3, startTime: "18:00", endTime: "19:00" }), DomainError);
        const details = await groupDetails(tx, coach.id, firstGroup.group.id);
        assert.deepEqual(details.times.map((time) => time.endTime), ["19:15", "12:30"]);
        assert.equal(details.group.generationDaysBefore, 4);
        assert.equal(details.times.length, 2);
        const changed = { weekday: 4, startTime: "17:00", endTime: "18:30", expectedPlayers: 18, expectedCoaches: 0 };
        await assert.rejects(updateTrainingTime(tx, outsider.id, firstGroup.group.id, details.times[0].id, changed), DomainError);
        await assert.rejects(updateTrainingTime(tx, head.id, firstGroup.group.id, details.times[0].id, { ...changed, endTime: "17:05" }));
        await assert.rejects(updateTrainingTime(tx, head.id, firstGroup.group.id, details.times[0].id, { ...changed, weekday: 7, startTime: "11:00", endTime: "12:00" }), DomainError);
        await updateTrainingTime(tx, head.id, firstGroup.group.id, details.times[0].id, changed);
        const updated = (await groupDetails(tx, head.id, firstGroup.group.id)).times.find((time) => time.id === details.times[0].id)!;
        assert.deepEqual([updated.weekday, updated.startTime, updated.endTime, updated.expectedPlayers, updated.expectedCoaches], [4, "17:00", "18:30", 18, 0]);
        await updateTrainingTime(tx, head.id, firstGroup.group.id, updated.id, { ...changed, expectedPlayers: "", expectedCoaches: "" });
        assert.equal((await groupDetails(tx, head.id, firstGroup.group.id)).times.find((time) => time.id === updated.id)!.expectedPlayers, null);
        await assert.rejects(removeTrainingTime(tx, outsider.id, firstGroup.group.id, details.times[0].id), DomainError);
        await removeTrainingTime(tx, admin.id, firstGroup.group.id, details.times[0].id);
        assert.equal((await groupDetails(tx, head.id, firstGroup.group.id)).times.length, 1);
      });

      await t.test("club profiles authorize admins, isolate tenants and preserve or remove logos", async () => {
        const colors = { primaryColor: "#123456", accentColor: "#fefefe" };
        const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#123456" } }).png().toBuffer();
        const logo = new File([new Uint8Array(png)], "logo.png", { type: "image/png" });
        for (const actor of [head, coach, outsider]) {
          await assert.rejects(updateClubBranding(tx, actor.id, club.id, colors, logo), DomainError);
          await assert.rejects(resetClubBranding(tx, actor.id, club.id), DomainError);
        }
        await updateClubBranding(tx, admin.id, club.id, colors, logo);
        const branded = (await listClubGroups(tx, head.id, club.id)).club;
        assert.equal(branded.primaryColor, colors.primaryColor);
        assert.equal(branded.accentColor, colors.accentColor);
        assert.ok(branded.logoData?.startsWith("data:image/webp;base64,"));
        assert.deepEqual((await groupDetails(tx, coach.id, firstGroup.group.id)).club.logoData, branded.logoData);
        assert.equal((await groupDetails(tx, coach.id, firstGroup.group.id)).club.primaryColor, colors.primaryColor);
        const untouched = (await listClubGroups(tx, outsider.id, otherClub.id)).club;
        assert.equal(untouched.primaryColor, DEFAULT_PRIMARY);
        assert.equal(untouched.accentColor, DEFAULT_ACCENT);
        assert.equal(untouched.logoData, null);
        await assert.rejects(updateClubBranding(tx, admin.id, club.id,
          { ...colors, primaryColor: "#ffffff" }, null), /kontrast/);
        await assert.rejects(updateClubBranding(tx, admin.id, club.id, colors,
          new File(["invalid"], "bad.png", { type: "image/png" })), /gyldig bilde/);
        await assert.rejects(updateClubBranding(tx, admin.id, club.id, colors, logo, true), /ikke begge/);
        assert.equal((await listClubGroups(tx, admin.id, club.id)).club.logoData, branded.logoData);
        await updateClubBranding(tx, admin.id, club.id, { ...colors, accentColor: "#000000" }, null);
        assert.equal((await listClubGroups(tx, admin.id, club.id)).club.logoData, branded.logoData);
        await updateClubBranding(tx, admin.id, club.id, colors, null, true);
        assert.equal((await listClubGroups(tx, admin.id, club.id)).club.logoData, null);
        await updateClubBranding(tx, admin.id, club.id, colors, logo);
        await resetClubBranding(tx, admin.id, club.id);
        const reset = (await listClubGroups(tx, admin.id, club.id)).club;
        assert.equal(reset.primaryColor, DEFAULT_PRIMARY);
        assert.equal(reset.accentColor, DEFAULT_ACCENT);
        assert.equal(reset.logoData, null);
      });

      await t.test("club administrator invitations are scoped, single-use and email-bound", async () => {
        await assert.rejects(inviteClubAdmin(tx, head.id, club.id, coach.email), DomainError);
        await assert.rejects(clubAdministration(tx, coach.id, club.id), DomainError);
        await assert.rejects(inviteClubAdmin(tx, outsider.id, club.id, coach.email), DomainError);
        await assert.rejects(inviteClubAdmin(tx, admin.id, club.id, admin.email), DomainError);
        await assert.rejects(removeClubAdmin(tx, admin.id, club.id, admin.id), /minst én administrator/);
        const invitation = await inviteClubAdmin(tx, admin.id, club.id, head.email);
        assert.equal((await getGroupAccess(tx, head.id, firstGroup.group.id)).isAdmin, false);
        await assert.rejects(acceptClubInvitation(tx, outsider.id, invitation.token), DomainError);
        assert.equal(await acceptClubInvitation(tx, head.id, invitation.token), club.id);
        await assert.rejects(acceptClubInvitation(tx, head.id, invitation.token), DomainError);
        const details = await clubAdministration(tx, head.id, club.id);
        assert.equal(details.admins.length, 2);
        assert.equal(details.pending.length, 0);
        assert.equal((await getGroupAccess(tx, head.id, firstGroup.group.id)).isAdmin, true);
        assert.equal((await listClubs(tx, head.id)).find((item) => item.id === club.id)?.isAdmin, true);
        const separateGroup = await createGroup(tx, admin.id, club.id, "Annen gruppe", admin.email);
        assert.equal((await getGroupAccess(tx, head.id, separateGroup.group.id)).isAdmin, true);
        await assert.rejects(clubAdministration(tx, head.id, otherClub.id), DomainError);
      });

      await t.test("administrator invitations can expire, be replaced and be revoked", async () => {
        const expired = await inviteClubAdmin(tx, admin.id, club.id, coach.email);
        await tx.update(clubInvitations).set({ expiresAt: new Date(0) })
          .where(eq(clubInvitations.tokenHash, hashToken(expired.token)));
        await assert.rejects(acceptClubInvitation(tx, coach.id, expired.token), DomainError);
        const replaced = await inviteClubAdmin(tx, admin.id, club.id, coach.email);
        const replacement = await inviteClubAdmin(tx, admin.id, club.id, coach.email);
        await assert.rejects(acceptClubInvitation(tx, coach.id, replaced.token), DomainError);
        const pending = (await clubAdministration(tx, head.id, club.id)).pending;
        assert.equal(pending.length, 1);
        await assert.rejects(cancelClubInvitation(tx, outsider.id, otherClub.id, pending[0].id), DomainError);
        await assert.rejects(cancelClubInvitation(tx, coach.id, club.id, pending[0].id), DomainError);
        await cancelClubInvitation(tx, head.id, club.id, pending[0].id);
        await assert.rejects(acceptClubInvitation(tx, coach.id, replacement.token), DomainError);
      });

      await t.test("removing an admin preserves group membership and revokes pending grants", async () => {
        const outgoing = await inviteClubAdmin(tx, head.id, club.id, outsider.email);
        const incoming = await inviteClubAdmin(tx, admin.id, club.id, "pending@example.invalid");
        await acceptClubInvitation(tx, (await tx.insert(users).values({ email: incoming.email }).returning())[0].id, incoming.token);
        const regrant = await inviteClubAdmin(tx, admin.id, club.id, coach.email);
        await assert.rejects(removeClubAdmin(tx, outsider.id, club.id, admin.id), DomainError);
        await removeClubAdmin(tx, head.id, club.id, head.id);
        assert.equal((await getGroupAccess(tx, head.id, firstGroup.group.id)).role, "head_coach");
        assert.equal((await getGroupAccess(tx, head.id, firstGroup.group.id)).isAdmin, false);
        await assert.rejects(acceptClubInvitation(tx, outsider.id, outgoing.token), DomainError);
        await assert.rejects(inviteClubAdmin(tx, head.id, club.id, coach.email), DomainError);
        const anotherAdmin = (await clubAdministration(tx, admin.id, club.id)).admins.find((item) => item.userId !== admin.id)!;
        await removeClubAdmin(tx, admin.id, club.id, anotherAdmin.userId);
        await assert.rejects(removeClubAdmin(tx, admin.id, club.id, admin.id), /minst én administrator/);
        // A still-valid invitation from a remaining administrator continues to work.
        await acceptClubInvitation(tx, coach.id, regrant.token);
        await removeClubAdmin(tx, admin.id, club.id, coach.id);
      });

      await t.test("only club administrators can atomically transfer the head coach role", async () => {
        await assert.rejects(transferHeadCoach(tx, head.id, firstGroup.group.id, coach.id), DomainError);
        await assert.rejects(transferHeadCoach(tx, coach.id, firstGroup.group.id, coach.id), DomainError);
        await assert.rejects(transferHeadCoach(tx, outsider.id, firstGroup.group.id, coach.id), DomainError);
        await assert.rejects(transferHeadCoach(tx, admin.id, firstGroup.group.id, outsider.id), DomainError);
        await assert.rejects(transferHeadCoach(tx, admin.id, firstGroup.group.id, head.id), /allerede hovedtrener/);
        const staleToken = "c".repeat(64);
        await tx.insert(invitations).values({
          clubId: club.id, groupId: firstGroup.group.id, email: outsider.email, role: "head_coach",
          tokenHash: hashToken(staleToken), expiresAt: new Date(Date.now() + 86_400_000),
        });
        await transferHeadCoach(tx, admin.id, firstGroup.group.id, coach.id);
        const details = await groupDetails(tx, admin.id, firstGroup.group.id);
        assert.deepEqual(details.members.filter((member) => member.role === "head_coach").map((member) => member.userId), [coach.id]);
        assert.equal((await getGroupAccess(tx, head.id, firstGroup.group.id)).canManage, false);
        assert.equal((await getGroupAccess(tx, coach.id, firstGroup.group.id)).canManage, true);
        await assert.rejects(inviteCoach(tx, head.id, firstGroup.group.id, outsider.email), DomainError);
        await assert.rejects(acceptInvitation(tx, outsider.id, staleToken), DomainError);
        assert.equal((await getGroupAccess(tx, outsider.id, otherGroup.group.id)).isAdmin, true);
        await transferHeadCoach(tx, admin.id, firstGroup.group.id, head.id);
      });

      await t.test("removal revokes access and pending invitations", async () => {
        const pending = { token: "d".repeat(64) };
        await tx.insert(invitations).values({
          clubId: club.id, groupId: firstGroup.group.id, email: coach.email, role: "coach",
          tokenHash: hashToken(pending.token), expiresAt: new Date(Date.now() + 86_400_000),
        });
        await removeMember(tx, head.id, firstGroup.group.id, coach.id);
        await assert.rejects(getGroupAccess(tx, coach.id, firstGroup.group.id), DomainError);
        await assert.rejects(acceptInvitation(tx, coach.id, pending.token), DomainError);
        await assert.rejects(removeMember(tx, head.id, firstGroup.group.id, head.id), DomainError);
        await removeMember(tx, admin.id, firstGroup.group.id, head.id);
        await assert.rejects(getGroupAccess(tx, head.id, firstGroup.group.id), DomainError);
        assert.equal((await getGroupAccess(tx, admin.id, firstGroup.group.id)).isAdmin, true);
      });

      await tx.execute(sql`select 1`);
      throw rollback;
    }), (error) => error === rollback);
    await t.test("simultaneous resignation requests preserve a last administrator", async () => {
      const [first, second] = await db.insert(users).values(
        ["first-admin", "second-admin"].map((name) => ({ email: `${name}@example.invalid` })),
      ).returning();
      const club = await createClub(db, first.id, "Concurrent administration");
      const invitation = await inviteClubAdmin(db, first.id, club.id, second.email);
      await acceptClubInvitation(db, second.id, invitation.token);
      const results = await Promise.allSettled([
        removeClubAdmin(db, first.id, club.id, first.id),
        removeClubAdmin(db, second.id, club.id, second.id),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(rejected?.status === "rejected" && rejected.reason instanceof DomainError);
      const remainingId = results[0].status === "fulfilled" ? second.id : first.id;
      assert.equal((await clubAdministration(db, remainingId, club.id)).admins.length, 1);
    });
  } finally {
    await close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("PGlite persists data and migration history across reopen", async () => {
  const directory = await mkdtemp(join(tmpdir(), "klubbokter-persistence-"));
  try {
    await migrateLocalDatabase(directory);
    const first = await connectLocalDatabase(directory);
    let userId: string;
    let clubId: string;
    let logoData: string | null;
    let migrationCount: number;
    try {
      const [user] = await first.db.insert(users).values({ email: "persistence@example.invalid" }).returning();
      userId = user.id;
      const club = await createClub(first.db, userId, "Persistent club profile");
      clubId = club.id;
      const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).png().toBuffer();
      await updateClubBranding(first.db, userId, clubId, { primaryColor: "#123456", accentColor: "#abcdef" },
        new File([new Uint8Array(png)], "logo.png", { type: "image/png" }));
      logoData = (await listClubGroups(first.db, userId, clubId)).club.logoData;
      const result = await first.client.query<{ count: number }>("select count(*)::int as count from drizzle.__drizzle_migrations");
      migrationCount = result.rows[0].count;
    } finally {
      await first.close();
    }
    await migrateLocalDatabase(directory);
    const second = await connectLocalDatabase(directory);
    try {
      const [user] = await second.db.select().from(users).where(eq(users.id, userId));
      assert.equal(user.email, "persistence@example.invalid");
      const club = (await listClubGroups(second.db, userId, clubId)).club;
      assert.equal(club.primaryColor, "#123456");
      assert.equal(club.accentColor, "#abcdef");
      assert.equal(club.logoData, logoData);
      const result = await second.client.query<{ count: number }>("select count(*)::int as count from drizzle.__drizzle_migrations");
      assert.equal(result.rows[0].count, migrationCount);
    } finally {
      await second.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
