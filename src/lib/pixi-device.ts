import { isIosLikeDevice, PIXI_WALL_MAX_HEIGHT, PIXI_WALL_MAX_WIDTH } from "@/lib/wall-device";

export { PIXI_WALL_MAX_HEIGHT, PIXI_WALL_MAX_WIDTH };

/** Longest display texture edge after LOD downscale (before GPU upload). */
export const IOS_MAX_TEXTURE_EDGE = 1536;
export const DESKTOP_MAX_TEXTURE_EDGE = 2048;

/** Pixi Application resolution (framebuffer DPR). */
export function pixiResolutionCap(): number {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  if (isIosLikeDevice()) return Math.min(1.25, dpr);
  return Math.min(1.5, dpr);
}

export function maxDisplayTextureEdge(): number {
  return isIosLikeDevice() ? IOS_MAX_TEXTURE_EDGE : DESKTOP_MAX_TEXTURE_EDGE;
}
