import type { PhotoCropRect, WallScenePhoto } from "@/types/wall-scene-v2";
import type { FourCutHoleFractions, FourCutLayout } from "./types";

const STACK_SIDE = 0.07;
const STACK_HEADER = 0.11;
const STACK_FOOTER = 0.09;
const STACK_GAP = 0.018;

const GRID_SIDE = 0.07;
const GRID_HEADER = 0.1;
const GRID_FOOTER = 0.09;
const GRID_GAP_X = 0.03;
const GRID_GAP_Y = 0.025;

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

export function fourCutHolesInPhoto(photo: WallScenePhoto): PhotoCropRect[] | null {
  const fourCut = photo.fourCut;
  if (!fourCut?.skinId) return null;
  return fourCutHoleFractions(fourCut.layout).map((hole) => ({
    x: hole.x * photo.width,
    y: hole.y * photo.height,
    width: hole.width * photo.width,
    height: hole.height * photo.height,
  }));
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
