import { captureWallElementPreview } from "@/lib/storage/wall-preview";
import {
  captureWallRegionPreview,
  wallpaperOffsetFromElement,
} from "@/lib/storage/wall-preview";
import { getWallTheme } from "@/lib/wall-themes";
import {
  getInstagramExportPreset,
  type InstagramExportPresetId,
  type WallExportRect,
} from "@/lib/wall-scene/instagram-export";

type StageExportLike = {
  width: () => number;
  height: () => number;
  toDataURL: (config?: {
    pixelRatio?: number;
    mimeType?: string;
    frame?: WallExportRect;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => string;
  prepareFullExport?: () => Promise<void>;
};

export async function exportWallRegionAsBlob(options: {
  element: HTMLElement | null | undefined;
  stage: StageExportLike | null | undefined;
  region: WallExportRect;
  presetId: InstagramExportPresetId;
  themeId?: string | null;
  wallX?: number;
  wallY?: number;
  wallpaperOffsetX?: number;
  wallpaperOffsetY?: number;
}): Promise<Blob> {
  const { stage, region, presetId } = options;
  if (!stage) throw new Error("Stage unavailable");
  const preset = getInstagramExportPreset(presetId);
  const wallpaperSrc = options.themeId
    ? getWallTheme(options.themeId).background
    : null;
  const offset = options.element
    ? wallpaperOffsetFromElement(options.element)
    : { x: options.wallpaperOffsetX ?? 0, y: options.wallpaperOffsetY ?? 0 };

  return captureWallRegionPreview({
    region,
    outW: preset.outW,
    outH: preset.outH,
    wallpaperSrc,
    stage,
    wallX: options.wallX ?? 0,
    wallY: options.wallY ?? 0,
    wallpaperOffsetX: options.wallpaperOffsetX ?? offset.x,
    wallpaperOffsetY: options.wallpaperOffsetY ?? offset.y,
  });
}

export async function downloadWallRegionImage(
  options: Parameters<typeof exportWallRegionAsBlob>[0],
) {
  const preset = getInstagramExportPreset(options.presetId);
  const blob = await exportWallRegionAsBlob(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `photowall-instagram-${preset.id.replace(":", "x")}.jpg`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareWallRegionImage(
  options: Parameters<typeof exportWallRegionAsBlob>[0],
) {
  const preset = getInstagramExportPreset(options.presetId);
  const blob = await exportWallRegionAsBlob(options);
  const file = new File(
    [blob],
    `photowall-instagram-${preset.id.replace(":", "x")}.jpg`,
    { type: "image/jpeg" },
  );

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "내 포토월",
      text: "PhotoWall에서 꾸민 내 벽이에요!",
      files: [file],
    });
    return;
  }

  await downloadWallRegionImage(options);
}

export async function exportWallAsImage(element: HTMLElement): Promise<Blob> {
  return captureWallElementPreview(element);
}

export async function downloadWallImage(element: HTMLElement, filename = "photowall.png") {
  const blob = await exportWallAsImage(element);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareWallImage(element: HTMLElement) {
  const blob = await exportWallAsImage(element);
  const file = new File([blob], "photowall.jpg", { type: "image/jpeg" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "내 디지털 포토월",
      text: "PhotoWall에서 꾸민 내 벽이에요!",
      files: [file],
    });
    return;
  }

  await downloadWallImage(element, "photowall.jpg");
}
