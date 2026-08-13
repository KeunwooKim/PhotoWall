import type { PhotoFrameDefinition, PhotoFrameInsetFractions } from "./types";

/**
 * PNG frame asset spec (drop files in public/frames/ then set listed: true):
 * - Polaroid overlays: short edge ~1024px, transparent hole, thicker bottom.
 * - Do NOT run process-photowall-stickers.mjs (it shrinks to 120px).
 * - slice9 numbers are source-pixel margins that stay unstretched (corners).
 * - White/light backgrounds will show as a matte; use real transparency.
 */
const POLAROID: PhotoFrameInsetFractions = {
  top: 0.055,
  right: 0.055,
  bottom: 0.22,
  left: 0.055,
};

function polaroidPattern(
  id: string,
  name: string,
  pattern: NonNullable<PhotoFrameDefinition["pattern"]>,
  matteFill: string,
  patternColor: string,
): PhotoFrameDefinition {
  return {
    id,
    name,
    kind: "pattern",
    inset: POLAROID,
    matteFill,
    pattern,
    patternColor,
    listed: true,
  };
}

export const PHOTO_FRAMES: PhotoFrameDefinition[] = [
  {
    id: "frame.polaroid",
    name: "폴라로이드",
    kind: "matte",
    inset: POLAROID,
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
  polaroidPattern("frame.gingham.orange", "체크 주황", "gingham", "#fff4e8", "#e8873a"),
  polaroidPattern("frame.gingham.sky", "체크 하늘", "gingham", "#eef7fc", "#6eb3d9"),
  polaroidPattern("frame.gingham.lilac", "체크 보라", "gingham", "#f4eef8", "#b089c9"),
  polaroidPattern("frame.gingham.red", "체크 빨강", "gingham", "#fff0f0", "#d45454"),
  polaroidPattern("frame.gingham.yellow", "체크 노랑", "gingham", "#fff8e4", "#e2b33a"),
  polaroidPattern("frame.cow", "카우", "cow", "#f7f7f5", "#1a1a1a"),
  polaroidPattern("frame.cow.blue", "카우 블루", "cow", "#e7f3fb", "#3d6f99"),
  polaroidPattern("frame.zebra", "지브라", "zebra", "#f6f6f4", "#171717"),
  polaroidPattern("frame.zebra.green", "지브라 그린", "zebra", "#f3fbe8", "#3d8a2a"),
  polaroidPattern("frame.leopard", "레오파드", "leopard", "#f6d9a8", "#5a3314"),
  polaroidPattern("frame.leopard.pink", "레오파드 핑크", "leopard", "#f8cdd8", "#7a2438"),
  polaroidPattern("frame.tiger", "타이거", "tiger", "#f0a24a", "#1c1208"),
  polaroidPattern("frame.speckle.pink", "스플래터 핑크", "speckle", "#fff5f7", "#e58aa4"),
  polaroidPattern("frame.speckle.blue", "스플래터 블루", "speckle", "#f3f8fd", "#7aa7d4"),
  polaroidPattern("frame.stripes.blue", "스트라이프", "stripes", "#f4fbff", "#3b82c4"),
  polaroidPattern("frame.dots", "도트", "dots", "#fffdf8", "#e35d7a"),
  polaroidPattern("frame.rainbow", "레인보우", "rainbow", "#fff7fb", "#f7a1b8"),
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
  {
    id: "frame.overlay.polaroid-custom",
    name: "커스텀 폴라로이드",
    kind: "overlay",
    inset: POLAROID,
    matteFill: "#f7f4ee",
    src: "/frames/polaroid-custom.png",
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
