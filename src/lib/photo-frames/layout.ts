import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoDecoOuterSize } from "@/lib/photo-decos/layout";
import { getPhotoFrame } from "./catalog";

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

export function unionPhotoOuter(a: PhotoOuterBox, b: PhotoOuterBox): PhotoOuterBox {
  const minX = Math.min(a.offsetX, b.offsetX);
  const minY = Math.min(a.offsetY, b.offsetY);
  const maxX = Math.max(a.offsetX + a.width, b.offsetX + b.width);
  const maxY = Math.max(a.offsetY + a.height, b.offsetY + b.height);
  return { offsetX: minX, offsetY: minY, width: maxX - minX, height: maxY - minY };
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

/** Frame inset ∪ deco hang — hitbox / transformer / culling. */
export function getPhotoVisualOuterSize(photo: WallScenePhoto): PhotoOuterBox {
  return unionPhotoOuter(getPhotoFrameOuterSize(photo), getPhotoDecoOuterSize(photo));
}

export function getPhotoTransformerBox(
  photo: WallScenePhoto,
  scaleX: number,
  scaleY: number,
): { ox: number; oy: number; boxW: number; boxH: number } {
  const outer = getPhotoVisualOuterSize(photo);
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

/** Eight dest/source rects for a PNG frame around the photo (center hole skipped). */
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
      if (ri === 1 && ci === 1) continue;
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
