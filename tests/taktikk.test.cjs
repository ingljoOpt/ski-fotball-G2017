'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateScene, positionAt, pitchDimensions, objectTransform, renderPitch, mount, mountScene } = require('../publiserte/assets/taktikk.js');

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
  assert.deepEqual(positionAt(example, 900).positions.ball, [34.5, 30]);
  assert.deepEqual(positionAt(example, 1800).positions.ball, [42, 29]);
  assert.deepEqual(positionAt(example, 99999).positions.a, [90, 23]);
  assert.deepEqual(positionAt(example, 99999).positions.ball, [28, 69]);
  assert.equal(positionAt(example, 3600).index, 2);
});

test('B og C møter pasningene, vender rundt kjeglene og spiller videre', () => {
  const frames = example.frames;
  const bCone = frames[0].positions.k2;
  const cCone = frames[0].positions.k3;
  const pitchDistance = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.7);

  assert.ok(frames[0].positions.b[0] > bCone[0]);
  assert.ok(frames[3].positions.b[0] < bCone[0]);
  assert.ok(frames[5].positions.b[1] < bCone[1]);
  assert.ok(frames[8].positions.b[1] > bCone[1]);
  assert.ok(frames[0].positions.c[1] > cCone[1]);
  assert.ok(frames[11].positions.c[1] < cCone[1]);
  assert.ok(frames[13].positions.c[0] > cCone[0]);
  assert.ok(frames[14].positions.c[1] > cCone[1]);
  assert.ok(frames[15].positions.c[0] < cCone[0]);

  for (const [first, last, player, cone] of [[3, 8, 'b', bCone], [11, 15, 'c', cCone]]) {
    for (let index = first; index < last; index++) {
      for (const id of [player, 'ball']) {
        const current = frames[index].positions[id];
        const next = frames[index + 1].positions[id];
        const cross = (current[0] - cone[0]) * (next[1] - cone[1]) -
          (current[1] - cone[1]) * (next[0] - cone[0]);
        assert.ok(cross > 0, `${id} runder feil vei i steg ${index + 1}`);
      }
    }
    for (let time = first * example.durationMs; time <= last * example.durationMs; time += 90) {
      const positions = positionAt(example, time).positions;
      const distance = pitchDistance(positions[player], positions.ball);
      assert.ok(distance >= 5.3 && distance <= 6.1, `${player} har ikke ballen nær seg ved ${time} ms`);
      assert.ok(pitchDistance(positions.ball, cone) > 4.8, `Ballen passerer gjennom kjeglen ved ${time} ms`);
    }
  }

  for (let time = 0; time <= 17 * example.durationMs; time += 90) {
    const positions = positionAt(example, time).positions;
    const players = ['a', 'b', 'c', 'd', 'e'];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        assert.ok(pitchDistance(positions[players[i]], positions[players[j]]) >= 7,
          `${players[i]} og ${players[j]} overlapper ved ${time} ms`);
      }
    }
    for (const id of ['a', 'b', 'c']) {
      for (const cone of [bCone, cCone]) {
        assert.ok(pitchDistance(positions[id], cone) > 6.5, `${id} passerer gjennom kjeglen ved ${time} ms`);
      }
    }
    for (const cone of [bCone, cCone]) {
      assert.ok(pitchDistance(positions.ball, cone) > 4.8, `Ballen passerer gjennom kjeglen ved ${time} ms`);
    }
  }
  assert.ok(pitchDistance(frames[3].positions.ball, frames[3].positions.b) <= 6);
  assert.ok(pitchDistance(frames[11].positions.ball, frames[11].positions.c) < 6);
  assert.ok(pitchDistance(frames[16].positions.ball, frames[16].positions.d) < 7);
  assert.ok(pitchDistance(frames[17].positions.c, frames[17].positions.d) <
    pitchDistance(frames[16].positions.c, frames[16].positions.d));
  assert.deepEqual(frames[17].positions.a, frames[0].positions.b);
  assert.deepEqual(frames[17].positions.b, frames[0].positions.c);
});

test('ufullstendige eller ugyldige tavler avvises med forklaring', () => {
  const missing = copy();
  delete missing.frames[0].positions.ball;
  assert.throws(() => validateScene(missing), /alle objektene/);
  const duplicate = copy();
  duplicate.objects[1].id = duplicate.objects[0].id;
  assert.throws(() => validateScene(duplicate), /unik id/);
  const invalidType = copy();
  invalidType.objects[0].type = 'unknown';
  assert.throws(() => validateScene(invalidType), /Ukjent objekttype/);
  const invalidPoint = copy();
  invalidPoint.frames[0].positions.ball = [101, 2];
  assert.throws(() => validateScene(invalidPoint), /koordinater/);
  const invalidDuration = copy();
  invalidDuration.durationMs = 0;
  assert.throws(() => validateScene(invalidDuration), /durationMs/);
});

test('banevalg og målrotasjon valideres og bevares uten å endre eldre tavler', () => {
  const scene = copy();
  assert.deepEqual(pitchDimensions(scene), [100, 70]);
  assert.equal(objectTransform(scene, scene.objects[0], [20, 50]), 'translate(20 35)');
  scene.pitch = { orientation: 'vertical', size: 'small' };
  scene.objects[0].type = 'smallGoal';
  scene.objects[0].rotation = 90;
  validateScene(scene);
  assert.deepEqual(pitchDimensions(scene), [70, 100]);
  assert.equal(objectTransform(scene, scene.objects[0], [20, 50]), 'translate(14 50) rotate(90)');
  for (const pitch of [{ orientation: 'diagonal', size: 'large' }, { orientation: 'vertical', size: 'huge' }, null]) {
    scene.pitch = pitch;
    assert.throws(() => validateScene(scene), /Banen/);
  }
  scene.pitch = { orientation: 'horizontal', size: 'medium' };
  for (const angle of [-1, 360, '90', null]) {
    scene.objects[0].rotation = angle;
    assert.throws(() => validateScene(scene), /Rotasjonen/);
  }
  scene.objects[0].rotation = 45;
  scene.objects[0].type = 'player';
  assert.throws(() => validateScene(scene), /Rotasjonen/);
});

test('vertikal bane og ulike mål tegnes med valgt størrelse', (t) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (saved) Object.defineProperty(globalThis, 'document', saved);
    else delete globalThis.document;
  });
  function element() {
    return {
      attributes: {}, children: [],
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { this.children.push(child); },
      replaceChildren(child) { this.children = [child]; }
    };
  }
  globalThis.document = { createElementNS: () => element() };
  const scene = copy();
  scene.pitch = { orientation: 'vertical', size: 'medium' };
  scene.objects[0].type = 'smallGoal';
  scene.objects[1].type = 'goal';
  scene.objects[2].type = 'markerCone';
  const canvas = element();
  const elements = renderPitch(scene, canvas);
  assert.equal(canvas.children[0].attributes.viewBox, '0 0 70 100');
  assert.equal(canvas.children[0].attributes['data-size'], 'medium');
  assert.notEqual(elements.get(scene.objects[0].id).children[0].attributes.d,
    elements.get(scene.objects[1].id).children[0].attributes.d);
  for (const object of scene.objects.slice(0, 2)) {
    assert.deepEqual(elements.get(object.id).children.map((child) => child.attributes.class),
      ['goal-net-background', 'goal-net-roof', 'goal-net', 'goal-frame']);
    const [background, roof, net, frame] = elements.get(object.id).children;
    assert.match(background.attributes.d, /-4\.8/);
    assert.match(roof.attributes.d, /-4\.8/);
    assert.match(net.attributes.d, /-0\.3/);
    assert.match(frame.attributes.d, /1\.7/);
  }
  const cone = scene.objects.find((object) => object.type === 'cone');
  assert.deepEqual(elements.get(cone.id).children.map((child) => child.attributes.class),
    ['cone-base', 'cone-body', 'cone-band', 'cone-highlight']);
  const marker = scene.objects.find((object) => object.type === 'markerCone');
  assert.deepEqual(elements.get(marker.id).children.map((child) => child.attributes.class),
    ['marker-cone-base', 'marker-cone-body', 'marker-cone-highlight']);
  const ball = scene.objects.find((object) => object.type === 'ball');
  assert.deepEqual(elements.get(ball.id).children.map((child) => child.attributes.class),
    ['ball-surface', 'ball-shade', 'ball-seams', 'ball-panel']);
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
      addEventListener(name, callback) { this.listeners[name] = callback; },
      removeEventListener(name, callback) { if (this.listeners[name] === callback) delete this.listeners[name]; }
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
  const documentListeners = {};
  globalThis.document = { createElementNS: () => element(),
    addEventListener(name, callback) { documentListeners[name] = callback; },
    removeEventListener(name, callback) { if (documentListeners[name] === callback) delete documentListeners[name]; } };
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

  const destroy = await mount(board);
  const ball = nodes.canvas.children[0].children.find((child) => child.attributes.class === 'tactic-ball');
  assert.equal(callbacks.size, 0, 'animasjonen skal ikke starte automatisk');
  assert.equal(ball.attributes.transform, 'translate(27 21.7)');
  nodes.play.listeners.click();
  assert.equal(nodes.play.attributes['aria-label'], 'Pause animasjonen');
  assert.equal(nodes.play.attributes['data-playing'], 'true');
  tick(0);
  tick(900);
  assert.equal(ball.attributes.transform, 'translate(34.5 21)');
  nodes.play.listeners.click();
  assert.equal(callbacks.size, 0);
  assert.equal(nodes.play.attributes['aria-label'], 'Spill av animasjonen');
  nodes.reset.listeners.click();
  assert.equal(ball.attributes.transform, 'translate(27 21.7)');
  assert.match(nodes.step.textContent, /^Steg 1 av 18:/);
  nodes.play.listeners.click();
  tick(1000);
  tick(1000 + (example.frames.length - 1) * example.durationMs);
  assert.equal(callbacks.size, 0);
  assert.equal(nodes.play.attributes['data-playing'], 'false');
  assert.match(nodes.step.textContent, /^Steg 18 av 18:/);
  nodes.play.listeners.click();
  assert.equal(ball.attributes.transform, 'translate(27 21.7)');
  nodes.reset.listeners.click();
  assert.equal(callbacks.size, 0);
  nodes.play.listeners.click();
  destroy();
  assert.equal(callbacks.size, 0, 'avspilling stoppes når forhåndsvisningen fjernes');
  assert.equal(nodes.play.listeners.click, undefined);
  assert.equal(documentListeners.visibilitychange, undefined);

  const vertical = copy();
  vertical.pitch = { orientation: 'vertical', size: 'small' };
  vertical.objects[0].type = 'goal';
  vertical.objects[0].rotation = 90;
  vertical.objects[1].type = 'markerCone';
  const destroyVertical = mountScene(board, vertical);
  const goal = nodes.canvas.children[0].children.find((child) => child.attributes.class === 'tactic-goal');
  const marker = nodes.canvas.children[0].children.find((child) => child.attributes.class === 'tactic-markerCone');
  assert.equal(nodes.canvas.children[0].attributes.viewBox, '0 0 70 100');
  assert.equal(nodes.canvas.children[0].attributes['data-size'], 'small');
  assert.equal(goal.attributes.transform, 'translate(15.4 23) rotate(90)');
  assert.equal(marker.attributes.transform, objectTransform(vertical, vertical.objects[1], vertical.frames[0].positions[vertical.objects[1].id]));
  nodes.play.listeners.click();
  tick(0);
  tick(900);
  const expected = positionAt(vertical, 900).positions[vertical.objects[0].id];
  assert.equal(goal.attributes.transform, objectTransform(vertical, vertical.objects[0], expected));
  assert.equal(marker.attributes.transform, objectTransform(vertical, vertical.objects[1], positionAt(vertical, 900).positions[vertical.objects[1].id]));
  nodes.reset.listeners.click();
  assert.equal(callbacks.size, 0);
  destroyVertical();

  const still = copy();
  still.frames = [still.frames[0]];
  const destroyStill = mountScene(board, still);
  assert.equal(nodes.controls.hidden, true);
  assert.equal(nodes.message.hidden, false);
  assert.equal(nodes.message.textContent, still.frames[0].caption);
  destroyStill();
});
