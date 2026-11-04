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
  assert.deepEqual(positionAt(example, 900).positions.ball, [50, 31]);
  assert.deepEqual(positionAt(example, 1800).positions.ball, [73, 31]);
  assert.deepEqual(positionAt(example, 99999).positions.a, [65, 40]);
  assert.equal(positionAt(example, 3600).index, 2);
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
