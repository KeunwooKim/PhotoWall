/** Heuristic: wall scene has no objects (v2 scene or photowallScene envelope). */
export function countWallSceneObjects(canvasJson: unknown): number {
  if (!canvasJson || typeof canvasJson !== "object") return 0;
  const root = canvasJson as Record<string, unknown>;

  if (Array.isArray(root.objects)) return root.objects.length;

  const scene = root.photowallScene;
  if (scene && typeof scene === "object") {
    const objects = (scene as { objects?: unknown }).objects;
    if (Array.isArray(objects)) return objects.length;
  }

  return 0;
}

export function isEmptyWallCanvas(canvasJson: unknown): boolean {
  return countWallSceneObjects(canvasJson) === 0;
}
