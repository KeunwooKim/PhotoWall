import type { PhotoFramePatternId } from "@/lib/photo-frames";
import type { FourCutLayout } from "@/types/wall-scene-v2";

export type { FourCutLayout, WallSceneFourCut } from "@/types/wall-scene-v2";

export type FourCutThemeKind = "booth" | "film" | "paper" | "gingham" | "dots";

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
  kind: FourCutThemeKind;
  fill: string;
  headerFill: string;
  footerFill: string;
  ink: string;
  /** Template width / height used when resizing the photo box. */
  aspect: number;
  listed?: boolean;
  /** Optional PNG with transparent holes. */
  src?: string;
  pattern?: PhotoFramePatternId;
  patternColor?: string;
}

export type ApplyFourCutSkinResult =
  | "ok"
  | "not-photo"
  | "unknown-skin"
  | "no-source-size";

export type RgbaBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};
