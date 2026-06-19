import type { WallData } from "@/types/wall";
import { authFetch } from "@/lib/auth/api-fetch";

export function encodeWallForShare(data: Pick<WallData, "themeId" | "canvasJson">): string {
  const json = JSON.stringify({ t: data.themeId, c: data.canvasJson });
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeWallFromShare(encoded: string): Pick<WallData, "themeId" | "canvasJson"> | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as { t: WallData["themeId"]; c: object };
    if (!parsed.t || !parsed.c) return null;
    return { themeId: parsed.t, canvasJson: parsed.c };
  } catch {
    return null;
  }
}

export async function publishWall(data: WallData): Promise<{ id: string; url: string }> {
  const res = await authFetch("/api/walls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: data.id !== "my-wall" ? data.id : undefined,
      themeId: data.themeId,
      canvasJson: data.canvasJson,
    }),
  });

  if (res.ok) {
    const wall = (await res.json()) as { id: string };
    const url = `${window.location.origin}/wall/${wall.id}`;
    return { id: wall.id, url };
  }

  const encoded = encodeWallForShare(data);
  if (encoded.length > 6000) {
    throw new Error("벽 데이터가 너무 커서 링크 공유가 어려워요. Supabase를 설정해 주세요.");
  }

  const url = `${window.location.origin}/wall/share?d=${encoded}`;
  return { id: "share", url };
}
