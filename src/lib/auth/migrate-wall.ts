import type { PublishedWall, WallThemeId } from "@/types/wall";
import { loadWall, saveWall, getOrCreateWallId, setPersonalWallId } from "@/lib/wall-storage";
import { authFetch } from "@/lib/auth/api-fetch";
import { sceneRevisionFromJson } from "@/lib/wall-scene/scene-revision";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import {
  documentHasUploadableLocalPhotos,
  migrateGuestPhotosInDocument,
} from "@/lib/storage/migrate-guest-photos";
import type { UserPlan } from "@/lib/wall-quotas";
import type { WallSceneDocument } from "@/types/wall-scene-v2";

function isValidWallId(id: string): boolean {
  return id !== "my-wall" && id.length === 36;
}

export type CloudSaveResult = {
  wall: PublishedWall | null;
  conflictWall?: PublishedWall;
  message?: string;
  restricted?: boolean;
  /** Scene after guest→cloud photo migration (caller may reload store). */
  migratedDocument?: WallSceneDocument;
};

async function canvasJsonForCloud(
  canvasJson: object,
  userId?: string,
  plan: UserPlan = "free",
): Promise<{ canvasJson: object; migratedDocument?: WallSceneDocument }> {
  if (!userId) return { canvasJson };

  let doc: WallSceneDocument;
  try {
    doc = parseWallScene(canvasJson);
  } catch {
    return { canvasJson };
  }

  if (!documentHasUploadableLocalPhotos(doc)) {
    return { canvasJson };
  }

  const { document } = await migrateGuestPhotosInDocument(doc, userId, plan);
  return {
    canvasJson: serializeWallScene(document),
    migratedDocument: document,
  };
}

export async function saveWallToCloud(
  themeId: WallThemeId,
  canvasJson: object,
  wallId?: string,
  baseRevision?: number,
  userId?: string,
  plan: UserPlan = "free",
): Promise<CloudSaveResult> {
  const id = wallId ?? getOrCreateWallId();
  const prepared = await canvasJsonForCloud(canvasJson, userId, plan);

  const res = await authFetch("/api/walls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: isValidWallId(id) ? id : undefined,
      themeId,
      canvasJson: prepared.canvasJson,
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
      migratedDocument: prepared.migratedDocument,
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
      migratedDocument: prepared.migratedDocument,
    };
  }

  if (!res.ok) {
    return { wall: null, migratedDocument: prepared.migratedDocument };
  }

  const wall = (await res.json()) as PublishedWall;
  setPersonalWallId(wall.id);

  if (prepared.migratedDocument) {
    saveWall(themeId, prepared.canvasJson);
  }

  return { wall, migratedDocument: prepared.migratedDocument };
}

export async function migrateLocalWallToCloud(
  userId: string,
  plan: UserPlan = "free",
): Promise<{
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
    userId,
    plan,
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
