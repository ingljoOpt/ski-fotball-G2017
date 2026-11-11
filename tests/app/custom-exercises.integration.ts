import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { createClub, createGroup, DomainError } from "../../src/lib/domain.ts";
import { listCustomExercises, saveCustomExercise } from "../../src/lib/custom-exercise-domain.ts";

const model = createRequire(import.meta.url)("../../publiserte/assets/taktikk-rediger-modell.js");

test("custom exercises persist and remain isolated by team and revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "custom-exercises-"));
  try {
    await migrateLocalDatabase(directory);
    let connection = await connectLocalDatabase(directory);
    const [admin, outsider] = await connection.db.insert(users).values([
      { email: "exercise-admin@example.invalid" }, { email: "exercise-outsider@example.invalid" },
    ]).returning();
    const club = await createClub(connection.db, admin.id, "Exercise club");
    const { group } = await createGroup(connection.db, admin.id, club.id, "Exercise team", admin.email, 2017);
    const otherClub = await createClub(connection.db, outsider.id, "Other exercise club");
    const { group: other } = await createGroup(connection.db, outsider.id, otherClub.id, "Other team", outsider.email);
    const input = { title: "Pasning", description: "Spill sammen", theme: "", themeSource: "", objectives: "",
      ageMin: 8, ageMax: 10, videoUrl: "https://vimeo.com/12345", animations: [model.newScene(), model.newScene()] };
    const created = await saveCustomExercise(connection.db, admin.id, group.id, "", 0, input);
    await assert.rejects(listCustomExercises(connection.db, outsider.id, group.id), DomainError);
    await assert.rejects(saveCustomExercise(connection.db, outsider.id, other.id, created.id, 1, input), DomainError);
    const updated = await saveCustomExercise(connection.db, admin.id, group.id, created.id, 1, { ...input, title: "Ny tittel" });
    assert.equal(updated.revision, 2);
    await assert.rejects(saveCustomExercise(connection.db, admin.id, group.id, created.id, 1, input), /endret av en annen/);
    await connection.close();
    connection = await connectLocalDatabase(directory);
    try {
      const saved = await listCustomExercises(connection.db, admin.id, group.id);
      assert.equal(saved[0].title, "Ny tittel");
      assert.equal(saved[0].animations.length, 2);
      assert.equal(saved[0].videoUrl, input.videoUrl);
    } finally { await connection.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
