import type { PublishedWall, WallThemeId } from "@/types/wall";
import type { WallMemberRole } from "@/types/shared-wall";
import { authFetch } from "@/lib/auth/api-fetch";

export interface SharedWallEditData extends PublishedWall {
  title: string;
  myRole: WallMemberRole;
}

export async function fetchSharedWallForEdit(
  wallId: string,
): Promise<SharedWallEditData | null> {
  const res = await authFetch(`/api/shared-walls/${wallId}`);
  if (!res.ok) return null;
  return (await res.json()) as SharedWallEditData;
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
