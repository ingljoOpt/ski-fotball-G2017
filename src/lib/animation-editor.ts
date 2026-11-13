import board from "../../publiserte/assets/taktikk.js";

export type Point = [number, number];
export type AnimationObjectType = "player" | "cone" | "markerCone" | "ball" | "smallGoal" | "goal";
export type AnimationObject = { id: string; type: AnimationObjectType; label?: string; rotation?: number };
export type AnimationScene = {
  description: string;
  durationMs: number;
  pitch?: { orientation: "horizontal" | "vertical"; size: "small" | "medium" | "large" };
  objects: AnimationObject[];
  frames: { caption: string; positions: Record<string, Point> }[];
};

export function readAnimation(input: unknown): AnimationScene {
  board.validateScene(input);
  return structuredClone(input) as AnimationScene;
}

export function newAnimation(): AnimationScene {
  return {
    description: "Beskriv hva som skjer i animasjonen.",
    durationMs: 1800,
    pitch: { orientation: "horizontal", size: "large" },
    objects: [
      { id: "spiller1", type: "player", label: "A" },
      { id: "kjegle1", type: "cone" },
      { id: "ball1", type: "ball" },
    ],
    frames: [{ caption: "", positions: { spiller1: [30, 50], kjegle1: [55, 50], ball1: [36, 50] } }],
  };
}

export function addAnimationObject(scene: AnimationScene, type: AnimationObjectType): string {
  const prefixes: Record<AnimationObjectType, string> = {
    player: "spiller", cone: "kjegle", markerCone: "markeringskjegle", ball: "ball", smallGoal: "smamal", goal: "mal",
  };
  let number = 1;
  while (scene.objects.some((object) => object.id === prefixes[type] + number)) number++;
  const id = prefixes[type] + number;
  const count = scene.objects.filter((object) => object.type === "player").length;
  scene.objects.push({ id, type, ...(type === "player" ? { label: String.fromCharCode(65 + count % 26) } : {}) });
  for (const frame of scene.frames) frame.positions[id] = [50, 50];
  return id;
}

export function addAnimationFrame(scene: AnimationScene, index: number): number {
  const frame = scene.frames[index];
  if (!frame) throw new Error("Steget finnes ikke.");
  scene.frames.splice(index + 1, 0, structuredClone(frame));
  return index + 1;
}

export function removeAnimationObject(scene: AnimationScene, id: string) {
  if (scene.objects.length <= 1) throw new Error("Tavlen må ha minst én figur.");
  const index = scene.objects.findIndex((object) => object.id === id);
  if (index < 0) throw new Error("Figuren finnes ikke.");
  scene.objects.splice(index, 1);
  for (const frame of scene.frames) delete frame.positions[id];
}

export function animationPosition(scene: AnimationScene, elapsed: number) {
  const last = scene.frames.length - 1;
  const time = Math.max(0, Math.min(elapsed, last * scene.durationMs));
  const index = Math.min(Math.floor(time / scene.durationMs), last);
  const next = Math.min(index + 1, last);
  const progress = next === index ? 0 : (time - index * scene.durationMs) / scene.durationMs;
  const positions: Record<string, Point> = {};
  for (const object of scene.objects) {
    const start = scene.frames[index].positions[object.id];
    const end = scene.frames[next].positions[object.id];
    positions[object.id] = [start[0] + (end[0] - start[0]) * progress, start[1] + (end[1] - start[1]) * progress];
  }
  return { index, positions };
}
