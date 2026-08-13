import type { PhotoFrameDefinition } from "./types";

/**
 * PNG frame asset spec (drop files in public/frames/ then set listed: true):
 * - Short edge ~1024px, transparent hole in the center (the photo shows through).
 * - Do NOT run process-photowall-stickers.mjs (it shrinks to 120px).
 * - slice9 numbers are source-pixel margins that stay unstretched (corners).
 * - White/light backgrounds will show as a matte; use real transparency.
 */
export const PHOTO_FRAMES: PhotoFrameDefinition[] = [
  {
    id: "frame.polaroid",
    name: "폴라로이드",
    kind: "matte",
    inset: { top: 0.06, right: 0.06, bottom: 0.22, left: 0.06 },
    matteFill: "#f7f4ee",
    listed: true,
  },
  {
    id: "frame.white",
    name: "흰 여백",
    kind: "matte",
    inset: { top: 0.07, right: 0.07, bottom: 0.07, left: 0.07 },
    matteFill: "#ffffff",
    listed: true,
  },
  {
    id: "frame.black",
    name: "검정",
    kind: "matte",
    inset: { top: 0.055, right: 0.055, bottom: 0.055, left: 0.055 },
    matteFill: "#1a1a1a",
    listed: true,
  },
  {
    id: "frame.film",
    name: "필름",
    kind: "matte",
    inset: { top: 0.04, right: 0.14, bottom: 0.04, left: 0.14 },
    matteFill: "#111111",
    listed: true,
  },
  {
    id: "frame.slice9.wood",
    name: "나무 테두리",
    kind: "slice9",
    inset: { top: 0.08, right: 0.08, bottom: 0.08, left: 0.08 },
    matteFill: "#8b6914",
    src: "/frames/wood.png",
    slice9: { top: 96, right: 96, bottom: 96, left: 96 },
    listed: false,
  },
];

const byId = new Map(PHOTO_FRAMES.map((frame) => [frame.id, frame]));

export function getPhotoFrame(id: string | undefined | null): PhotoFrameDefinition | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function getListedPhotoFrames(): PhotoFrameDefinition[] {
  return PHOTO_FRAMES.filter((frame) => frame.listed !== false);
}
