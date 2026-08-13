import { getStickerById } from "@/lib/stickers";
import type { PhotoDecoration, PhotoDecoSlot, WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoFrame } from "./catalog";
import { PHOTO_DECO_SLOTS } from "./types";

export interface PhotoFrameInsetPx {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PhotoOuterBox {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface DecorationLocalBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMPTY_INSET: PhotoFrameInsetPx = { top: 0, right: 0, bottom: 0, left: 0 };

export function getPhotoFrameInset(photo: WallScenePhoto): PhotoFrameInsetPx {
  const frame = getPhotoFrame(photo.frameId);
  if (!frame) return EMPTY_INSET;
  const m = Math.min(photo.width, photo.height);
  return {
    top: frame.inset.top * m,
    right: frame.inset.right * m,
    bottom: frame.inset.bottom * m,
    left: frame.inset.left * m,
  };
}

export function getPhotoTransformerBox(
  photo: WallScenePhoto,
  scaleX: number,
  scaleY: number,
): { ox: number; oy: number; boxW: number; boxH: number } {
  const outer = getPhotoFrameOuterSize(photo);
  const absX = Math.abs(scaleX) || 1;
  const absY = Math.abs(scaleY) || 1;
  const boxW = Math.max(1, outer.width * absX);
  const boxH = Math.max(1, outer.height * absY);
  return {
    ox: scaleX < 0 ? -boxW : outer.offsetX * absX,
    oy: scaleY < 0 ? -boxH : outer.offsetY * absY,
    boxW,
    boxH,
  };
}

export function filmSprocketRects(
  photo: WallScenePhoto,
  inset: PhotoFrameInsetPx,
): Array<{ x: number; y: number; width: number; height: number }> {
  const holeW = Math.max(3, inset.left * 0.42);
  const holeH = holeW * 0.65;
  const gap = holeH * 0.75;
  const leftX = -inset.left + (inset.left - holeW) / 2;
  const rightX = photo.width + (inset.right - holeW) / 2;
  const startY = -inset.top + holeH * 0.5;
  const endY = photo.height + inset.bottom - holeH;
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let y = startY; y + holeH <= endY + 0.5; y += holeH + gap) {
    rects.push({ x: leftX, y, width: holeW, height: holeH });
    rects.push({ x: rightX, y, width: holeW, height: holeH });
  }
  return rects;
}

export function getPhotoFrameOuterSize(photo: WallScenePhoto): PhotoOuterBox {
  const inset = getPhotoFrameInset(photo);
  return {
    offsetX: -inset.left,
    offsetY: -inset.top,
    width: photo.width + inset.left + inset.right,
    height: photo.height + inset.top + inset.bottom,
  };
}

export function nextPhotoDecoSlot(
  decorations: PhotoDecoration[] | undefined,
  preferred?: PhotoDecoSlot,
): PhotoDecoSlot {
  if (preferred) return preferred;
  const used = new Set((decorations ?? []).map((item) => item.slot));
  return PHOTO_DECO_SLOTS.find((slot) => !used.has(slot)) ?? "tl";
}

export function flipPhotoDecoSlot(slot: PhotoDecoSlot, axis: "horizontal" | "vertical"): PhotoDecoSlot {
  if (axis === "horizontal") {
    if (slot === "tl") return "tr";
    if (slot === "tr") return "tl";
    if (slot === "bl") return "br";
    return "bl";
  }
  if (slot === "tl") return "bl";
  if (slot === "bl") return "tl";
  if (slot === "tr") return "br";
  return "tr";
}

export function flipPhotoDecorations(
  decorations: PhotoDecoration[] | undefined,
  axis: "horizontal" | "vertical",
): PhotoDecoration[] | undefined {
  if (!decorations?.length) return decorations;
  return decorations.map((item) => ({
    ...item,
    slot: flipPhotoDecoSlot(item.slot, axis),
  }));
}

/** Corner sticker box in photo-local px (origin = photo top-left). */
export function getDecorationLocalBox(
  photo: WallScenePhoto,
  deco: PhotoDecoration,
): DecorationLocalBox | null {
  const def = getStickerById(deco.stickerId);
  const baseW = def?.defaultWidth ?? def?.defaultSize ?? 64;
  const baseH = def?.defaultHeight ?? def?.defaultSize ?? 64;
  const scale = deco.scale ?? 1;
  const width = Math.max(8, baseW * scale);
  const height = Math.max(8, baseH * scale);
  const hang = 0.4;
  let x = 0;
  let y = 0;
  switch (deco.slot) {
    case "tl":
      x = -width * hang;
      y = -height * hang;
      break;
    case "tr":
      x = photo.width - width * (1 - hang);
      y = -height * hang;
      break;
    case "bl":
      x = -width * hang;
      y = photo.height - height * (1 - hang);
      break;
    case "br":
      x = photo.width - width * (1 - hang);
      y = photo.height - height * (1 - hang);
      break;
  }
  return {
    x: x + (deco.dx ?? 0),
    y: y + (deco.dy ?? 0),
    width,
    height,
  };
}

export interface Slice9Rect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** Nine dest/source rects for a PNG frame around the photo. */
export function computeSlice9Rects(
  srcW: number,
  srcH: number,
  dest: PhotoOuterBox,
  slice: { top: number; right: number; bottom: number; left: number },
): Slice9Rect[] {
  const left = Math.max(1, Math.min(slice.left, srcW / 2));
  const right = Math.max(1, Math.min(slice.right, srcW / 2));
  const top = Math.max(1, Math.min(slice.top, srcH / 2));
  const bottom = Math.max(1, Math.min(slice.bottom, srcH / 2));
  const srcMidW = Math.max(1, srcW - left - right);
  const srcMidH = Math.max(1, srcH - top - bottom);
  const destMidW = Math.max(1, dest.width - left - right);
  const destMidH = Math.max(1, dest.height - top - bottom);
  const x = dest.offsetX;
  const y = dest.offsetY;
  const cols = [
    { sx: 0, sw: left, dx: x, dw: left },
    { sx: left, sw: srcMidW, dx: x + left, dw: destMidW },
    { sx: srcW - right, sw: right, dx: x + left + destMidW, dw: right },
  ];
  const rows = [
    { sy: 0, sh: top, dy: y, dh: top },
    { sy: top, sh: srcMidH, dy: y + top, dh: destMidH },
    { sy: srcH - bottom, sh: bottom, dy: y + top + destMidH, dh: bottom },
  ];
  const rects: Slice9Rect[] = [];
  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < cols.length; ci++) {
      if (ri === 1 && ci === 1) continue; // transparent hole — photo shows through
      const row = rows[ri];
      const col = cols[ci];
      rects.push({
        sx: col.sx,
        sy: row.sy,
        sw: col.sw,
        sh: row.sh,
        dx: col.dx,
        dy: row.dy,
        dw: col.dw,
        dh: row.dh,
      });
    }
  }
  return rects;
}
