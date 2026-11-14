import { test } from "node:test";
import assert from "node:assert/strict";
import { newAnimation } from "../../src/lib/animation-editor.ts";
import { videoEmbedUrl, videoWatchUrl } from "../../src/lib/video-embed.ts";
import { customExerciseSchema, exerciseThemeSource } from "../../src/lib/custom-exercises.ts";
import { readEquipment, writeEquipment } from "../../src/lib/exercise-equipment.ts";

const input = { title: "Pasning", description: "", theme: "", themeSource: "", objectives: "",
  ageMin: 8, ageMax: 9, videoUrl: "", animations: [newAnimation()] };

test("video embedding accepts only supported HTTPS video URLs", () => {
  assert.equal(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=10"), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl("https://www.youtube.com/embed/F3PEp1QktkU?si=2HvFJHbZA6hiKJEF"), "https://www.youtube.com/embed/F3PEp1QktkU");
  assert.equal(videoEmbedUrl("https://vimeo.com/12345"), "https://player.vimeo.com/video/12345");
  for (const url of ["https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "javascript:alert(1)",
    "https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ", "http://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/nope"]) {
    assert.equal(videoEmbedUrl(url), null);
  }
});

test("video links open the watch page even when an embed URL was supplied", () => {
  assert.equal(videoWatchUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(videoWatchUrl("https://player.vimeo.com/video/12345"), "https://vimeo.com/12345");
  assert.equal(videoWatchUrl("https://youtube.com.evil.example/embed/dQw4w9WgXcQ"), null);
});

test("exercise validation checks ages and animation contents", () => {
  assert.equal(customExerciseSchema.safeParse(input).success, true);
  assert.equal(customExerciseSchema.safeParse({ ...input, ageMin: 10, ageMax: 9 }).success, false);
  assert.equal(customExerciseSchema.safeParse({ ...input, animations: [{ frames: [] }] }).success, false);
  assert.equal(customExerciseSchema.safeParse({ ...input, animations: Array(11).fill(newAnimation()) }).success, false);
  assert.equal(customExerciseSchema.safeParse({ ...input, videoUrl: "https://evil.example/video" }).success, false);
});

test("optional ages and equipment remain optional but validate entered values", () => {
  const optional = { ...input, ageMin: "", ageMax: "", equipment: "4 kjegler" };
  const parsed = customExerciseSchema.parse(optional);
  assert.equal(parsed.ageMin, null);
  assert.equal(parsed.ageMax, null);
  assert.equal(parsed.equipment, "4 kjegler");
  assert.equal(customExerciseSchema.parse({ ...optional, ageMin: "8" }).ageMin, 8);
  assert.equal(customExerciseSchema.safeParse({ ...optional, ageMax: "2" }).success, false);
  assert.equal(customExerciseSchema.safeParse({ ...optional, title: "" }).success, false);
});

test("equipment preserves old text and validates quantities per group", () => {
  const legacy = "4 kjegler til hele laget";
  assert.deepEqual(readEquipment(legacy), { legacy, items: [] });
  const equipment = { legacy, items: [
    { type: "balls" as const, name: "", count: "3" },
    { type: "other" as const, name: "Vester", count: "5" },
  ] };
  const encoded = writeEquipment(equipment);
  assert.deepEqual(readEquipment(encoded), equipment);
  assert.equal(customExerciseSchema.parse({ ...input, equipment: encoded }).equipment, encoded);
  for (const count of ["", "0", "-1", "1.5", "9007199254740992"]) {
    const invalid = writeEquipment({ legacy: "", items: [{ type: "balls", name: "", count }] });
    assert.equal(customExerciseSchema.safeParse({ ...input, equipment: invalid }).success, false);
  }
  const missingName = writeEquipment({ legacy: "", items: [{ type: "other", name: " ", count: "1" }] });
  assert.equal(customExerciseSchema.safeParse({ ...input, equipment: missingName }).success, false);
  const duplicate = writeEquipment({ legacy: "", items: [equipment.items[0], equipment.items[0]] });
  assert.equal(customExerciseSchema.safeParse({ ...input, equipment: duplicate }).success, false);
  assert.equal(readEquipment("klubbokter-utstyr-v1:{"), null);
});

test("custom themes have no invented NFF source and old sources are retained", () => {
  const topics = [{ theme: "Pasning", sourceUrl: "https://tiim.no/pasning" }];
  assert.equal(exerciseThemeSource("pasning", null, topics), topics[0].sourceUrl);
  assert.equal(exerciseThemeSource("Eget tema", null, topics), "");
  assert.equal(exerciseThemeSource("Tidligere", { theme: "Tidligere", themeSource: "https://tiim.no/tidligere" }, topics), "https://tiim.no/tidligere");
  assert.equal(exerciseThemeSource("Endret", { theme: "Tidligere", themeSource: "https://tiim.no/tidligere" }, topics), "");
});
