import { authFetch } from "@/lib/auth/api-fetch";
import { captureWallElementPreview } from "@/lib/storage/wall-preview";
import { getWallTheme } from "@/lib/wall-themes";
import type Konva from "konva";

/** Upload a wall preview JPEG; returns storage path on success. */
export async function uploadWallPreviewBlob(
  wallId: string,
  blob: Blob,
): Promise<string | null> {
  const form = new FormData();
  form.append("preview", blob, "preview.jpg");

  const res = await authFetch(`/api/walls/${wallId}/preview`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as { previewPath?: string } | null;
  return body?.previewPath ?? null;
}

/** Capture wallpaper + stickers/photos from the wall frame (+ optional Konva stage). */
export async function uploadWallPreviewFromElement(
  wallId: string,
  element: HTMLElement | null | undefined,
  options?: {
    themeId?: string | null;
    stage?: Konva.Stage | null;
  },
): Promise<string | null> {
  if (!element) return null;
  try {
    const wallpaperSrc = options?.themeId
      ? getWallTheme(options.themeId).background
      : null;
    const blob = await captureWallElementPreview(element, {
      wallpaperSrc,
      stage: options?.stage ?? null,
    });
    return await uploadWallPreviewBlob(wallId, blob);
  } catch {
    return null;
  }
}
