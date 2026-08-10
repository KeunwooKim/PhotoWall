/**
 * Wall canvas renderer selection.
 * Default: pixi (Phase 3 cutover). Set NEXT_PUBLIC_WALL_RENDERER=konva to roll back.
 */
export type WallRendererId = "pixi" | "konva";

export function getWallRenderer(): WallRendererId {
  const raw = (process.env.NEXT_PUBLIC_WALL_RENDERER ?? "pixi").trim().toLowerCase();
  return raw === "konva" ? "konva" : "pixi";
}

export function isPixiWallRenderer(): boolean {
  return getWallRenderer() === "pixi";
}
