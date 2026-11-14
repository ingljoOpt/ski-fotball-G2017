import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "drizzle-orm/pglite/migrator";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { emptySessionPlan } from "../../src/lib/planning.ts";
import { DEFAULT_ACCENT, DEFAULT_PRIMARY } from "../../src/lib/branding.ts";

test("end-time migration preserves legacy durations, overnight slots and historical snapshots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "klubbokter-time-migration-"));
  const database = join(directory, "database");
  const migrations = join(directory, "migrations");
  await mkdir(join(migrations, "meta"), { recursive: true });
  const journal: { version: string; dialect: string; entries: { idx: number; tag: string }[] } =
    JSON.parse(await readFile(join("drizzle", "meta", "_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry) => entry.idx < 4);
  await writeFile(join(migrations, "meta", "_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) {
    await copyFile(join("drizzle", `${entry.tag}.sql`), join(migrations, `${entry.tag}.sql`));
  }
  let connection = await connectLocalDatabase(database);
  const originals: Record<string, unknown>[] = [];
  const originalContexts: Record<string, unknown>[] = [];
  try {
    await migrate(connection.db, { migrationsFolder: migrations });
    const user = await connection.client.query<{ id: string }>("insert into users (email) values ('migration@example.invalid') returning id");
    const club = await connection.client.query<{ id: string }>("insert into clubs (name) values ('Migration test') returning id");
    await connection.client.query("insert into clubs (name, primary_color, accent_color) values ('Custom profile', '#123456', '#abcdef')");
    await connection.client.query("insert into clubs (name, primary_color, accent_color) values ('Former blue', '#0056f5', '#ecf0ea')");
    for (const [startTime, groupDuration, eventDuration] of [["18:00", 75, 45], ["23:30", 90, 120]] as const) {
      const group = await connection.client.query<{ id: string }>(
        "insert into groups (club_id, name, duration_minutes) values ($1, 'Test', $2) returning id", [club.rows[0].id, groupDuration],
      );
      const birthYears = startTime === "18:00" ? [2017, 2017] : [2017, 2018];
      for (const [index, birthYear] of birthYears.entries()) {
        await connection.client.query(
          "insert into annual_plans (club_id, group_id, year, birth_year) values ($1, $2, $3, $4)",
          [club.rows[0].id, group.rows[0].id, 2026 + index, birthYear],
        );
      }
      await connection.client.query(
        "insert into training_times (club_id, group_id, weekday, start_time) values ($1, $2, 3, $3)",
        [club.rows[0].id, group.rows[0].id, startTime],
      );
      const event = await connection.client.query<{ id: string }>(
        "insert into training_events (club_id, group_id, date, start_time, duration_minutes, title) values ($1, $2, '2026-11-04', $3, $4, 'Original') returning id",
        [club.rows[0].id, group.rows[0].id, startTime, eventDuration],
      );
      const snapshot = { date: "2026-11-04", startTime, durationMinutes: eventDuration, title: "Original", theme: "Pasning", objectives: "Opprinnelige mål", status: "planned" };
      originals.push(snapshot);
      const context = { year: 2026, birthYear: 2017, annualObjectives: "Opprinnelig" };
      originalContexts.push(context);
      await connection.client.query(
        "insert into session_versions (club_id, group_id, event_id, version, created_by, origin, event_snapshot, plan, planning_context) values ($1, $2, $3, 1, $4, 'manual', $5::jsonb, $6::jsonb, $7::jsonb)",
        [club.rows[0].id, group.rows[0].id, event.rows[0].id, user.rows[0].id, JSON.stringify(snapshot), JSON.stringify(emptySessionPlan()), JSON.stringify(context)],
      );
    }
    await connection.client.query("insert into groups (club_id, name) values ($1, 'G2017 without history')", [club.rows[0].id]);
    const unknownGroup = await connection.client.query<{ id: string }>("insert into groups (club_id, name) values ($1, 'Unknown cohort') returning id", [club.rows[0].id]);
    await connection.client.query("insert into annual_plans (club_id, group_id, year) values ($1, $2, 2026)", [club.rows[0].id, unknownGroup.rows[0].id]);
    await connection.close();
    await migrateLocalDatabase(database);
    await migrateLocalDatabase(database);
    connection = await connectLocalDatabase(database);
    const profiles = await connection.client.query<{ primary_color: string; accent_color: string }>("select primary_color, accent_color from clubs order by name");
    assert.deepEqual(profiles.rows, [
      { primary_color: "#123456", accent_color: "#abcdef" }, { primary_color: "#0056f5", accent_color: "#ecf0ea" },
      { primary_color: "#176345", accent_color: "#e7d995" },
    ], "default migration never overwrites stored club colors, including the former defaults");
    const fresh = await connection.client.query<{ primary_color: string; accent_color: string }>("insert into clubs (name, slug) values ('New defaults', 'new-defaults') returning primary_color, accent_color");
    assert.deepEqual(fresh.rows[0], { primary_color: DEFAULT_PRIMARY, accent_color: DEFAULT_ACCENT });
    const times = await connection.client.query<{ end_time: string }>("select end_time from training_times order by start_time");
    assert.deepEqual(times.rows.map((row) => row.end_time), ["19:15", "01:00"]);
    const events = await connection.client.query<{ end_time: string; duration_minutes: number }>("select end_time, duration_minutes from training_events order by start_time");
    assert.deepEqual(events.rows, [{ end_time: "18:45", duration_minutes: 45 }, { end_time: "01:30", duration_minutes: 120 }]);
    const versions = await connection.client.query<{ event_snapshot: Record<string, unknown>; plan: unknown }>(
      "select event_snapshot, plan from session_versions order by event_snapshot->>'startTime'",
    );
    const cohorts = await connection.client.query<{ birth_year: number | null }>("select birth_year from groups order by duration_minutes, name");
    assert.deepEqual(cohorts.rows.map((row) => row.birth_year), [null, null, 2017, null], "only consistent historical cohorts are transferred; conflicts and unknown remain unknown");
    const legacy = await connection.client.query<{ birth_year: number | null }>("select birth_year from annual_plans order by year, birth_year");
    assert.deepEqual(legacy.rows.map((row) => row.birth_year), [2017, 2017, null, 2017, 2018], "all legacy annual values remain intact");
    const contexts = await connection.client.query<{ planning_context: Record<string, unknown> }>("select planning_context from session_versions order by event_snapshot->>'startTime'");
    assert.deepEqual(contexts.rows.map((row) => row.planning_context), originalContexts, "historical age context is unchanged");
    for (const [index, version] of versions.rows.entries()) {
      const { endTime, ...original } = version.event_snapshot;
      assert.equal(endTime, events.rows[index].end_time);
      assert.deepEqual(original, originals[index], "original historical values are unchanged");
      assert.deepEqual(version.plan, emptySessionPlan());
    }
  } finally {
    await connection.close();
    await rm(directory, { recursive: true, force: true });
  }
});
