import { loadHtmlImage } from "@/lib/storage/load-html-image";

const PREVIEW_MAX_EDGE = 1600;
const PREVIEW_MIME = "image/jpeg";
const PREVIEW_QUALITY = 0.82;

function parseCssUrl(value: string): string | null {
  const match = /url\(\s*(['"]?)(.+?)\1\s*\)/i.exec(value);
  return match?.[2] ?? null;
}

/** Resolve `url('/wallpapers/x.png')` or a bare path to an absolute same-origin URL. */
export function resolveWallpaperSrc(backgroundOrPath: string): string | null {
  const raw = parseCssUrl(backgroundOrPath) ?? backgroundOrPath.trim();
  if (!raw || raw === "none") return null;
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("blob:") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }
  if (typeof window === "undefined") return raw;
  return new URL(raw, window.location.origin).href;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destW: number,
  destH: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(destW / iw, destH / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, (destW - w) / 2, (destH - h) / 2, w, h);
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) =>
          blob && blob.size > 0
            ? resolve(blob)
            : reject(new Error("Empty preview blob")),
        PREVIEW_MIME,
        PREVIEW_QUALITY,
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Preview encode failed"));
    }
  });
}

async function paintWallpaper(
  ctx: CanvasRenderingContext2D,
  wallpaperSrc: string | null,
  outW: number,
  outH: number,
) {
  if (wallpaperSrc) {
    try {
      const img = await loadHtmlImage(wallpaperSrc);
      drawImageCover(ctx, img, outW, outH);
      return;
    } catch {
      // fall through
    }
  }
  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(0, 0, outW, outH);
}

type StageLike = {
  width: () => number;
  height: () => number;
  toDataURL: (config?: {
    pixelRatio?: number;
    mimeType?: string;
    quality?: number;
  }) => string;
};

/**
 * Capture wallpaper + Konva objects (photos, stickers, drawings) as JPEG.
 *
 * CSS wallpaper lives on a transformed wrapper — html2canvas often drops it.
 * We paint the wallpaper ourselves, then overlay scene pixels from Konva.
 */
export async function captureWallElementPreview(
  element: HTMLElement,
  options?: {
    wallpaperSrc?: string | null;
    stage?: StageLike | null;
  },
): Promise<Blob> {
  const width = element.offsetWidth || element.clientWidth || 1;
  const height = element.offsetHeight || element.clientHeight || 1;
  const scale = Math.min(2, PREVIEW_MAX_EDGE / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const wallpaperSrc =
    resolveWallpaperSrc(options?.wallpaperSrc ?? "") ??
    resolveWallpaperSrc(
      element.style.backgroundImage ||
        element.style.background ||
        getComputedStyle(element).backgroundImage,
    );

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  await paintWallpaper(ctx, wallpaperSrc, outW, outH);

  // 1) Prefer Konva export (includes stickers/photos/drawings at correct layout)
  const stage = options?.stage;
  if (stage) {
    try {
      const pixelRatio = Math.min(
        2,
        PREVIEW_MAX_EDGE / Math.max(stage.width(), stage.height(), 1),
      );
      const dataUrl = stage.toDataURL({ pixelRatio, mimeType: "image/png" });
      const sceneImg = await loadHtmlImage(dataUrl);
      ctx.drawImage(sceneImg, 0, 0, outW, outH);
      return await canvasToJpeg(out);
    } catch {
      // Canvas tainted or export failed — try DOM capture below
    }
  }

  // 2) Draw Konva layer canvases directly (avoids CSS transform on the frame)
  const konvaContent = element.querySelector(".konvajs-content") as HTMLElement | null;
  const layerRoot = konvaContent ?? element;
  const layerCanvases = layerRoot.querySelectorAll("canvas");
  if (layerCanvases.length > 0) {
    for (const layer of layerCanvases) {
      try {
        ctx.drawImage(layer, 0, 0, outW, outH);
      } catch {
        // ignore individual layer failures
      }
    }
    try {
      return await canvasToJpeg(out);
    } catch {
      // Tainted composite — fall through to html2canvas / wallpaper-only
    }
  }

  // 3) html2canvas on untransformed konva content
  try {
    const { default: html2canvas } = await import("html2canvas");
    const captureTarget = konvaContent ?? element;
    const scene = await html2canvas(captureTarget, {
      useCORS: true,
      allowTaint: true,
      scale,
      backgroundColor: null,
      logging: false,
      width,
      height,
      onclone: (_doc, cloned) => {
        const node = cloned as HTMLElement;
        node.style.transform = "none";
        node.style.left = "0";
        node.style.top = "0";
        node.style.background = "transparent";
        node.style.backgroundImage = "none";
      },
    });

    const composite = document.createElement("canvas");
    composite.width = outW;
    composite.height = outH;
    const cctx = composite.getContext("2d");
    if (!cctx) throw new Error("2d context unavailable");
    await paintWallpaper(cctx, wallpaperSrc, outW, outH);
    cctx.drawImage(scene, 0, 0, outW, outH);
    return await canvasToJpeg(composite);
  } catch {
    // Last resort: wallpaper only (still better than empty / wrong crop)
    const safe = document.createElement("canvas");
    safe.width = outW;
    safe.height = outH;
    const safeCtx = safe.getContext("2d");
    if (!safeCtx) throw new Error("2d context unavailable");
    await paintWallpaper(safeCtx, wallpaperSrc, outW, outH);
    return canvasToJpeg(safe);
  }
}

export function wallPreviewStoragePath(userId: string, wallId: string): string {
  return `${userId}/previews/${wallId}.jpg`;
}
