(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.TacticEditorModel = api;
})(function () {
  'use strict';

  function newScene() {
    return {
      description: 'Beskriv hva som skjer i animasjonen.',
      durationMs: 1800,
      pitch: { orientation: 'horizontal', size: 'large' },
      objects: [
        { id: 'spiller1', type: 'player', label: 'A' },
        { id: 'kjegle1', type: 'cone' },
        { id: 'ball1', type: 'ball' }
      ],
      frames: [{
        caption: 'Beskriv steget.',
        positions: { spiller1: [30, 50], kjegle1: [55, 50], ball1: [36, 50] }
      }]
    };
  }

  function addFrame(scene, index) {
    const source = scene.frames[index];
    if (!source) throw new Error('Steget finnes ikke.');
    const frame = {
      ...source,
      positions: Object.fromEntries(Object.entries(source.positions).map(([id, point]) => [id, [...point]]))
    };
    scene.frames.splice(index + 1, 0, frame);
    return index + 1;
  }

  function removeFrame(scene, index) {
    if (scene.frames.length <= 1) throw new Error('Tavlen må ha minst ett steg.');
    if (!scene.frames[index]) throw new Error('Steget finnes ikke.');
    scene.frames.splice(index, 1);
    return Math.min(index, scene.frames.length - 1);
  }

  function addObject(scene, type, label) {
    const prefixes = { player: 'spiller', cone: 'kjegle', ball: 'ball', smallGoal: 'smamal', goal: 'mal' };
    if (!Object.hasOwn(prefixes, type)) throw new Error('Ukjent figurtype.');
    if (typeof label !== 'string' || label.length > 3) throw new Error('Merket kan ha maks tre tegn.');
    let number = 1;
    while (scene.objects.some((object) => object.id === prefixes[type] + number)) number++;
    const object = { id: prefixes[type] + number, type };
    if (label) object.label = label;
    scene.objects.push(object);
    for (const frame of scene.frames) frame.positions[object.id] = [50, 50];
    return object.id;
  }

  function removeObject(scene, id) {
    if (scene.objects.length <= 1) throw new Error('Tavlen må ha minst én figur.');
    const index = scene.objects.findIndex((object) => object.id === id);
    if (index < 0) throw new Error('Figuren finnes ikke.');
    scene.objects.splice(index, 1);
    for (const frame of scene.frames) delete frame.positions[id];
  }

  function moveObject(scene, index, id, point) {
    const frame = scene.frames[index];
    if (!frame || !scene.objects.some((object) => object.id === id)) throw new Error('Steget eller figuren finnes ikke.');
    if (!Array.isArray(point) || point.length !== 2 ||
        point.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      throw new Error('Koordinatene må være tall mellom 0 og 100.');
    }
    frame.positions[id] = [...point];
  }

  return { newScene, addFrame, removeFrame, addObject, removeObject, moveObject };
});
