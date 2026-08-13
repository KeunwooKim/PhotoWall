export type PhotoFrameKind = "matte" | "pattern" | "overlay" | "slice9";

export type PhotoFramePatternId =
  | "gingham"
  | "dots"
  | "stripes"
  | "cow"
  | "leopard"
  | "zebra"
  | "tiger"
  | "speckle"
  | "rainbow";

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
  /** Solid fill behind the photo (matte, or pattern/overlay fallback). */
  matteFill?: string;
  /** Code-drawn tile for polaroid pattern frames. */
  pattern?: PhotoFramePatternId;
  /** Secondary pattern color (checks, spots, stripes). */
  patternColor?: string;
  /** Optional PNG with a transparent hole. overlay/slice9, or a hand-drawn replacement. */
  src?: string;
  slice9?: PhotoFrameSlice9;
  /** Hide from the picker until an asset is dropped in public/frames/. */
  listed?: boolean;
}
