import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { DEFAULT_WALL_BOUNDS } from "@/lib/wall-bounds";

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

function drawImageTiled(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  outW: number,
  outH: number,
  logicalWallW: number,
  logicalWallH: number,
  offsetX = 0,
  offsetY = 0,
) {
  const scaleX = outW / Math.max(1, logicalWallW);
  const scaleY = outH / Math.max(1, logicalWallH);
  const tileW = Math.max(1, DEFAULT_WALL_BOUNDS.width * scaleX);
  const tileH = Math.max(1, DEFAULT_WALL_BOUNDS.height * scaleY);
  const originX = offsetX * scaleX;
  const originY = offsetY * scaleY;

  // Walk enough tiles to cover the canvas given an arbitrary offset.
  const startX = originX > 0 ? originX - tileW * Math.ceil(originX / tileW) : originX;
  const startY = originY > 0 ? originY - tileH * Math.ceil(originY / tileH) : originY;

  for (let y = startY; y < outH; y += tileH) {
    for (let x = startX; x < outW; x += tileW) {
      ctx.drawImage(img, x, y, tileW, tileH);
    }
  }
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

function parseCssPxOffset(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function wallpaperOffsetFromElement(element: HTMLElement): { x: number; y: number } {
  const pos = getComputedStyle(element).backgroundPosition || "0px 0px";
  const [xRaw, yRaw] = pos.trim().split(/\s+/);
  return {
    x: parseCssPxOffset(xRaw),
    y: parseCssPxOffset(yRaw ?? xRaw),
  };
}

async function paintWallpaper(
  ctx: CanvasRenderingContext2D,
  wallpaperSrc: string | null,
  outW: number,
  outH: number,
  logicalWallW: number,
  logicalWallH: number,
  offsetX = 0,
  offsetY = 0,
) {
  if (wallpaperSrc) {
    try {
      const img = await loadHtmlImage(wallpaperSrc);
      drawImageTiled(ctx, img, outW, outH, logicalWallW, logicalWallH, offsetX, offsetY);
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
 * Compose wallpaper + a stage scene data URL into a JPEG preview blob.
 * Used for live stage export and for SPA-leave snapshots after the engine is gone.
 */
export async function composeWallPreviewJpeg(options: {
  wallpaperSrc?: string | null;
  sceneDataUrl: string;
  wallWidth: number;
  wallHeight: number;
  wallpaperOffsetX?: number;
  wallpaperOffsetY?: number;
}): Promise<Blob> {
  const width = Math.max(1, options.wallWidth);
  const height = Math.max(1, options.wallHeight);
  const scale = Math.min(2, PREVIEW_MAX_EDGE / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  await paintWallpaper(
    ctx,
    resolveWallpaperSrc(options.wallpaperSrc ?? ""),
    outW,
    outH,
    width,
    height,
    options.wallpaperOffsetX ?? 0,
    options.wallpaperOffsetY ?? 0,
  );

  const sceneImg = await loadHtmlImage(options.sceneDataUrl);
  ctx.drawImage(sceneImg, 0, 0, outW, outH);
  return canvasToJpeg(out);
}

/** Sync stage → PNG data URL suitable for pending leave capture. */
export function exportStageSceneDataUrl(stage: StageLike): string {
  const pixelRatio = Math.min(
    2,
    PREVIEW_MAX_EDGE / Math.max(stage.width(), stage.height(), 1),
  );
  return stage.toDataURL({ pixelRatio, mimeType: "image/png" });
}

/**
 * Capture wallpaper + wall objects (photos, stickers, drawings) as JPEG.
 *
 * CSS wallpaper may live on a transformed wrapper — html2canvas often drops it.
 * We paint the wallpaper ourselves, then overlay scene pixels from the stage export.
 */
export async function captureWallElementPreview(
  element: HTMLElement,
  options?: {
    wallpaperSrc?: string | null;
    stage?: StageLike | null;
  },
): Promise<Blob> {
  const wallpaperOffset = wallpaperOffsetFromElement(element);
  const wallpaperSrc =
    resolveWallpaperSrc(options?.wallpaperSrc ?? "") ??
    resolveWallpaperSrc(
      element.style.backgroundImage ||
        element.style.background ||
        getComputedStyle(element).backgroundImage,
    );

  // 1) Prefer stage export (Konva or Pixi) — wall-sized, not viewport-sized
  const stage = options?.stage;
  if (stage) {
    try {
      return await composeWallPreviewJpeg({
        wallpaperSrc: options?.wallpaperSrc ?? wallpaperSrc,
        sceneDataUrl: exportStageSceneDataUrl(stage),
        wallWidth: stage.width(),
        wallHeight: stage.height(),
        wallpaperOffsetX: wallpaperOffset.x,
        wallpaperOffsetY: wallpaperOffset.y,
      });
    } catch {
      // Canvas tainted or export failed — try DOM capture below
    }
  }

  const width = element.offsetWidth || element.clientWidth || 1;
  const height = element.offsetHeight || element.clientHeight || 1;
  const scale = Math.min(2, PREVIEW_MAX_EDGE / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  await paintWallpaper(
    ctx,
    wallpaperSrc,
    outW,
    outH,
    width,
    height,
    wallpaperOffset.x,
    wallpaperOffset.y,
  );

  // 2) Draw layer canvases directly (Konva .konvajs-content or Pixi canvas)
  // Skip empty / cleared canvases — a destroyed Pixi buffer is often opaque black
  // and would wipe the wallpaper we just painted.
  const konvaContent = element.querySelector(".konvajs-content") as HTMLElement | null;
  const pixiCanvas = element.querySelector("canvas") as HTMLCanvasElement | null;
  const layerRoot = konvaContent ?? element;
  const layerCanvases = konvaContent
    ? layerRoot.querySelectorAll("canvas")
    : pixiCanvas
      ? ([pixiCanvas] as unknown as NodeListOf<HTMLCanvasElement>)
      : ([] as unknown as NodeListOf<HTMLCanvasElement>);
  if (layerCanvases.length > 0) {
    let drew = false;
    for (const layer of layerCanvases) {
      if (!layer.width || !layer.height) continue;
      try {
        ctx.drawImage(layer, 0, 0, outW, outH);
        drew = true;
      } catch {
        // ignore individual layer failures
      }
    }
    if (drew) {
      try {
        return await canvasToJpeg(out);
      } catch {
        // Tainted composite — fall through to html2canvas / wallpaper-only
      }
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
    await paintWallpaper(cctx, wallpaperSrc, outW, outH, width, height);
    cctx.drawImage(scene, 0, 0, outW, outH);
    return await canvasToJpeg(composite);
  } catch {
    // Last resort: wallpaper only (still better than empty / wrong crop)
    const safe = document.createElement("canvas");
    safe.width = outW;
    safe.height = outH;
    const safeCtx = safe.getContext("2d");
    if (!safeCtx) throw new Error("2d context unavailable");
    await paintWallpaper(safeCtx, wallpaperSrc, outW, outH, width, height);
    return canvasToJpeg(safe);
  }
}

/** Preview object path. Pass `rev` to bust CDN/browser caches after upsert. */
export function wallPreviewStoragePath(
  userId: string,
  wallId: string,
  rev: number | string = Date.now(),
): string {
  return `${userId}/previews/${wallId}-${rev}.jpg`;
}
