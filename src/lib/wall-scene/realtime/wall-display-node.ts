/**
 * Renderer-agnostic display node used by wall-node-sync, group-drag, and expand.
 * Konva Groups and Pixi Containers are wrapped to this shape (rotation in degrees).
 */
export interface WallDisplayNode {
  id(): string;
  x(): number;
  y(): number;
  position(pos: { x: number; y: number }): void;
  rotation(): number;
  rotation(value: number): number;
  scaleX(): number;
  scaleX(value: number): number;
  scaleY(): number;
  scaleY(value: number): number;
  destroy(): void;
  /** Optional — Konva batches layers; Pixi ticks continuously. */
  requestRedraw?: () => void;
}

export function isWallDisplayNode(value: unknown): value is WallDisplayNode {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as WallDisplayNode).id === "function" &&
    typeof (value as WallDisplayNode).x === "function" &&
    typeof (value as WallDisplayNode).position === "function"
  );
}
