declare const board: {
  validateScene(scene: unknown): unknown;
  mountScene(element: HTMLElement, scene: unknown): () => void;
};
export = board;
