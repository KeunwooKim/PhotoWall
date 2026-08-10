/**
 * Snapshot of a wall preview capture taken synchronously before the Pixi/Konva
 * stage is destroyed on SPA leave. Parent flush hooks run after child cleanup,
 * so live refs are already null — this bridge keeps the last scene pixels.
 */

export type PendingWallPreviewCapture = {
  wallId: string;
  themeId: string;
  /** Stage scene PNG (objects); wallpaper is painted at upload time. */
  sceneDataUrl: string;
  wallWidth: number;
  wallHeight: number;
};

let pending: PendingWallPreviewCapture | null = null;
let dirty = false;

export function markPendingWallPreviewDirty(): void {
  dirty = true;
}

export function isPendingWallPreviewDirty(): boolean {
  return dirty;
}

export function clearPendingWallPreviewDirty(): void {
  dirty = false;
}

export function stashPendingWallPreviewCapture(
  capture: PendingWallPreviewCapture,
): void {
  pending = capture;
}

export function takePendingWallPreviewCapture(
  wallId?: string | null,
): PendingWallPreviewCapture | null {
  if (!pending) return null;
  if (wallId && pending.wallId !== wallId) return null;
  const out = pending;
  pending = null;
  return out;
}

export function peekPendingWallPreviewWallId(): string | null {
  return pending?.wallId ?? null;
}
