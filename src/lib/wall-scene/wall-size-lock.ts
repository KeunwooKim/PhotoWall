import { useWallSceneStore } from "@/stores/wall-scene-store";

let blockedHandler: (() => void) | null = null;
let lastBlockedAt = 0;

const BLOCKED_TOAST_COOLDOWN_MS = 2200;

/** Shared wall-size lock from the current scene (synced to collaborators). */
export function isWallSizeLocked(): boolean {
  return !!useWallSceneStore.getState().document.meta.wallSizeLocked;
}

export function setWallSizeLocked(locked: boolean): void {
  useWallSceneStore.getState().setWallSizeLocked(locked);
}

/** Empty-side reclaim after drop — default off. */
export function isWallShrinkEnabled(): boolean {
  return !!useWallSceneStore.getState().document.meta.wallShrinkEnabled;
}

export function setWallShrinkEnabled(enabled: boolean): void {
  useWallSceneStore.getState().setWallShrinkEnabled(enabled);
}

/** Called when expand is blocked by the lock (toast, etc.). */
export function registerWallSizeLockBlockedHandler(handler: (() => void) | null): void {
  blockedHandler = handler;
}

/** Returns false when locked (and notifies, throttled). */
export function allowWallSizeChange(): boolean {
  if (!isWallSizeLocked()) return true;
  const now = Date.now();
  if (now - lastBlockedAt >= BLOCKED_TOAST_COOLDOWN_MS) {
    lastBlockedAt = now;
    blockedHandler?.();
  }
  return false;
}
