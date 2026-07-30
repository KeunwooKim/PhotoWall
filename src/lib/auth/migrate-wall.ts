import type { PublishedWall, WallThemeId } from "@/types/wall";
import { loadWall, saveWall, getOrCreateWallId, setPersonalWallId } from "@/lib/wall-storage";
import { authFetch } from "@/lib/auth/api-fetch";
import { sceneRevisionFromJson } from "@/lib/wall-scene/scene-revision";

function isValidWallId(id: string): boolean {
  return id !== "my-wall" && id.length === 36;
}

export type CloudSaveResult = {
  wall: PublishedWall | null;
  conflictWall?: PublishedWall;
  message?: string;
  restricted?: boolean;
};

export async function saveWallToCloud(
  themeId: WallThemeId,
  canvasJson: object,
  wallId?: string,
  baseRevision?: number,
): Promise<CloudSaveResult> {
  const id = wallId ?? getOrCreateWallId();

  const res = await authFetch("/api/walls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: isValidWallId(id) ? id : undefined,
      themeId,
      canvasJson,
      baseRevision,
    }),
  });

  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as {
      wall?: PublishedWall;
      message?: string;
    };
    return {
      wall: null,
      conflictWall: body.wall,
      message: body.message,
    };
  }

  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    return {
      wall: null,
      restricted: body.error === "account_restricted",
      message: body.message,
    };
  }

  if (!res.ok) return { wall: null };

  const wall = (await res.json()) as PublishedWall;
  setPersonalWallId(wall.id);
  return { wall };
}

export async function migrateLocalWallToCloud(): Promise<{
  id: string;
  themeId: WallThemeId;
} | null> {
  const local = loadWall();
  if (!local) return null;

  const { wall } = await saveWallToCloud(
    local.themeId,
    local.canvasJson,
    local.id,
    sceneRevisionFromJson(local.canvasJson),
  );
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
