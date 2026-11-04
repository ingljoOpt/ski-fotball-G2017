(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-tactic-src]').forEach((board) => {
      api.mount(board).catch((error) => {
        console.error('Kunne ikke laste taktikktavlen:', error);
        const message = board.querySelector('[data-tactic-message]');
        message.textContent = 'Taktikktavlen kunne ikke lastes. Bruk øvelsesbeskrivelsen over.';
      });
    });
  }
})(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const types = new Set(['player', 'cone', 'ball']);

  function validateScene(scene) {
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) throw new Error('Tavlen må være et objekt.');
    if (typeof scene.description !== 'string' || !scene.description.trim()) throw new Error('Tavlen må ha en beskrivelse.');
    if (!Number.isFinite(scene.durationMs) || scene.durationMs < 100 || scene.durationMs > 60000) {
      throw new Error('durationMs må være mellom 100 og 60000 millisekunder.');
    }
    if (!Array.isArray(scene.objects) || scene.objects.length === 0) throw new Error('Tavlen må ha minst ett objekt.');
    const ids = new Set();
    for (const object of scene.objects) {
      if (!object || typeof object.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(object.id) || ids.has(object.id)) {
        throw new Error('Alle objekter må ha en unik id med bokstaver, tall, bindestrek eller understrek.');
      }
      if (!types.has(object.type)) throw new Error(`Ukjent objekttype: ${object.type}.`);
      if (object.label !== undefined && (typeof object.label !== 'string' || object.label.length > 3)) {
        throw new Error(`Etiketten for ${object.id} må være tekst på maks tre tegn.`);
      }
      ids.add(object.id);
    }
    if (!Array.isArray(scene.frames) || scene.frames.length < 1) throw new Error('Tavlen må ha minst ett steg.');
    for (const frame of scene.frames) {
      if (!frame || typeof frame.caption !== 'string' || !frame.caption.trim() ||
          !frame.positions || typeof frame.positions !== 'object' || Array.isArray(frame.positions)) {
        throw new Error('Hvert steg må ha en beskrivelse og posisjoner.');
      }
      if (Object.keys(frame.positions).length !== ids.size) throw new Error('Hvert steg må angi nøyaktig alle objektene.');
      for (const id of ids) {
        const point = frame.positions[id];
        if (!Array.isArray(point) || point.length !== 2 ||
            point.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
          throw new Error(`Steget mangler gyldige koordinater for ${id}; bruk tall fra 0 til 100.`);
        }
      }
    }
    return scene;
  }

  function positionAt(scene, elapsedMs) {
    const duration = scene.durationMs;
    const last = scene.frames.length - 1;
    const elapsed = Math.max(0, Math.min(elapsedMs, last * duration));
    const index = Math.min(Math.floor(elapsed / duration), last);
    const next = Math.min(index + 1, last);
    const progress = next === index ? 0 : (elapsed - index * duration) / duration;
    const positions = Object.create(null);
    for (const object of scene.objects) {
      const start = scene.frames[index].positions[object.id];
      const end = scene.frames[next].positions[object.id];
      positions[object.id] = [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress
      ];
    }
    return { index, positions };
  }

  function svgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }

  function renderPitch(scene, canvas) {
    const svg = svgElement('svg', {
      viewBox: '0 0 100 70',
      role: 'img',
      'aria-label': scene.description,
      class: 'tactic-pitch'
    });
    svg.appendChild(svgElement('rect', { x: 1, y: 1, width: 98, height: 68, rx: 2, class: 'pitch-background' }));
    svg.appendChild(svgElement('rect', { x: 5, y: 5, width: 90, height: 60, class: 'pitch-line' }));
    svg.appendChild(svgElement('line', { x1: 50, y1: 5, x2: 50, y2: 65, class: 'pitch-line' }));
    svg.appendChild(svgElement('circle', { cx: 50, cy: 35, r: 8, class: 'pitch-line' }));
    const elements = new Map();
    for (const object of scene.objects) {
      const group = svgElement('g', { class: `tactic-${object.type}` });
      if (object.type === 'cone') {
        group.appendChild(svgElement('path', { d: 'M 0 -3 L 3 2.5 L -3 2.5 Z' }));
      } else {
        group.appendChild(svgElement('circle', { r: object.type === 'ball' ? 1.8 : 3.5 }));
      }
      if (object.label) {
        const text = svgElement('text', { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        text.textContent = object.label;
        group.appendChild(text);
      }
      svg.appendChild(group);
      elements.set(object.id, group);
    }
    canvas.replaceChildren(svg);
    return elements;
  }

  async function mount(board) {
    const message = board.querySelector('[data-tactic-message]');
    const canvas = board.querySelector('[data-tactic-canvas]');
    const controls = board.querySelector('[data-tactic-controls]');
    const playButton = board.querySelector('[data-tactic-play]');
    const resetButton = board.querySelector('[data-tactic-reset]');
    const step = board.querySelector('[data-tactic-step]');
    message.textContent = 'Laster taktikktavlen …';
    const response = await fetch(board.dataset.tacticSrc);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${board.dataset.tacticSrc}`);
    const scene = validateScene(await response.json());
    const elements = renderPitch(scene, canvas);
    const total = (scene.frames.length - 1) * scene.durationMs;
    let elapsed = 0;
    let animation = null;
    let previousTime = null;
    let displayedStep = -1;

    function render() {
      const state = positionAt(scene, elapsed);
      for (const [id, point] of Object.entries(state.positions)) {
        elements.get(id).setAttribute('transform', `translate(${point[0]} ${point[1] * 0.7})`);
      }
      if (state.index !== displayedStep) {
        step.textContent = `Steg ${state.index + 1} av ${scene.frames.length}: ${scene.frames[state.index].caption}`;
        displayedStep = state.index;
      }
    }

    function stop() {
      if (animation !== null) cancelAnimationFrame(animation);
      animation = null;
      previousTime = null;
      playButton.setAttribute('data-playing', 'false');
      playButton.setAttribute('aria-label', 'Spill av animasjonen');
      playButton.setAttribute('title', 'Spill av');
    }

    function tick(time) {
      if (previousTime !== null) elapsed = Math.min(total, elapsed + time - previousTime);
      previousTime = time;
      render();
      if (elapsed >= total) stop();
      else animation = requestAnimationFrame(tick);
    }

    playButton.addEventListener('click', () => {
      if (animation !== null) {
        stop();
        return;
      }
      if (elapsed >= total) elapsed = 0;
      render();
      playButton.setAttribute('data-playing', 'true');
      playButton.setAttribute('aria-label', 'Pause animasjonen');
      playButton.setAttribute('title', 'Pause');
      animation = requestAnimationFrame(tick);
    });
    resetButton.addEventListener('click', () => {
      stop();
      elapsed = 0;
      render();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && animation !== null) stop();
    });
    const container = board.closest('details');
    if (container) container.addEventListener('toggle', () => {
      if (!container.open && animation !== null) stop();
    });
    render();
    if (scene.frames.length > 1) {
      controls.hidden = false;
    } else {
      message.textContent = scene.frames[0].caption;
    }
    if (scene.frames.length > 1) message.hidden = true;
  }

  return { validateScene, positionAt, mount };
});
