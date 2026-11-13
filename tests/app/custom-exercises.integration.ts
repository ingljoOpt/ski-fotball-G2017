import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { migrate } from "drizzle-orm/pglite/migrator";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, createClub, createGroup, DomainError, inviteCoach, removeMember } from "../../src/lib/domain.ts";
import { getCustomExercise, listCustomExercises, saveCustomExercise } from "../../src/lib/custom-exercise-domain.ts";
import { readEquipment, writeEquipment } from "../../src/lib/exercise-equipment.ts";

const model = createRequire(import.meta.url)("../../publiserte/assets/taktikk-rediger-modell.js");

test("migration preserves existing exercises and permits optional ages", async () => {
  const directory = await mkdtemp(join(tmpdir(), "custom-exercise-migration-"));
  const migrations = join(directory, "migrations");
  const database = join(directory, "database");
  try {
    await cp("drizzle", migrations, { recursive: true });
    const journalPath = join(migrations, "meta", "_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.filter((entry: { tag: string }) => entry.tag !== "0021_blushing_korg");
    await writeFile(journalPath, JSON.stringify(journal));
    let connection = await connectLocalDatabase(database);
    try {
      await migrate(connection.db, { migrationsFolder: migrations });
      const [admin] = await connection.db.insert(users).values({ email: "migration@example.invalid" }).returning();
      const club = await createClub(connection.db, admin.id, "Migration club");
      const { group } = await createGroup(connection.db, admin.id, club.id, "Migration team", admin.email);
      await connection.client.query(
        `insert into custom_exercises (club_id, group_id, title, description, age_min, age_max)
         values ($1, $2, 'Eksisterende', 'Beholdes', 8, 9)`,
        [club.id, group.id],
      );
    } finally { await connection.close(); }
    await migrateLocalDatabase(database);
    connection = await connectLocalDatabase(database);
    try {
      const result = await connection.client.query<{ title: string; description: string; age_min: number; age_max: number; equipment: string }>(
        "select title, description, age_min, age_max, equipment from custom_exercises",
      );
      assert.deepEqual(result.rows, [{ title: "Eksisterende", description: "Beholdes", age_min: 8, age_max: 9, equipment: "" }]);
      await connection.client.query("update custom_exercises set age_min = null, age_max = null, equipment = 'Kjegler'");
      await assert.rejects(connection.client.query("update custom_exercises set age_min = 10, age_max = 8"));
    } finally { await connection.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("custom exercises persist and remain isolated by team and revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "custom-exercises-"));
  try {
    await migrateLocalDatabase(directory);
    let connection = await connectLocalDatabase(directory);
    const [admin, outsider, head, coach] = await connection.db.insert(users).values([
      { email: "exercise-admin@example.invalid" }, { email: "exercise-outsider@example.invalid" },
      { email: "exercise-head@example.invalid" }, { email: "exercise-coach@example.invalid" },
    ]).returning();
    const club = await createClub(connection.db, admin.id, "Exercise club");
    const { group, token } = await createGroup(connection.db, admin.id, club.id, "Exercise team", head.email, 2017);
    await acceptInvitation(connection.db, head.id, token);
    const invitation = await inviteCoach(connection.db, head.id, group.id, coach.email);
    await acceptInvitation(connection.db, coach.id, invitation.token);
    const otherClub = await createClub(connection.db, outsider.id, "Other exercise club");
    const { group: other } = await createGroup(connection.db, outsider.id, otherClub.id, "Other team", outsider.email);
    const input = { title: "Pasning", description: "Spill sammen", theme: "", themeSource: "", objectives: "",
      ageMin: 8, ageMax: 10, videoUrl: "https://vimeo.com/12345", animations: [model.newScene(), model.newScene()] };
    const created = await saveCustomExercise(connection.db, admin.id, group.id, "", 0, input);
    const optional = await saveCustomExercise(connection.db, head.id, group.id, "", 0, {
      ...input, title: "Bare navn", description: "", ageMin: "", ageMax: "", videoUrl: "", animations: [], equipment: "4 kjegler og 2 småmål",
    });
    assert.equal(optional.ageMin, null);
    assert.equal(optional.ageMax, null);
    const equipment = { legacy: "4 kjegler og 2 småmål", items: [{ type: "balls" as const, name: "", count: "2" }] };
    await saveCustomExercise(connection.db, head.id, group.id, optional.id, 1, {
      ...input, title: "Bare navn", description: "", ageMin: "", ageMax: "", videoUrl: "", animations: [],
      equipment: writeEquipment(equipment),
    });
    assert.equal((await getCustomExercise(connection.db, admin.id, group.id, created.id))?.title, "Pasning");
    assert.equal(await getCustomExercise(connection.db, outsider.id, other.id, created.id), null);
    await assert.rejects(getCustomExercise(connection.db, outsider.id, group.id, created.id), DomainError);
    await assert.rejects(getCustomExercise(connection.db, admin.id, group.id, "ugyldig-id"));
    await assert.rejects(listCustomExercises(connection.db, outsider.id, group.id), DomainError);
    await assert.rejects(saveCustomExercise(connection.db, outsider.id, other.id, created.id, 1, input), DomainError);
    await assert.rejects(saveCustomExercise(connection.db, admin.id, group.id, created.id, 1, input), /Bare trenere/);
    const updated = await saveCustomExercise(connection.db, coach.id, group.id, created.id, 1, { ...input, title: "Ny tittel" });
    assert.equal(updated.revision, 2);
    await assert.rejects(saveCustomExercise(connection.db, head.id, group.id, created.id, 1, input), /endret av en annen/);
    await removeMember(connection.db, head.id, group.id, coach.id);
    await assert.rejects(saveCustomExercise(connection.db, coach.id, group.id, created.id, 2, input), DomainError);
    await connection.close();
    connection = await connectLocalDatabase(directory);
    try {
      const saved = await listCustomExercises(connection.db, admin.id, group.id);
      const savedUpdated = saved.find((item) => item.id === created.id);
      assert.equal(savedUpdated?.title, "Ny tittel");
      assert.equal(savedUpdated?.animations.length, 2);
      assert.equal(savedUpdated?.videoUrl, input.videoUrl);
      assert.deepEqual(readEquipment(saved.find((item) => item.id === optional.id)?.equipment ?? ""), equipment);
      assert.equal(saved.find((item) => item.id === optional.id)?.ageMin, null);
      assert.equal((await getCustomExercise(connection.db, admin.id, group.id, created.id))?.title, "Ny tittel");
    } finally { await connection.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
