const STORAGE_KEY = "photowall-lock-wall-size";

let memoryLocked = false;
let hydrated = false;
let blockedHandler: (() => void) | null = null;
let lastBlockedAt = 0;

const BLOCKED_TOAST_COOLDOWN_MS = 2200;

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    memoryLocked = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    memoryLocked = false;
  }
}

export function isWallSizeLocked(): boolean {
  hydrate();
  return memoryLocked;
}

export function setWallSizeLocked(locked: boolean): void {
  hydrate();
  memoryLocked = locked;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locked ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

/** Called when expand/shrink is blocked by the lock (toast, etc.). */
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
