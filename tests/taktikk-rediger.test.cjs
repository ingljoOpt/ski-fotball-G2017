'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../publiserte/assets/taktikk-rediger-modell.js');
const { validateScene } = require('../publiserte/assets/taktikk.js');

test('ny tavle kan vises og inneholder spiller, kjegle og ball', () => {
  const scene = model.newScene();
  assert.equal(validateScene(scene), scene);
  assert.deepEqual(scene.objects.map((object) => object.type), ['player', 'cone', 'ball']);
});

test('kopiering og sletting av steg bevarer uavhengige posisjoner og rekkefølge', () => {
  const scene = model.newScene();
  const id = scene.objects[0].id;
  assert.equal(model.addFrame(scene, 0), 1);
  model.moveObject(scene, 1, id, [75, 25]);
  assert.deepEqual(scene.frames[0].positions[id], [30, 50]);
  assert.equal(model.addFrame(scene, 0), 1);
  assert.deepEqual(scene.frames[1].positions[id], [30, 50]);
  assert.deepEqual(scene.frames[2].positions[id], [75, 25]);
  assert.equal(model.removeFrame(scene, 1), 1);
  assert.deepEqual(scene.frames[1].positions[id], [75, 25]);
  model.removeFrame(scene, 1);
  assert.throws(() => model.removeFrame(scene, 0), /minst ett steg/);
  validateScene(scene);
});

test('figurer legges til og fjernes i alle steg uten å dele koordinater', () => {
  const scene = model.newScene();
  model.addFrame(scene, 0);
  const id = model.addObject(scene, 'player', 'B');
  assert.equal(id, 'spiller2');
  model.moveObject(scene, 0, id, [10, 90]);
  assert.deepEqual(scene.frames[1].positions[id], [50, 50]);
  validateScene(scene);
  model.removeObject(scene, id);
  assert.ok(scene.frames.every((frame) => !Object.hasOwn(frame.positions, id)));
  validateScene(scene);
});

test('ugyldige endringer og fjerning av siste figur avvises', () => {
  const scene = model.newScene();
  assert.throws(() => model.addObject(scene, 'unknown', ''), /Ukjent figurtype/);
  assert.throws(() => model.addObject(scene, 'player', 'ABCD'), /maks tre tegn/);
  assert.throws(() => model.moveObject(scene, 0, 'ball1', [101, 2]), /mellom 0 og 100/);
  assert.throws(() => model.moveObject(scene, 0, 'mangler', [2, 2]), /finnes ikke/);
  assert.throws(() => model.removeObject(scene, 'mangler'), /finnes ikke/);
  model.removeObject(scene, 'ball1');
  model.removeObject(scene, 'kjegle1');
  assert.throws(() => model.removeObject(scene, 'spiller1'), /minst én figur/);
  validateScene(scene);
});

test('småmål og store mål legges til og fjernes i alle steg', () => {
  const scene = model.newScene();
  model.addFrame(scene, 0);
  const small = model.addObject(scene, 'smallGoal', '');
  const large = model.addObject(scene, 'goal', '');
  scene.objects.find((object) => object.id === small).rotation = 90;
  scene.objects.find((object) => object.id === large).rotation = 270;
  assert.ok(scene.frames.every((frame) => frame.positions[small] && frame.positions[large]));
  validateScene(JSON.parse(JSON.stringify(scene)));
  model.removeObject(scene, small);
  assert.ok(scene.frames.every((frame) => !Object.hasOwn(frame.positions, small)));
  validateScene(scene);
});

test('markeringskjegler lagres og flyttes mellom steg på samme måte som andre figurer', () => {
  const scene = model.newScene();
  model.addFrame(scene, 0);
  const id = model.addObject(scene, 'markerCone', '');
  const nextId = model.addObject(scene, 'markerCone', '');
  assert.equal(id, 'markeringskjegle1');
  assert.equal(nextId, 'markeringskjegle2');
  model.moveObject(scene, 1, id, [20, 70]);
  const reopened = JSON.parse(JSON.stringify(scene));
  validateScene(reopened);
  assert.equal(reopened.objects.find((object) => object.id === id).type, 'markerCone');
  assert.deepEqual(reopened.frames[0].positions[id], [50, 50]);
  assert.deepEqual(reopened.frames[1].positions[id], [20, 70]);
  model.removeObject(reopened, id);
  assert.ok(reopened.frames.every((frame) => !Object.hasOwn(frame.positions, id)));
  validateScene(reopened);
});
