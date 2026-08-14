import type { PhotoCropRect, WallSceneFourCut, WallScenePhoto } from "@/types/wall-scene-v2";
import { GRID2X2_ASPECT, STACK4_ASPECT } from "./catalog";
import type { FourCutHoleFractions, FourCutLayout } from "./types";

const MIN_WINDOW = 8;

/** Midpoint between STACK4_ASPECT (2/6) and GRID2X2_ASPECT (4/6). */
const LAYOUT_ASPECT_SPLIT = 0.5;

export function aspectForLayout(layout: FourCutLayout): number {
  return layout === "grid2x2" ? GRID2X2_ASPECT : STACK4_ASPECT;
}

/** On-wall box width/height — real 2×6 strip or 4×6 postcard. */
export function aspectForFourCutBox(
  layout: FourCutLayout,
  _windows?: Array<{ width: number; height: number }>,
): number {
  return aspectForLayout(layout);
}

export function layoutFromAspect(aspect: number): FourCutLayout {
  return aspect < LAYOUT_ASPECT_SPLIT ? "stack4" : "grid2x2";
}

export function resizeBoxKeepCenterArea(
  box: { x: number; y: number; width: number; height: number },
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  const area = Math.max(1, box.width * box.height);
  const height = Math.sqrt(area / Math.max(0.05, aspect));
  const width = height * aspect;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Keep the current center; use the given width/height (원본 size restore). */
export function boxKeepCenter(
  current: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const cx = current.x + current.width / 2;
  const cy = current.y + current.height / 2;
  return {
    x: cx - size.width / 2,
    y: cy - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

export function fourCutBoxAspectClose(current: number, target: number): boolean {
  return Math.abs(current - target) / Math.max(target, 0.01) < 0.12;
}

/** Chrome as fractions of a 2×6 (51×152mm) 4-up strip. */
const STACK_SIDE = 0.04;
const STACK_HEADER = 0.08;
const STACK_FOOTER = 0.07;
const STACK_GAP = 0.012;

/** Chrome as fractions of a 4×6 (102×152mm) 2×2 postcard. */
const GRID_SIDE = 0.03;
const GRID_HEADER = 0.08;
const GRID_FOOTER = 0.07;
const GRID_GAP_X = 0.03;
const GRID_GAP_Y = 0.02;

/** Source-pixel windows at the catalog hole fractions (used when detect missed). */
export function canonicalFourCutWindows(
  layout: FourCutLayout,
  sourceWidth: number,
  sourceHeight: number,
): [PhotoCropRect, PhotoCropRect, PhotoCropRect, PhotoCropRect] {
  const holes = fourCutHoleFractions(layout);
  return holes.map((hole) => ({
    x: hole.x * sourceWidth,
    y: hole.y * sourceHeight,
    width: hole.width * sourceWidth,
    height: hole.height * sourceHeight,
  })) as [PhotoCropRect, PhotoCropRect, PhotoCropRect, PhotoCropRect];
}

export function fourCutHoleFractions(layout: FourCutLayout): FourCutHoleFractions[] {
  if (layout === "grid2x2") {
    const cellW = (1 - 2 * GRID_SIDE - GRID_GAP_X) / 2;
    const cellH = (1 - GRID_HEADER - GRID_FOOTER - GRID_GAP_Y) / 2;
    const left = GRID_SIDE;
    const right = GRID_SIDE + cellW + GRID_GAP_X;
    const top = GRID_HEADER;
    const bottom = GRID_HEADER + cellH + GRID_GAP_Y;
    return [
      { x: left, y: top, width: cellW, height: cellH },
      { x: right, y: top, width: cellW, height: cellH },
      { x: left, y: bottom, width: cellW, height: cellH },
      { x: right, y: bottom, width: cellW, height: cellH },
    ];
  }

  const cellW = 1 - 2 * STACK_SIDE;
  const innerH = 1 - STACK_HEADER - STACK_FOOTER - 3 * STACK_GAP;
  const cellH = innerH / 4;
  return [0, 1, 2, 3].map((index) => ({
    x: STACK_SIDE,
    y: STACK_HEADER + index * (cellH + STACK_GAP),
    width: cellW,
    height: cellH,
  }));
}

export function fourCutChromeBands(layout: FourCutLayout): {
  header: number;
  footer: number;
  side: number;
} {
  if (layout === "grid2x2") {
    return { header: GRID_HEADER, footer: GRID_FOOTER, side: GRID_SIDE };
  }
  return { header: STACK_HEADER, footer: STACK_FOOTER, side: STACK_SIDE };
}

function nativeLayoutFromBase(photo: WallScenePhoto): FourCutLayout {
  const box = photo.fourCut?.base ?? photo;
  return layoutFromAspect(box.width / Math.max(1, box.height));
}

/** Dest holes in photo-box pixels. Optional cellAspect keeps source windows uncropped. */
export function fourCutDestHoles(
  layout: FourCutLayout,
  boxWidth: number,
  boxHeight: number,
  cellAspect?: number,
): PhotoCropRect[] {
  if (!cellAspect || cellAspect <= 0) {
    return fourCutHoleFractions(layout).map((hole) => ({
      x: hole.x * boxWidth,
      y: hole.y * boxHeight,
      width: hole.width * boxWidth,
      height: hole.height * boxHeight,
    }));
  }

  const bands = fourCutChromeBands(layout);
  const inner = {
    x: bands.side * boxWidth,
    y: bands.header * boxHeight,
    width: Math.max(1, (1 - 2 * bands.side) * boxWidth),
    height: Math.max(1, (1 - bands.header - bands.footer) * boxHeight),
  };

  if (layout === "grid2x2") {
    const gapX = GRID_GAP_X * boxWidth;
    const gapY = GRID_GAP_Y * boxHeight;
    let cellW = (inner.width - gapX) / 2;
    let cellH = cellW / cellAspect;
    if (2 * cellH + gapY > inner.height) {
      cellH = (inner.height - gapY) / 2;
      cellW = cellH * cellAspect;
    }
    const gridW = 2 * cellW + gapX;
    const gridH = 2 * cellH + gapY;
    const ox = inner.x + (inner.width - gridW) / 2;
    const oy = inner.y + (inner.height - gridH) / 2;
    return [
      { x: ox, y: oy, width: cellW, height: cellH },
      { x: ox + cellW + gapX, y: oy, width: cellW, height: cellH },
      { x: ox, y: oy + cellH + gapY, width: cellW, height: cellH },
      { x: ox + cellW + gapX, y: oy + cellH + gapY, width: cellW, height: cellH },
    ];
  }

  const gap = STACK_GAP * boxHeight;
  let cellH = (inner.height - 3 * gap) / 4;
  let cellW = cellH * cellAspect;
  if (cellW > inner.width) {
    cellW = inner.width;
    cellH = cellW / cellAspect;
  }
  const stackH = 4 * cellH + 3 * gap;
  const ox = inner.x + (inner.width - cellW) / 2;
  const oy = inner.y + Math.max(0, (inner.height - stackH) / 2);
  return [0, 1, 2, 3].map((index) => ({
    x: ox,
    y: oy + index * (cellH + gap),
    width: cellW,
    height: cellH,
  }));
}

export function fourCutIsNativePrint(photo: WallScenePhoto): boolean {
  const fourCut = photo.fourCut;
  if (!fourCut) return false;
  return !fourCut.skinId && fourCut.layout === nativeLayoutFromBase(photo);
}

export function copyFourCutWindows(
  windows: WallSceneFourCut["windows"],
): WallSceneFourCut["windows"] {
  return windows.map((window) => ({
    x: window.x,
    y: window.y,
    width: window.width,
    height: window.height,
  })) as WallSceneFourCut["windows"];
}

export function ensureFourCutBaseWindows(fourCut: WallSceneFourCut): WallSceneFourCut {
  if (fourCut.baseWindows?.length === 4 && fourCut.baseWindows.every((window) => window.width > 0 && window.height > 0)) {
    return fourCut;
  }
  return { ...fourCut, baseWindows: copyFourCutWindows(fourCut.windows) };
}

export function windowsClose(a: PhotoCropRect, b: PhotoCropRect, eps = 0.5): boolean {
  return (
    Math.abs(a.x - b.x) <= eps &&
    Math.abs(a.y - b.y) <= eps &&
    Math.abs(a.width - b.width) <= eps &&
    Math.abs(a.height - b.height) <= eps
  );
}

function projectSourceWindowsToBox(
  windows: PhotoCropRect[],
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
): PhotoCropRect[] {
  const sx = boxWidth / Math.max(1, sourceWidth);
  const sy = boxHeight / Math.max(1, sourceHeight);
  return windows.map((window) => ({
    x: window.x * sx,
    y: window.y * sy,
    width: window.width * sx,
    height: window.height * sy,
  }));
}

/**
 * Dest holes follow the current layout. Skip mapping when the original bitmap
 * already matches the layout and no theme is painted — show the print as-is.
 * After a slot crop, native prints keep the original cell holes and blit the
 * updated windows into them.
 */
export function fourCutHolesInPhoto(
  photo: WallScenePhoto,
  sourceWidth?: number,
  sourceHeight?: number,
): PhotoCropRect[] | null {
  const fourCut = photo.fourCut;
  if (!fourCut) return null;
  const mapped = Boolean(fourCut.skinId) || fourCut.layout !== nativeLayoutFromBase(photo);
  if (mapped) return fourCutDestHoles(fourCut.layout, photo.width, photo.height);
  const base = fourCut.baseWindows ?? fourCut.windows;
  const cropped = fourCut.windows.some((window, index) => !windowsClose(window, base[index]));
  if (!cropped || !sourceWidth || !sourceHeight) return null;
  return projectSourceWindowsToBox(base, sourceWidth, sourceHeight, photo.width, photo.height);
}

/** Dest holes for slot-crop overlay — always 4 holes, including native prints. */
export function fourCutSlotDestHoles(
  photo: WallScenePhoto,
  sourceWidth: number,
  sourceHeight: number,
): PhotoCropRect[] | null {
  if (!photo.fourCut) return null;
  const mapped = fourCutHolesInPhoto(photo, sourceWidth, sourceHeight);
  if (mapped) return mapped;
  return projectSourceWindowsToBox(
    photo.fourCut.baseWindows ?? photo.fourCut.windows,
    sourceWidth,
    sourceHeight,
    photo.width,
    photo.height,
  );
}

const EXPLODE_ROTATIONS = [-4.2, 3.6, -2.8, 5.1] as const;
const EXPLODE_COL = [-1, 1, -1, 1] as const;
const EXPLODE_ROW = [-1, -1, 1, 1] as const;
const EXPLODE_GAP = 16;

function cellDisplaySize(crop: PhotoCropRect, longSide: number): { width: number; height: number } {
  const aspect = crop.width / Math.max(1, crop.height);
  if (aspect >= 1) return { width: longSide, height: longSide / aspect };
  return { width: longSide * aspect, height: longSide };
}

/** 2×2 scatter around the strip center for exploding a 네컷 into four photos. */
export function explodeFourCutPlacement(
  origin: { x: number; y: number; width: number; height: number },
  windows: [PhotoCropRect, PhotoCropRect, PhotoCropRect, PhotoCropRect],
  sourceSize?: { width: number; height: number },
  scaleFrom?: { width: number; height: number },
): Array<{ x: number; y: number; width: number; height: number; rotation: number }> {
  const box = scaleFrom ?? origin;
  const sourceW = sourceSize?.width ?? 0;
  const sourceH = sourceSize?.height ?? 0;
  const projected =
    sourceW > 1 && sourceH > 1
      ? (() => {
          const scale = Math.min(box.width / sourceW, box.height / sourceH);
          return windows.map((window) => ({
            width: window.width * scale,
            height: window.height * scale,
          }));
        })()
      : null;

  const floor = Math.max(140, Math.min(origin.width, origin.height));
  let sizes = projected ?? windows.map((window) => cellDisplaySize(window, floor));
  const minLong = Math.min(...sizes.map((size) => Math.max(size.width, size.height)));
  const bump = minLong > 0 && minLong < floor ? floor / minLong : 1;
  sizes = sizes.map((size) => ({ width: size.width * bump, height: size.height * bump }));

  const avgW = sizes.reduce((sum, size) => sum + size.width, 0) / 4;
  const avgH = sizes.reduce((sum, size) => sum + size.height, 0) / 4;
  const cx = origin.x + origin.width / 2;
  const cy = origin.y + origin.height / 2;
  return sizes.map((size, index) => ({
    width: size.width,
    height: size.height,
    x: cx + EXPLODE_COL[index] * (avgW / 2 + EXPLODE_GAP / 2) - size.width / 2,
    y: cy + EXPLODE_ROW[index] * (avgH / 2 + EXPLODE_GAP / 2) - size.height / 2,
    rotation: EXPLODE_ROTATIONS[index],
  }));
}

/** Source window → dest hole, contain (letterbox, no crop / no stretch). */
export function containBlitRects(
  src: PhotoCropRect,
  dest: PhotoCropRect,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.min(dest.width / Math.max(1, src.width), dest.height / Math.max(1, src.height));
  const dw = src.width * scale;
  const dh = src.height * scale;
  return {
    sx: src.x,
    sy: src.y,
    sw: src.width,
    sh: src.height,
    dx: dest.x + (dest.width - dw) / 2,
    dy: dest.y + (dest.height - dh) / 2,
    dw,
    dh,
  };
}

/** Source window → dest hole, cover (center-crop). */
export function coverBlitRects(
  src: PhotoCropRect,
  dest: PhotoCropRect,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.max(dest.width / Math.max(1, src.width), dest.height / Math.max(1, src.height));
  const visW = dest.width / scale;
  const visH = dest.height / scale;
  return {
    sx: src.x + (src.width - visW) / 2,
    sy: src.y + (src.height - visH) / 2,
    sw: visW,
    sh: visH,
    dx: dest.x,
    dy: dest.y,
    dw: dest.width,
    dh: dest.height,
  };
}

/** Visible source rect that cover-fills dest. */
export function coverVisibleSource(src: PhotoCropRect, dest: PhotoCropRect): PhotoCropRect {
  const blit = coverBlitRects(src, dest);
  return { x: blit.sx, y: blit.sy, width: blit.sw, height: blit.sh };
}

export function destPointToSource(
  destPt: { x: number; y: number },
  src: PhotoCropRect,
  dest: PhotoCropRect,
): { x: number; y: number } {
  const blit = coverBlitRects(src, dest);
  return {
    x: blit.sx + ((destPt.x - blit.dx) / Math.max(1e-6, blit.dw)) * blit.sw,
    y: blit.sy + ((destPt.y - blit.dy) / Math.max(1e-6, blit.dh)) * blit.sh,
  };
}

export function sourcePointToDest(
  srcPt: { x: number; y: number },
  src: PhotoCropRect,
  dest: PhotoCropRect,
): { x: number; y: number } {
  const blit = coverBlitRects(src, dest);
  return {
    x: blit.dx + ((srcPt.x - blit.sx) / Math.max(1e-6, blit.sw)) * blit.dw,
    y: blit.dy + ((srcPt.y - blit.sy) / Math.max(1e-6, blit.sh)) * blit.dh,
  };
}

/** Keep `window` inside `bounds`. Zoom-out max is the original cell. */
export function clampWindowInside(window: PhotoCropRect, bounds: PhotoCropRect): PhotoCropRect {
  const width = Math.min(Math.max(MIN_WINDOW, window.width), bounds.width);
  const height = Math.min(Math.max(MIN_WINDOW, window.height), bounds.height);
  const x = Math.min(Math.max(bounds.x, window.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(bounds.y, window.y), bounds.y + bounds.height - height);
  return { x, y, width, height };
}

/**
 * Pan/zoom a cell window. `scale` > 1 zooms in (smaller window).
 * Result stays inside `originalWindow`; zoom-out max is the original cell.
 */
export function panZoomWindow(
  originalWindow: PhotoCropRect,
  pan: { x: number; y: number },
  scale: number,
): PhotoCropRect {
  const zoom = Math.max(1, scale);
  const width = originalWindow.width / zoom;
  const height = originalWindow.height / zoom;
  return clampWindowInside(
    {
      x: originalWindow.x + (originalWindow.width - width) / 2 + pan.x,
      y: originalWindow.y + (originalWindow.height - height) / 2 + pan.y,
      width,
      height,
    },
    originalWindow,
  );
}

/** Place the original cell image so `window` cover-fills `dest`. */
export function slotImagePlacement(
  bounds: PhotoCropRect,
  window: PhotoCropRect,
  dest: PhotoCropRect,
): { x: number; y: number; width: number; height: number } {
  const blit = coverBlitRects(window, dest);
  const scaleX = blit.dw / Math.max(1e-6, blit.sw);
  const scaleY = blit.dh / Math.max(1e-6, blit.sh);
  return {
    x: blit.dx - (blit.sx - bounds.x) * scaleX,
    y: blit.dy - (blit.sy - bounds.y) * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY,
  };
}

/** Visible dest-aspect crop inside `bounds` — this is what dragging reframes. */
export function fitWindowToDest(
  window: PhotoCropRect,
  dest: PhotoCropRect,
  bounds: PhotoCropRect,
): PhotoCropRect {
  return clampWindowInside(coverVisibleSource(window, dest), bounds);
}

export function panWindowByDestDelta(
  window: PhotoCropRect,
  destDelta: { x: number; y: number },
  dest: PhotoCropRect,
  bounds: PhotoCropRect,
): PhotoCropRect {
  const visible = coverVisibleSource(window, dest);
  const blit = coverBlitRects(window, dest);
  const scaleX = blit.dw / Math.max(1e-6, blit.sw);
  const scaleY = blit.dh / Math.max(1e-6, blit.sh);
  return clampWindowInside(
    {
      ...visible,
      x: visible.x - destDelta.x / scaleX,
      y: visible.y - destDelta.y / scaleY,
    },
    bounds,
  );
}

export function zoomWindowAtDest(
  window: PhotoCropRect,
  factor: number,
  dest: PhotoCropRect,
  bounds: PhotoCropRect,
  destPivot?: { x: number; y: number },
): PhotoCropRect {
  const visible = coverVisibleSource(window, dest);
  const destAspect = dest.width / Math.max(1e-6, dest.height);
  const pivot = destPivot
    ? destPointToSource(destPivot, window, dest)
    : { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 };
  const zoom = factor > 0 ? factor : 1;
  let width = visible.width / zoom;
  let height = visible.height / zoom;
  if (width / Math.max(1e-6, height) > destAspect) width = height * destAspect;
  else height = width / destAspect;
  const maxW = Math.min(bounds.width, bounds.height * destAspect);
  const maxH = maxW / destAspect;
  if (width > maxW) {
    width = maxW;
    height = maxH;
  }
  const nx = pivot.x - (pivot.x - visible.x) * (width / Math.max(1e-6, visible.width));
  const ny = pivot.y - (pivot.y - visible.y) * (height / Math.max(1e-6, visible.height));
  return clampWindowInside({ x: nx, y: ny, width, height }, bounds);
}

/** Commit one slot window. Box x/y/width/height are unchanged. */
export function applyFourCutSlotWindow(
  photo: WallScenePhoto,
  slotIndex: number,
  window: PhotoCropRect,
): WallScenePhoto {
  if (!photo.fourCut || slotIndex < 0 || slotIndex > 3) return photo;
  const fourCut = ensureFourCutBaseWindows(photo.fourCut);
  const bounds = fourCut.baseWindows![slotIndex];
  const windows = copyFourCutWindows(fourCut.windows);
  windows[slotIndex] = clampWindowInside(window, bounds);
  return { ...photo, fourCut: { ...fourCut, windows } };
}
