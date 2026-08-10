import { clampUserZoom } from "@/lib/wall-scene/viewport-zoom";

const KEY_PREFIX = "photowall-viewport:";

export type WallViewportSnapshot = {
  userZoom: number;
  panX: number;
  panY: number;
};

function storageKey(wallId: string): string {
  return `${KEY_PREFIX}${wallId}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Read last camera for a wall (same browser). Invalid / missing → null. */
export function loadWallViewport(wallId: string): WallViewportSnapshot | null {
  if (!wallId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(wallId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WallViewportSnapshot>;
    if (
      !isFiniteNumber(parsed.userZoom) ||
      !isFiniteNumber(parsed.panX) ||
      !isFiniteNumber(parsed.panY)
    ) {
      return null;
    }
    return {
      userZoom: clampUserZoom(parsed.userZoom),
      panX: parsed.panX,
      panY: parsed.panY,
    };
  } catch {
    return null;
  }
}

/** Persist camera for re-entry (home ↔ editor, refresh). */
export function saveWallViewport(wallId: string, snap: WallViewportSnapshot): void {
  if (!wallId || typeof window === "undefined") return;
  try {
    const payload: WallViewportSnapshot = {
      userZoom: clampUserZoom(snap.userZoom),
      panX: snap.panX,
      panY: snap.panY,
    };
    localStorage.setItem(storageKey(wallId), JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function clearWallViewport(wallId: string): void {
  if (!wallId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(wallId));
  } catch {
    // ignore
  }
}
