import { authFetch } from "@/lib/auth/api-fetch";
import { captureWallElementPreview } from "@/lib/storage/wall-preview";
import { getWallTheme } from "@/lib/wall-themes";

type StageExportLike = {
  width: () => number;
  height: () => number;
  toDataURL: (config?: {
    pixelRatio?: number;
    mimeType?: string;
    quality?: number;
  }) => string;
  prepareFullExport?: () => Promise<void>;
};

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

/** Capture wallpaper + stickers/photos from the wall frame (+ optional stage export). */
export async function uploadWallPreviewFromElement(
  wallId: string,
  element: HTMLElement | null | undefined,
  options?: {
    themeId?: string | null;
    stage?: StageExportLike | null;
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
