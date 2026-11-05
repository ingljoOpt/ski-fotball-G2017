(function () {
  'use strict';

  const root = document.querySelector('[data-editor-root]');
  const board = globalThis.TacticBoard;
  const model = globalThis.TacticEditorModel;
  const byId = (id) => document.getElementById(`editor-${id}`);
  const fields = byId('fields');
  const status = byId('status');
  const canvas = byId('canvas');
  const frameSelect = byId('frame');
  const orientation = byId('orientation');
  const size = byId('size');
  const rotation = byId('rotation');
  const objectSelect = byId('object');
  const caption = byId('caption');
  const label = byId('label');
  const x = byId('x');
  const y = byId('y');
  const description = byId('description');
  const duration = byId('duration');
  const filename = byId('filename');
  const previewButton = byId('preview');
  const previewStatus = byId('preview-status');
  let scene = null;
  let frameIndex = 0;
  let selectedId = null;
  let elements = new Map();
  let dirty = false;
  let animation = null;
  let previousTime = null;
  let elapsed = 0;
  let loadVersion = 0;

  function report(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function describeObject(object) {
    const type = { player: 'Spiller', cone: 'Kjegle', markerCone: 'Markeringskjegle', ball: 'Ball', smallGoal: 'Småmål', goal: 'Stort mål' }[object.type];
    return `${type}${object.label ? ` ${object.label}` : ''} (${object.id})`;
  }

  function drawPositions(positions) {
    for (const object of scene.objects) {
      const point = positions[object.id];
      const group = elements.get(object.id);
      group.setAttribute('transform', board.objectTransform(scene, object, point));
      group.setAttribute('data-selected', String(object.id === selectedId));
      group.setAttribute('aria-label', `${describeObject(object)}, x ${point[0]}, y ${point[1]}. Bruk piltastene for å flytte.`);
    }
  }

  function stopPreview() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    previousTime = null;
    previewButton.textContent = '⏵';
    previewButton.setAttribute('aria-label', 'Spill av forhåndsvisning');
    previewButton.title = 'Spill av forhåndsvisning';
    previewStatus.textContent = '';
    if (scene) drawPositions(scene.frames[frameIndex].positions);
  }

  function refreshSelection() {
    const object = scene.objects.find((item) => item.id === selectedId);
    const point = scene.frames[frameIndex].positions[selectedId];
    objectSelect.value = selectedId;
    label.value = object.label || '';
    x.value = point[0];
    y.value = point[1];
    byId('rotation-container').hidden = object.type !== 'smallGoal' && object.type !== 'goal';
    rotation.value = object.rotation || 0;
    drawPositions(scene.frames[frameIndex].positions);
  }

  function refreshObjects() {
    objectSelect.replaceChildren();
    for (const object of scene.objects) {
      const option = document.createElement('option');
      option.value = object.id;
      option.textContent = describeObject(object);
      objectSelect.appendChild(option);
    }
    byId('object-remove').disabled = scene.objects.length <= 1;
    refreshSelection();
  }

  function refreshFrameControls() {
    frameSelect.max = String(scene.frames.length - 1);
    frameSelect.value = String(frameIndex);
    frameSelect.setAttribute('aria-valuetext', `Steg ${frameIndex + 1} av ${scene.frames.length}`);
    byId('frame-count').textContent = `${frameIndex + 1} av ${scene.frames.length}`;
    byId('previous').disabled = frameIndex === 0;
    byId('next').disabled = frameIndex === scene.frames.length - 1;
    previewButton.disabled = scene.frames.length < 2;
  }

  function refreshFrames() {
    refreshFrameControls();
    caption.value = scene.frames[frameIndex].caption;
    byId('frame-remove').disabled = scene.frames.length <= 1;
    refreshSelection();
  }

  function moveSelected(point) {
    model.moveObject(scene, frameIndex, selectedId, point);
    dirty = true;
    refreshSelection();
  }

  function buildPitch() {
    elements = board.renderPitch(scene, canvas);
    const svg = canvas.querySelector('svg');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Taktikktavle. Velg en figur for å flytte den.');
    for (const object of scene.objects) {
      const group = elements.get(object.id);
      group.setAttribute('data-editor-object', object.id);
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      let pointer = null;
      group.addEventListener('focus', () => {
        if (fields.disabled) return;
        stopPreview();
        selectedId = object.id;
        refreshSelection();
      });
      group.addEventListener('pointerdown', (event) => {
        if (fields.disabled || event.button !== 0) return;
        event.preventDefault();
        stopPreview();
        selectedId = object.id;
        refreshSelection();
        pointer = event.pointerId;
        group.setPointerCapture(pointer);
      });
      group.addEventListener('pointermove', (event) => {
        if (fields.disabled || pointer !== event.pointerId) return;
        const matrix = svg.getScreenCTM();
        if (!matrix) {
          report('Kan ikke finne banens plassering. Prøv igjen når tavlen er synlig.', true);
          return;
        }
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const local = point.matrixTransform(matrix.inverse());
        const clamp = (value) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
        const [width, height] = board.pitchDimensions(scene);
        moveSelected([clamp(local.x * 100 / width), clamp(local.y * 100 / height)]);
      });
      group.addEventListener('pointerup', (event) => {
        if (pointer === event.pointerId) pointer = null;
      });
      group.addEventListener('pointercancel', () => { pointer = null; });
      group.addEventListener('keydown', (event) => {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (fields.disabled || !Object.hasOwn(directions, event.key)) return;
        event.preventDefault();
        stopPreview();
        selectedId = object.id;
        const point = scene.frames[frameIndex].positions[selectedId];
        const amount = event.shiftKey ? 5 : 1;
        const delta = directions[event.key];
        moveSelected(point.map((value, index) => Math.max(0, Math.min(100, value + delta[index] * amount))));
      });
    }
  }

  function loadScene(next, name, changed) {
    board.validateScene(next);
    stopPreview();
    scene = next;
    frameIndex = 0;
    selectedId = scene.objects[0].id;
    dirty = changed;
    description.value = scene.description;
    duration.value = scene.durationMs;
    orientation.value = scene.pitch ? scene.pitch.orientation : 'horizontal';
    size.value = scene.pitch ? scene.pitch.size : 'large';
    filename.value = name;
    buildPitch();
    refreshObjects();
    refreshFrames();
    fields.disabled = false;
  }

  function mayReplace() {
    return !dirty || window.confirm('Du har endringer som ikke er publisert. Last ned JSON først hvis du vil beholde dem. Fortsette?');
  }

  function tick(time) {
    if (previousTime !== null) elapsed += time - previousTime;
    previousTime = time;
    const total = (scene.frames.length - 1) * scene.durationMs;
    elapsed = Math.min(elapsed, total);
    const state = board.positionAt(scene, elapsed);
    if (frameIndex !== state.index) {
      frameIndex = state.index;
      refreshFrames();
    }
    drawPositions(state.positions);
    previewStatus.textContent = `Steg ${state.index + 1} av ${scene.frames.length}: ${scene.frames[state.index].caption}`;
    if (elapsed >= total) {
      stopPreview();
      report('Forhåndsvisningen er ferdig.');
    } else animation = requestAnimationFrame(tick);
  }

  previewButton.addEventListener('click', () => {
    if (animation !== null) {
      stopPreview();
      return;
    }
    try {
      board.validateScene(scene);
      if (scene.frames.length < 2) throw new Error('Lag minst to steg for å forhåndsvise animasjonen.');
      if (frameIndex === scene.frames.length - 1) frameIndex = 0;
      elapsed = frameIndex * scene.durationMs;
      previousTime = null;
      refreshFrames();
      previewButton.textContent = '⏸';
      previewButton.setAttribute('aria-label', 'Pause forhåndsvisning');
      previewButton.title = 'Pause forhåndsvisning';
      animation = requestAnimationFrame(tick);
      report('Forhåndsvisning startet.');
    } catch (error) {
      report(`Kan ikke forhåndsvise: ${error.message}`, true);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animation !== null) stopPreview();
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty) event.preventDefault();
    if (dirty) event.returnValue = '';
  });

  frameSelect.addEventListener('input', () => {
    const index = Number(frameSelect.value);
    stopPreview();
    frameIndex = index;
    refreshFrames();
  });
  for (const [id, delta] of [['previous', -1], ['next', 1]]) {
    byId(id).addEventListener('click', () => {
      stopPreview();
      frameIndex = Math.max(0, Math.min(scene.frames.length - 1, frameIndex + delta));
      refreshFrames();
    });
  }
  byId('advanced').addEventListener('change', (event) => {
    byId('advanced-settings').hidden = !event.target.checked;
  });
  for (const input of [orientation, size]) {
    input.addEventListener('change', () => {
      stopPreview();
      scene.pitch = { orientation: orientation.value, size: size.value };
      dirty = true;
      buildPitch();
      refreshSelection();
    });
  }
  rotation.addEventListener('change', () => {
    stopPreview();
    const value = rotation.value === '' ? NaN : Number(rotation.value);
    if (!Number.isInteger(value) || value < 0 || value >= 360) {
      report('Rotasjonen må være et helt tall mellom 0 og 359 grader.', true);
      refreshSelection();
      return;
    }
    const object = scene.objects.find((item) => item.id === selectedId);
    object.rotation = value;
    dirty = true;
    refreshSelection();
  });
  objectSelect.addEventListener('change', () => {
    stopPreview();
    selectedId = objectSelect.value;
    refreshSelection();
  });
  caption.addEventListener('input', () => {
    stopPreview();
    scene.frames[frameIndex].caption = caption.value;
    dirty = true;
  });
  description.addEventListener('input', () => {
    stopPreview();
    scene.description = description.value;
    dirty = true;
  });
  duration.addEventListener('input', () => {
    stopPreview();
    scene.durationMs = duration.value === '' ? NaN : Number(duration.value);
    dirty = true;
  });
  label.addEventListener('input', () => {
    stopPreview();
    const object = scene.objects.find((item) => item.id === selectedId);
    if (label.value) object.label = label.value;
    else delete object.label;
    dirty = true;
    buildPitch();
    refreshObjects();
  });
  for (const input of [x, y]) {
    input.addEventListener('change', () => {
      stopPreview();
      try {
        const point = [x, y].map((field) => field.value === '' ? NaN : Number(field.value));
        moveSelected(point);
      } catch (error) {
        report(error.message, true);
        refreshSelection();
      }
    });
  }

  byId('frame-add').addEventListener('click', () => {
    stopPreview();
    frameIndex = model.addFrame(scene, frameIndex);
    dirty = true;
    refreshFrames();
    report('Et nytt steg er lagt til. Flytt figurene og beskriv steget.');
  });
  byId('frame-remove').addEventListener('click', () => {
    stopPreview();
    frameIndex = model.removeFrame(scene, frameIndex);
    dirty = true;
    refreshFrames();
    report('Steget er slettet.');
  });
  root.querySelectorAll('[data-editor-add]').forEach((button) => {
    button.addEventListener('click', () => {
      stopPreview();
      const type = button.dataset.editorAdd;
      const count = scene.objects.filter((object) => object.type === 'player').length;
      selectedId = model.addObject(scene, type, type === 'player' ? String.fromCharCode(65 + count % 26) : '');
      dirty = true;
      buildPitch();
      refreshObjects();
      report('Figuren er lagt til i alle stegene. Flytt den på banen.');
    });
  });
  byId('object-remove').addEventListener('click', () => {
    stopPreview();
    model.removeObject(scene, selectedId);
    selectedId = scene.objects[0].id;
    dirty = true;
    buildPitch();
    refreshObjects();
    report('Figuren er slettet fra alle stegene.');
  });

  byId('new').addEventListener('click', () => {
    if (!mayReplace()) return;
    loadVersion++;
    loadScene(model.newScene(), 'taktikktavle.json', true);
    report('Ny tavle opprettet. Endringene er bare i nettleseren til du laster ned filen.');
  });
  byId('file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!mayReplace()) {
      event.target.value = '';
      return;
    }
    const version = ++loadVersion;
    stopPreview();
    fields.disabled = true;
    try {
      const next = JSON.parse(await file.text());
      if (version !== loadVersion) return;
      loadScene(next, file.name, false);
      report(`Åpnet ${file.name}. Endringer må lastes ned og legges i GitHub for å publiseres.`);
    } catch (error) {
      if (version === loadVersion) {
        report(`Kunne ikke åpne filen: ${error.message}`, true);
        fields.disabled = !scene;
      }
    } finally {
      event.target.value = '';
    }
  });
  byId('download').addEventListener('click', () => {
    stopPreview();
    try {
      board.validateScene(scene);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.json$/.test(filename.value)) {
        throw new Error('Filnavnet må slutte på .json og bare inneholde bokstaver, tall, bindestrek eller understrek.');
      }
      const blob = new Blob([`${JSON.stringify(scene, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.value;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      report('Nedlasting startet. Kopier filen til prosjektet og publiser via GitHub; nettstedet er ikke oppdatert ennå.');
    } catch (error) {
      report(`Kunne ikke laste ned: ${error.message}`, true);
    }
  });

  async function start() {
    const version = ++loadVersion;
    const source = new URLSearchParams(location.search).get('src');
    if (!source) {
      loadScene(model.newScene(), 'taktikktavle.json', false);
      report('Ny tavle klar. Endringer lagres ikke automatisk.');
      return;
    }
    try {
      const url = new URL(source, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith(root.dataset.mediaRoot) ||
          !url.pathname.endsWith('.json') || url.username || url.password) {
        throw new Error('Tavlen må være en JSON-fil i nettstedets taktikkmappe.');
      }
      report('Laster tavlen …');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = await response.json();
      if (version !== loadVersion) return;
      loadScene(next, decodeURIComponent(url.pathname.split('/').pop()), false);
      report('Tavlen er åpnet. Endringer lagres ikke automatisk.');
    } catch (error) {
      if (version === loadVersion) report(`Kunne ikke åpne tavlen: ${error.message} Bruk «Åpne JSON-fil» eller «Ny tavle».`, true);
    }
  }

  start();
})();
