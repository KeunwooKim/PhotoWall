import type { PublishedWall, WallThemeId } from "@/types/wall";
import { loadWall, saveWall, getOrCreateWallId, setPersonalWallId } from "@/lib/wall-storage";
import { authFetch } from "@/lib/auth/api-fetch";

function isValidWallId(id: string): boolean {
  return id !== "my-wall" && id.length === 36;
}

export async function saveWallToCloud(
  themeId: WallThemeId,
  canvasJson: object,
  wallId?: string,
): Promise<PublishedWall | null> {
  const id = wallId ?? getOrCreateWallId();

  const res = await authFetch("/api/walls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: isValidWallId(id) ? id : undefined,
      themeId,
      canvasJson,
    }),
  });

  if (!res.ok) return null;

  const wall = (await res.json()) as PublishedWall;
  setPersonalWallId(wall.id);
  return wall;
}

export async function migrateLocalWallToCloud(): Promise<{
  id: string;
  themeId: WallThemeId;
} | null> {
  const local = loadWall();
  if (!local) return null;

  const wall = await saveWallToCloud(local.themeId, local.canvasJson, local.id);
  if (!wall) return null;

  saveWall(wall.themeId, wall.canvasJson);
  return { id: wall.id, themeId: wall.themeId };
}

export async function fetchCloudWall(): Promise<PublishedWall | null> {
  const res = await authFetch("/api/walls/mine");
  if (!res.ok) return null;
  const wall = (await res.json()) as PublishedWall | null;
  if (!wall?.id) return null;
  return wall;
}
