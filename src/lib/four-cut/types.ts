import type { FourCutLayout } from "@/types/wall-scene-v2";

export type { FourCutLayout, WallSceneFourCut } from "@/types/wall-scene-v2";

export interface FourCutHoleFractions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FourCutSkinDefinition {
  id: string;
  name: string;
  layout: FourCutLayout;
  fill: string;
  /** Template width / height used when resizing the photo box. */
  aspect: number;
  listed?: boolean;
  /** Optional PNG with transparent holes. */
  src?: string;
}

export type ApplyFourCutSkinResult =
  | "ok"
  | "not-photo"
  | "not-four-cut"
  | "unknown-skin"
  | "layout-mismatch";

export type RgbaBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};
