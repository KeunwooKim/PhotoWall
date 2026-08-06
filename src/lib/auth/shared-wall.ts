import type { PublishedWall, WallThemeId } from "@/types/wall";
import type { WallMemberRole } from "@/types/shared-wall";
import { authFetch } from "@/lib/auth/api-fetch";

export interface SharedWallEditData extends PublishedWall {
  title: string;
  myRole: WallMemberRole;
}

export type FetchSharedWallResult =
  | { ok: true; wall: SharedWallEditData }
  | { ok: false; reason: "not_found" | "not_member" | "viewer_only" | "unauthorized" | "rate_limited" | "error" };

export async function fetchSharedWallForEdit(wallId: string): Promise<FetchSharedWallResult> {
  const res = await authFetch(`/api/shared-walls/${wallId}`);
  if (res.ok) {
    return { ok: true, wall: (await res.json()) as SharedWallEditData };
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) return { ok: false, reason: "unauthorized" };
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  if (res.status === 403 && body.error === "viewer_only") return { ok: false, reason: "viewer_only" };
  if (res.status === 403 && body.error === "not_member") return { ok: false, reason: "not_member" };
  if (res.status >= 500) return { ok: false, reason: "error" };
  return { ok: false, reason: "not_found" };
}

export async function saveSharedWallToCloud(
  wallId: string,
  themeId: WallThemeId,
  canvasJson: object,
  baseRevision?: number,
): Promise<{
  wall: PublishedWall | null;
  conflictWall?: PublishedWall;
  message?: string;
  restricted?: boolean;
}> {
  const res = await authFetch(`/api/shared-walls/${wallId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ themeId, canvasJson, baseRevision }),
  });

  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as {
      wall?: PublishedWall;
      message?: string;
    };
    return { wall: null, conflictWall: body.wall, message: body.message };
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
  return { wall: (await res.json()) as PublishedWall };
}

/** Rename a shared wall title (editor must already have edit access). */
export async function updateSharedWallTitle(wallId: string, title: string): Promise<string> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("이름을 입력해 주세요");

  const res = await authFetch(`/api/shared-walls/${wallId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: trimmed }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || "이름 저장에 실패했어요");
  }

  const data = (await res.json()) as { title?: string };
  return data.title ?? trimmed;
}
