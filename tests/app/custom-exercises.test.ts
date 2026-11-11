import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { videoEmbedUrl } from "../../src/lib/video-embed.ts";
import { customExerciseSchema } from "../../src/lib/custom-exercises.ts";

const require = createRequire(import.meta.url);
const model = require("../../publiserte/assets/taktikk-rediger-modell.js");
const input = { title: "Pasning", description: "", theme: "", themeSource: "", objectives: "",
  ageMin: 8, ageMax: 9, videoUrl: "", animations: [model.newScene()] };

test("video embedding accepts only supported HTTPS video URLs", () => {
  assert.equal(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=10"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl("https://vimeo.com/12345"), "https://player.vimeo.com/video/12345");
  for (const url of ["https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "javascript:alert(1)",
    "https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ", "http://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/nope"]) {
    assert.equal(videoEmbedUrl(url), null);
  }
});

test("exercise validation checks ages and animation contents", () => {
  assert.equal(customExerciseSchema.safeParse(input).success, true);
  assert.equal(customExerciseSchema.safeParse({ ...input, ageMin: 10, ageMax: 9 }).success, false);
  assert.equal(customExerciseSchema.safeParse({ ...input, animations: [{ frames: [] }] }).success, false);
  assert.equal(customExerciseSchema.safeParse({ ...input, animations: Array(11).fill(model.newScene()) }).success, false);
  assert.equal(customExerciseSchema.safeParse({ ...input, videoUrl: "https://evil.example/video" }).success, false);
});
