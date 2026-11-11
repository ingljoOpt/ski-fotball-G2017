(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    globalThis.TacticBoard = api;
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
  const types = new Set(['player', 'cone', 'markerCone', 'ball', 'smallGoal', 'goal']);
  const goalTypes = new Set(['smallGoal', 'goal']);

  function pitchDimensions(scene) {
    return scene.pitch && scene.pitch.orientation === 'vertical' ? [70, 100] : [100, 70];
  }

  function objectTransform(scene, object, point) {
    const [width, height] = pitchDimensions(scene);
    const translate = `translate(${point[0] * width / 100} ${point[1] * height / 100})`;
    return object.rotation ? `${translate} rotate(${object.rotation})` : translate;
  }

  function validateScene(scene) {
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) throw new Error('Tavlen må være et objekt.');
    if (typeof scene.description !== 'string' || !scene.description.trim()) throw new Error('Tavlen må ha en beskrivelse.');
    if (!Number.isFinite(scene.durationMs) || scene.durationMs < 100 || scene.durationMs > 60000) {
      throw new Error('durationMs må være mellom 100 og 60000 millisekunder.');
    }
    if (scene.pitch !== undefined && (!scene.pitch || typeof scene.pitch !== 'object' || Array.isArray(scene.pitch) ||
        !['horizontal', 'vertical'].includes(scene.pitch.orientation) ||
        !['small', 'medium', 'large'].includes(scene.pitch.size))) {
      throw new Error('Banen må ha gyldig retning og størrelse.');
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
      if (object.rotation !== undefined && (!goalTypes.has(object.type) ||
          !Number.isFinite(object.rotation) || object.rotation < 0 || object.rotation >= 360)) {
        throw new Error(`Rotasjonen for ${object.id} må være et tall fra 0 til under 360 grader for et mål.`);
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
    const [width, height] = pitchDimensions(scene);
    const vertical = width < height;
    const svg = svgElement('svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': scene.description,
      class: 'tactic-pitch',
      'data-size': scene.pitch ? scene.pitch.size : 'large'
    });
    svg.appendChild(svgElement('rect', { x: 1, y: 1, width: width - 2, height: height - 2, rx: 2, class: 'pitch-background' }));
    svg.appendChild(svgElement('rect', { x: 5, y: 5, width: width - 10, height: height - 10, class: 'pitch-line' }));
    svg.appendChild(svgElement('line', vertical
      ? { x1: 5, y1: 50, x2: 65, y2: 50, class: 'pitch-line' }
      : { x1: 50, y1: 5, x2: 50, y2: 65, class: 'pitch-line' }));
    svg.appendChild(svgElement('circle', { cx: width / 2, cy: height / 2, r: 8, class: 'pitch-line' }));
    const elements = new Map();
    for (const object of scene.objects) {
      const group = svgElement('g', { class: `tactic-${object.type}` });
      if (object.type === 'cone') {
        group.appendChild(svgElement('path', { class: 'cone-base', d: 'M -3 2 L 0 0.8 L 3 2 L 3 2.8 L -3 2.8 Z' }));
        group.appendChild(svgElement('path', { class: 'cone-body', d: 'M 0 -3 L 2.3 2 L 0 2.7 L -2.3 2 Z' }));
        group.appendChild(svgElement('path', { class: 'cone-band', d: 'M -1.3 -0.2 L 0 0.15 L 1.3 -0.2 L 1.8 0.9 L 0 1.35 L -1.8 0.9 Z' }));
        group.appendChild(svgElement('path', { class: 'cone-highlight', d: 'M -0.45 -1.8 L -1.45 0.5' }));
      } else if (object.type === 'markerCone') {
        group.appendChild(svgElement('ellipse', { class: 'marker-cone-base', cx: 0, cy: 0.45, rx: 2.3, ry: 0.7 }));
        group.appendChild(svgElement('path', { class: 'marker-cone-body', d: 'M -2 0.35 Q -1.25 -1.2 0 -1.2 Q 1.25 -1.2 2 0.35 Q 0 1 -2 0.35 Z' }));
        group.appendChild(svgElement('path', { class: 'marker-cone-highlight', d: 'M -1 -0.1 Q -0.6 -0.7 0 -0.8' }));
      } else if (goalTypes.has(object.type)) {
        const halfWidth = object.type === 'smallGoal' ? 4 : 7;
        const back = halfWidth - 1;
        group.appendChild(svgElement('path', {
          class: 'goal-net-background',
          d: `M ${-halfWidth} 1.7 L ${-halfWidth} -2.8 L ${-back} -4.8 L ${back} -4.8` +
            ` L ${halfWidth} -2.8 L ${halfWidth} 1.7 L ${back} -0.3 L ${-back} -0.3 Z`
        }));
        group.appendChild(svgElement('path', {
          class: 'goal-net-roof',
          d: `M ${-halfWidth} -2.8 L ${-back} -4.8 L ${back} -4.8 L ${halfWidth} -2.8 Z`
        }));
        group.appendChild(svgElement('path', {
          class: 'goal-net',
          d: `M ${-back} -4.8 L ${-back} -0.3 L ${back} -0.3 L ${back} -4.8` +
            ` M ${-back} -3.8 L ${back} -3.8 M ${-back} -2.8 L ${back} -2.8` +
            ` M ${-back} -1.8 L ${back} -1.8 M ${-back} -0.8 L ${back} -0.8` +
            ` M ${-back / 2} -4.8 L ${-back / 2} -0.3 M 0 -4.8 L 0 -0.3 M ${back / 2} -4.8 L ${back / 2} -0.3` +
            ` M ${-halfWidth / 2} -2.8 L ${-back / 2} -4.8 M 0 -2.8 L 0 -4.8 M ${halfWidth / 2} -2.8 L ${back / 2} -4.8` +
            ` M ${-halfWidth} -0.5 L ${-back} -2.5 M ${halfWidth} -0.5 L ${back} -2.5` +
            ` M ${-halfWidth} 1.7 L ${-back} -0.3 M ${halfWidth} 1.7 L ${back} -0.3`
        }));
        group.appendChild(svgElement('path', {
          class: 'goal-frame',
          d: `M ${-halfWidth} 1.7 L ${-halfWidth} -2.8 L ${halfWidth} -2.8 L ${halfWidth} 1.7`
        }));
      } else if (object.type === 'ball') {
        group.appendChild(svgElement('circle', { class: 'ball-surface', r: 1.8 }));
        group.appendChild(svgElement('path', { class: 'ball-shade', d: 'M -1.7 0.45 Q -1.3 1.8 0 1.8 Q 1.3 1.8 1.7 0.45 Q 0 1.2 -1.7 0.45 Z' }));
        group.appendChild(svgElement('path', { class: 'ball-seams', d: 'M 0 -0.7 L 0 -1.42 M 0.67 -0.22 L 1.3 -0.44 M 0.42 0.58 L 0.83 1.15 M -0.42 0.58 L -0.83 1.15 M -0.67 -0.22 L -1.3 -0.44' }));
        group.appendChild(svgElement('path', {
          class: 'ball-panel',
          d: 'M 0 -0.7 L 0.67 -0.22 L 0.42 0.58 L -0.42 0.58 L -0.67 -0.22 Z' +
            ' M -0.5 -1.7 Q 0 -1.84 0.5 -1.7 L 0.32 -1.42 L -0.32 -1.42 Z' +
            ' M 1.56 -0.88 Q 1.8 -0.45 1.8 0 L 1.45 0.03 L 1.3 -0.44 Z' +
            ' M -1.56 -0.88 Q -1.8 -0.45 -1.8 0 L -1.45 0.03 L -1.3 -0.44 Z' +
            ' M 0.55 1.7 Q 1.15 1.4 1.4 1.12 L 1.1 0.96 L 0.83 1.15 Z' +
            ' M -0.55 1.7 Q -1.15 1.4 -1.4 1.12 L -1.1 0.96 L -0.83 1.15 Z'
        }));
      } else {
        group.appendChild(svgElement('circle', { r: 3.5 }));
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
    message.textContent = 'Laster taktikktavlen …';
    const response = await fetch(board.dataset.tacticSrc);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${board.dataset.tacticSrc}`);
    return mountScene(board, await response.json());
  }

  function mountScene(board, input) {
    const message = board.querySelector('[data-tactic-message]');
    const canvas = board.querySelector('[data-tactic-canvas]');
    const controls = board.querySelector('[data-tactic-controls]');
    const playButton = board.querySelector('[data-tactic-play]');
    const resetButton = board.querySelector('[data-tactic-reset]');
    const step = board.querySelector('[data-tactic-step]');
    const scene = validateScene(input);
    controls.hidden = true;
    message.hidden = false;
    const elements = renderPitch(scene, canvas);
    const total = (scene.frames.length - 1) * scene.durationMs;
    let elapsed = 0;
    let animation = null;
    let previousTime = null;
    let displayedStep = -1;

    function render() {
      const state = positionAt(scene, elapsed);
      for (const [id, point] of Object.entries(state.positions)) {
        const object = scene.objects.find((item) => item.id === id);
        elements.get(id).setAttribute('transform', objectTransform(scene, object, point));
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

    function play() {
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
    }
    function reset() {
      stop();
      elapsed = 0;
      render();
    }
    function onVisibilityChange() {
      if (document.hidden && animation !== null) stop();
    }
    function onToggle() {
      if (!container.open && animation !== null) stop();
    }
    const container = board.closest('details');
    playButton.addEventListener('click', play);
    resetButton.addEventListener('click', reset);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (container) container.addEventListener('toggle', onToggle);
    render();
    if (scene.frames.length > 1) {
      controls.hidden = false;
    } else {
      message.textContent = scene.frames[0].caption;
    }
    if (scene.frames.length > 1) message.hidden = true;
    return () => {
      stop();
      playButton.removeEventListener('click', play);
      resetButton.removeEventListener('click', reset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (container) container.removeEventListener('toggle', onToggle);
    };
  }

  return { validateScene, positionAt, pitchDimensions, objectTransform, renderPitch, mount, mountScene };
});
