'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateScene, positionAt, mount } = require('../publiserte/assets/taktikk.js');

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

test('avspilling, pause og tilbakestilling fungerer også med redusert bevegelse', async (t) => {
  const saved = new Map(['document', 'window', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame']
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  function element() {
    return {
      attributes: {}, children: [], listeners: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { this.children.push(child); },
      replaceChildren(child) { this.children = [child]; },
      addEventListener(name, callback) { this.listeners[name] = callback; }
    };
  }
  const nodes = Object.fromEntries(['message', 'canvas', 'controls', 'play', 'reset', 'step']
    .map((name) => [name, element()]));
  const board = {
    dataset: { tacticSrc: '/example.json' },
    querySelector(selector) { return nodes[selector.slice('[data-tactic-'.length, -1)]; },
    closest() { return null; }
  };
  const callbacks = new Map();
  let nextId = 0;
  globalThis.document = { createElementNS: () => element(), addEventListener() {} };
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  globalThis.fetch = async () => ({ ok: true, json: async () => example });
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    callbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => callbacks.delete(id);
  const tick = (time) => {
    const [id, callback] = callbacks.entries().next().value;
    callbacks.delete(id);
    callback(time);
  };

  await mount(board);
  const ball = nodes.canvas.children[0].children.find((child) => child.attributes.class === 'tactic-ball');
  assert.equal(callbacks.size, 0, 'animasjonen skal ikke starte automatisk');
  assert.equal(ball.attributes.transform, 'translate(27 21.7)');
  nodes.play.listeners.click();
  assert.equal(nodes.play.attributes['aria-label'], 'Pause animasjonen');
  assert.equal(nodes.play.attributes['data-playing'], 'true');
  tick(0);
  tick(900);
  assert.equal(ball.attributes.transform, 'translate(49.5 23.099999999999998)');
  nodes.play.listeners.click();
  assert.equal(callbacks.size, 0);
  assert.equal(nodes.play.attributes['aria-label'], 'Spill av animasjonen');
  nodes.reset.listeners.click();
  assert.equal(ball.attributes.transform, 'translate(27 21.7)');
  assert.match(nodes.step.textContent, /^Steg 1 av 10:/);
  nodes.play.listeners.click();
  tick(1000);
  tick(1000 + (example.frames.length - 1) * example.durationMs);
  assert.equal(callbacks.size, 0);
  assert.equal(nodes.play.attributes['data-playing'], 'false');
  assert.match(nodes.step.textContent, /^Steg 10 av 10:/);
  nodes.play.listeners.click();
  assert.equal(ball.attributes.transform, 'translate(27 21.7)');
  nodes.reset.listeners.click();
  assert.equal(callbacks.size, 0);
});
