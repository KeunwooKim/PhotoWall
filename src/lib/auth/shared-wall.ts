import type { PublishedWall, WallThemeId } from "@/types/wall";
import type { WallMemberRole } from "@/types/shared-wall";
import { authFetch } from "@/lib/auth/api-fetch";

export interface SharedWallEditData extends PublishedWall {
  title: string;
  myRole: WallMemberRole;
}

export type FetchSharedWallResult =
  | { ok: true; wall: SharedWallEditData }
  | { ok: false; reason: "not_found" | "not_member" | "viewer_only" | "unauthorized" };

export async function fetchSharedWallForEdit(wallId: string): Promise<FetchSharedWallResult> {
  const res = await authFetch(`/api/shared-walls/${wallId}`);
  if (res.ok) {
    return { ok: true, wall: (await res.json()) as SharedWallEditData };
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) return { ok: false, reason: "unauthorized" };
  if (res.status === 403 && body.error === "viewer_only") return { ok: false, reason: "viewer_only" };
  if (res.status === 403 && body.error === "not_member") return { ok: false, reason: "not_member" };
  return { ok: false, reason: "not_found" };
}

export async function saveSharedWallToCloud(
  wallId: string,
  themeId: WallThemeId,
  canvasJson: object,
): Promise<PublishedWall | null> {
  const res = await authFetch(`/api/shared-walls/${wallId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ themeId, canvasJson }),
  });

  if (!res.ok) return null;
  return (await res.json()) as PublishedWall;
}
