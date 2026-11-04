'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateScene, positionAt } = require('../publiserte/assets/taktikk.js');

const example = JSON.parse(fs.readFileSync(path.join(__dirname, '../publiserte/media/taktikk/firkant-pasning.json'), 'utf8'));
const copy = () => structuredClone(example);

test('eksempelet har gyldige objekter og steg', () => {
  assert.equal(validateScene(example), example);
  assert.equal(example.objects.filter((item) => item.type === 'player').length, 5);
  assert.equal(example.objects.filter((item) => item.type === 'cone').length, 4);
  assert.equal(example.objects.filter((item) => item.type === 'ball').length, 1);
});

test('posisjoner interpoleres og begrenses ved start og slutt', () => {
  assert.deepEqual(positionAt(example, -1).positions.ball, [27, 31]);
  assert.deepEqual(positionAt(example, 900).positions.ball, [49.5, 33]);
  assert.deepEqual(positionAt(example, 1800).positions.ball, [72, 35]);
  assert.deepEqual(positionAt(example, 99999).positions.a, [60, 45]);
  assert.deepEqual(positionAt(example, 99999).positions.ball, [78, 61]);
  assert.equal(positionAt(example, 3600).index, 2);
});

test('B mottar, runder kjeglen med ball og spiller videre til C', () => {
  const frames = example.frames;
  const cone = frames[1].positions.k2;
  const pitchDistance = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.7);

  assert.ok(pitchDistance(frames[1].positions.b, frames[1].positions.ball) <= 6);
  assert.ok(frames[1].positions.b[1] > cone[1]);
  assert.ok(frames[3].positions.b[0] > cone[0]);
  assert.ok(frames[4].positions.b[1] < cone[1]);
  assert.ok(frames[5].positions.b[0] < cone[0]);
  assert.ok(frames[7].positions.b[1] > cone[1]);

  for (let time = example.durationMs; time <= 7 * example.durationMs; time += 90) {
    const positions = positionAt(example, time).positions;
    assert.ok(pitchDistance(positions.b, positions.ball) >= 5.3 && pitchDistance(positions.b, positions.ball) <= 6.1,
      `Ballen er ikke synlig nær B ved ${time} ms`);
    assert.ok(pitchDistance(positions.b, cone) > 6.5, `B passerer gjennom kjeglen ved ${time} ms`);
    assert.ok(pitchDistance(positions.ball, cone) > 4.8, `Ballen passerer gjennom kjeglen ved ${time} ms`);
  }
  assert.ok(pitchDistance(frames[8].positions.ball, frames[8].positions.c) < 6);
  assert.ok(pitchDistance(frames[8].positions.ball, frames[8].positions.c) <
    pitchDistance(frames[7].positions.ball, frames[7].positions.c));
  assert.ok(pitchDistance(frames[9].positions.b, frames[9].positions.c) <
    pitchDistance(frames[8].positions.b, frames[8].positions.c));
});

test('ufullstendige eller ugyldige tavler avvises med forklaring', () => {
  const missing = copy();
  delete missing.frames[0].positions.ball;
  assert.throws(() => validateScene(missing), /alle objektene/);
  const duplicate = copy();
  duplicate.objects[1].id = duplicate.objects[0].id;
  assert.throws(() => validateScene(duplicate), /unik id/);
  const invalidType = copy();
  invalidType.objects[0].type = 'goal';
  assert.throws(() => validateScene(invalidType), /Ukjent objekttype/);
  const invalidPoint = copy();
  invalidPoint.frames[0].positions.ball = [101, 2];
  assert.throws(() => validateScene(invalidPoint), /koordinater/);
  const invalidDuration = copy();
  invalidDuration.durationMs = 0;
  assert.throws(() => validateScene(invalidDuration), /durationMs/);
});

test('én ramme fungerer som en statisk tavle', () => {
  const still = copy();
  still.frames = [still.frames[0]];
  validateScene(still);
  assert.equal(positionAt(still, 90000).index, 0);
  assert.deepEqual(positionAt(still, 90000).positions.ball, [27, 31]);
});
