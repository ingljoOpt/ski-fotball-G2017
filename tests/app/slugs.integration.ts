import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { clubs, groups, users } from "../../src/db/schema.ts";
import { acceptInvitation, clubBySlug, createClub, createGroup, DomainError, teamBySlug } from "../../src/lib/domain.ts";
import { canonicalDestination } from "../../src/lib/tenant-routing.ts";
import { defaultPlanningPriorities, type PlanningPriority } from "../../src/lib/planning-priorities.ts";

test("unique stable slugs and scoped lookup preserve role and tenant boundaries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "club-slugs-"));
  await migrateLocalDatabase(directory);
  let connection = await connectLocalDatabase(directory);
  try {
    const { db } = connection;
    const [admin, head, outsider] = await db.insert(users).values(
      ["admin", "head", "outsider"].map((name) => ({ email: `${name}@example.invalid` })),
    ).returning();
    const results = await Promise.all([
      createClub(db, admin.id, "Ski IL Fotball"), createClub(db, outsider.id, "Ski IL Fotball"),
    ]);
    assert.equal(new Set(results.map((club) => club.slug)).size, 2);
    assert.ok(results.some((club) => club.slug === "ski-il-fotball"));
    const [club, otherClub] = results;
    const reserved = await createClub(db, admin.id, "Oversikt");
    assert.notEqual(reserved.slug, "oversikt", "static app routes cannot be shadowed");
    const { group, token } = await createGroup(db, admin.id, club.id, "G2017", head.email);
    const { group: duplicate } = await createGroup(db, admin.id, club.id, "G2017", head.email);
    const { group: otherGroup } = await createGroup(db, outsider.id, otherClub.id, "G2017", outsider.email);
    assert.equal(group.slug, "g2017");
    assert.notEqual(duplicate.slug, "g2017");
    assert.equal(otherGroup.slug, "g2017", "team slugs are unique within their club, not globally");
    const { group: reservedTeam } = await createGroup(db, admin.id, club.id, "Innstillinger", head.email);
    assert.notEqual(reservedTeam.slug, "innstillinger");
    await acceptInvitation(db, head.id, token);
    assert.equal((await clubBySlug(db, head.id, club.slug)).id, club.id);
    assert.equal((await teamBySlug(db, head.id, club.slug, group.slug)).group.id, group.id);
    await assert.rejects(teamBySlug(db, head.id, club.slug, duplicate.slug), DomainError);
    await assert.rejects(teamBySlug(db, outsider.id, club.slug, group.slug), DomainError);
    await assert.rejects(teamBySlug(db, head.id, otherClub.slug, group.slug), DomainError);
    await assert.rejects(teamBySlug(db, admin.id, club.slug, "../auth"));
    await assert.rejects(clubBySlug(db, admin.id, "missing-club"), DomainError);
    const base = `/${club.slug}/${group.slug}`;
    assert.equal(await canonicalDestination(db, head.id, `/grupper/${group.id}/arsplan?year=2026&feil=test`), `${base}/aarsplan?year=2026&feil=test`);
    assert.equal(await canonicalDestination(db, admin.id, `/klubber/${club.id}/grupper/ny`), `/${club.slug}/lag/ny`);
    assert.equal(await canonicalDestination(db, admin.id, `/grupper/${group.id}/okter/00000000-0000-4000-8000-000000000001#rediger-okt`),
      `${base}/okter/00000000-0000-4000-8000-000000000001#rediger-okt`);
    await assert.rejects(canonicalDestination(db, outsider.id, `/grupper/${group.id}/innstillinger`), DomainError);
    await db.update(clubs).set({ name: "Renamed club" }).where(eq(clubs.id, club.id));
    await db.update(groups).set({ name: "Renamed team" }).where(eq(groups.id, group.id));
    assert.equal((await teamBySlug(db, head.id, club.slug, group.slug)).group.id, group.id);
    await connection.close();
    await migrateLocalDatabase(directory);
    connection = await connectLocalDatabase(directory);
    assert.equal((await teamBySlug(connection.db, head.id, club.slug, group.slug)).group.id, group.id);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});

test("migration backfills existing names, duplicates and reserved routes without changing data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "slug-migration-"));
  const database = join(directory, "database");
  const migrations = join(directory, "migrations");
  await mkdir(join(migrations, "meta"), { recursive: true });
  const journal = JSON.parse(await readFile(join("drizzle", "meta", "_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 7);
  await writeFile(join(migrations, "meta", "_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) await copyFile(join("drizzle", `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
  let connection = await connectLocalDatabase(database);
  try {
    await migrate(connection.db, { migrationsFolder: migrations });
    const clubRows = await connection.client.query<{ id: string; name: string }>(
      "insert into clubs (name) values ('Æ Ø Å'), ('Æ Ø Å'), ('Klubber'), ('!!!') returning id, name",
    );
    const suffixedId = clubRows.rows.filter((club) => club.name === "Æ Ø Å").map((club) => club.id).sort()[1];
    await connection.client.query("insert into clubs (name) values ($1)", [`ae-o-a-${suffixedId}`]);
    for (const club of clubRows.rows) {
      await connection.client.query("insert into groups (club_id, name, birth_year) values ($1, 'G2017', 2017), ($1, 'G2017', 2017), ($1, 'Brukere', null)", [club.id]);
      const duplicates = await connection.client.query<{ id: string }>("select id from groups where club_id = $1 and name = 'G2017' order by id", [club.id]);
      await connection.client.query("insert into groups (club_id, name) values ($1, $2)", [club.id, `g2017-${duplicates.rows[1].id}`]);
    }
    const originalClubs = await connection.client.query("select * from clubs order by id");
    const originalGroups = await connection.client.query("select * from groups order by id");
    await connection.close();
    await migrateLocalDatabase(database);
    await migrateLocalDatabase(database);
    connection = await connectLocalDatabase(database);
    const migratedClubs = await connection.client.query<{ slug: string }>("select * from clubs order by id");
    const migratedGroups = await connection.client.query<{ slug: string; ai_priorities: PlanningPriority[]; auto_draft_enabled: boolean; general_instructions: string; player_count: number | null; coach_count: number | null; differentiation: { enabled: boolean } }>("select * from groups order by id");
    const withoutSlug = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "slug"));
    assert.deepEqual(migratedClubs.rows.map(withoutSlug), originalClubs.rows);
    const withoutAddedGroupFields = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => !["slug", "ai_priorities", "auto_draft_enabled", "general_instructions", "player_count", "coach_count", "differentiation"].includes(key)));
    assert.deepEqual(migratedGroups.rows.map(withoutAddedGroupFields), originalGroups.rows);
    for (const row of migratedGroups.rows) {
      assert.deepEqual(row.ai_priorities, defaultPlanningPriorities);
      assert.equal(row.auto_draft_enabled, false);
      assert.equal(row.general_instructions, "");
      assert.equal(row.player_count, null);
      assert.equal(row.coach_count, null);
      assert.equal(row.differentiation.enabled, false);
    }
    assert.equal(new Set(migratedClubs.rows.map((row) => row.slug)).size, 5, "suffix-like existing names cannot cause migration collisions");
    assert.ok(migratedClubs.rows.some((row) => row.slug === "ae-o-a"));
    assert.ok(migratedClubs.rows.some((row) => row.slug === "klubb"));
    assert.ok(!migratedClubs.rows.some((row) => row.slug === "klubber"));
    assert.equal(migratedGroups.rows.filter((row) => row.slug === "g2017").length, 4);
    assert.ok(!migratedGroups.rows.some((row) => row.slug === "brukere"));
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});
