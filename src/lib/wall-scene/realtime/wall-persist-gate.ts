/** Suppress wall autosave while applying remote realtime updates (and briefly after). */
let suppressDepth = 0;
let cooldownUntilMs = 0;

export function beginRemotePersistSuppress(): void {
  suppressDepth += 1;
}

export function endRemotePersistSuppress(cooldownMs = 300): void {
  suppressDepth = Math.max(0, suppressDepth - 1);
  cooldownUntilMs = Date.now() + Math.max(0, cooldownMs);
}

export function shouldSkipWallPersist(): boolean {
  return suppressDepth > 0 || Date.now() < cooldownUntilMs;
}

export function runWithoutWallPersist<T>(fn: () => T, cooldownMs = 1200): T {
  beginRemotePersistSuppress();
  try {
    return fn();
  } finally {
    endRemotePersistSuppress(cooldownMs);
  }
}
