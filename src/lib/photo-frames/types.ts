import type { PhotoDecoSlot } from "@/types/wall-scene-v2";

export type PhotoFrameKind = "matte" | "slice9";

export interface PhotoFrameInsetFractions {
  /** Fraction of min(photo.width, photo.height) */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 9-slice guides in source-image pixels. */
export interface PhotoFrameSlice9 {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PhotoFrameDefinition {
  id: string;
  name: string;
  kind: PhotoFrameKind;
  inset: PhotoFrameInsetFractions;
  /** Solid fill behind the photo (matte, or slice9 fallback). */
  matteFill?: string;
  /** PNG with a transparent hole. Used by slice9. */
  src?: string;
  slice9?: PhotoFrameSlice9;
  /** Hide from the picker until an asset is dropped in public/frames/. */
  listed?: boolean;
}

export const PHOTO_DECO_SLOTS: PhotoDecoSlot[] = ["tl", "tr", "br", "bl"];
