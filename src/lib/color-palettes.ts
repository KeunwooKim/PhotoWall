/** App chrome color palettes — mono + pastel sets with light + dark tokens. */
export type ColorPaletteId = "mono" | "blush" | "mist" | "sage" | "lilac" | "butter";

export interface ColorPaletteMeta {
  id: ColorPaletteId;
  label: string;
  description: string;
  /** Swatch colors shown in settings (light accents) */
  swatches: [string, string, string];
}

export const COLOR_PALETTES: ColorPaletteMeta[] = [
  {
    id: "mono",
    label: "모노",
    description: "블랙 · 화이트",
    swatches: ["#ffffff", "#f5f5f5", "#0a0a0a"],
  },
  {
    id: "blush",
    label: "블러시",
    description: "피치 핑크",
    swatches: ["#FFF5F3", "#F5C6C0", "#C97B7B"],
  },
  {
    id: "mist",
    label: "미스트",
    description: "소프트 스카이",
    swatches: ["#F3F7FC", "#B7C9E2", "#6B8BB8"],
  },
  {
    id: "sage",
    label: "세이지",
    description: "말차 그린",
    swatches: ["#F4F7F2", "#B9CDB8", "#6F8F72"],
  },
  {
    id: "lilac",
    label: "라일락",
    description: "연보라",
    swatches: ["#F7F4FB", "#C9B8DE", "#8B74B0"],
  },
  {
    id: "butter",
    label: "버터",
    description: "크림 옐로",
    swatches: ["#FFFBF0", "#E8D5A3", "#A88B4A"],
  },
];

export const DEFAULT_COLOR_PALETTE: ColorPaletteId = "mono";

export function isColorPaletteId(value: unknown): value is ColorPaletteId {
  return (
    value === "mono" ||
    value === "blush" ||
    value === "mist" ||
    value === "sage" ||
    value === "lilac" ||
    value === "butter"
  );
}
