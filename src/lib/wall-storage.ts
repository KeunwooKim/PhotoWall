import type { WallData, WallThemeId } from "@/types/wall";

const STORAGE_KEY = "photowall-data";
/** 개인 벽 전용 ID — 공동 벽 ID와 절대 공유하지 않음 */
const WALL_ID_KEY = "photowall-personal-wall-id";
const LEGACY_WALL_ID_KEY = "photowall-wall-id";

export function getOrCreateWallId(): string {
  if (typeof window === "undefined") return "my-wall";

  let id = localStorage.getItem(WALL_ID_KEY) ?? localStorage.getItem(LEGACY_WALL_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(WALL_ID_KEY, id);
  } else if (!localStorage.getItem(WALL_ID_KEY)) {
    localStorage.setItem(WALL_ID_KEY, id);
  }
  return id;
}

export function setPersonalWallId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WALL_ID_KEY, id);
}

export function loadWall(): WallData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WallData;
  } catch {
    return null;
  }
}

export function saveWall(themeId: WallThemeId, canvasJson: object): WallData {
  const data: WallData = {
    id: getOrCreateWallId(),
    themeId,
    canvasJson,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function clearWall(): void {
  localStorage.removeItem(STORAGE_KEY);
}
