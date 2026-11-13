import { test } from "node:test";
import assert from "node:assert/strict";
import { addAnimationFrame, addAnimationObject, animationPosition, newAnimation, readAnimation, removeAnimationObject } from "../../src/lib/animation-editor.ts";

test("redigering bevarer formatet og kopierer posisjoner uavhengig mellom steg", () => {
  const scene = newAnimation();
  const id = addAnimationObject(scene, "smallGoal");
  addAnimationFrame(scene, 0);
  scene.frames[1].positions[id] = [80, 20];
  assert.deepEqual(scene.frames[0].positions[id], [50, 50]);
  assert.deepEqual(animationPosition(scene, 900).positions[id], [65, 35]);
  const saved = readAnimation(scene);
  removeAnimationObject(scene, id);
  assert.equal(saved.objects.some((object) => object.id === id), true);
  assert.equal(Object.hasOwn(scene.frames[1].positions, id), false);
  assert.doesNotThrow(() => readAnimation(scene));
});

test("stegbeskrivelser er valgfrie og kan lagres uten å miste brukerens tekst", () => {
  const scene = newAnimation();
  assert.equal(scene.frames[0].caption, "");
  addAnimationFrame(scene, 0);
  scene.frames[1].caption = "Spill til neste spiller";
  assert.deepEqual(readAnimation(scene).frames.map((frame) => frame.caption), ["", "Spill til neste spiller"]);
});

test("ugyldige lagrede animasjoner og endringer avvises uten å erstatte dem", () => {
  assert.throws(() => readAnimation(null));
  const scene = newAnimation();
  scene.durationMs = 0;
  assert.throws(() => readAnimation(scene));
  assert.equal(scene.durationMs, 0);
});
