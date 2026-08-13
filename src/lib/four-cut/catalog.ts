import { patternSwatchCss, type PhotoFrameDefinition } from "@/lib/photo-frames";
import type { FourCutLayout } from "@/types/wall-scene-v2";
import type { FourCutSkinDefinition } from "./types";

/** Width / height of the on-wall box after a skin is applied. */
export const STACK4_ASPECT = 0.38;
export const GRID2X2_ASPECT = 0.88;

type ThemePalette = Pick<
  FourCutSkinDefinition,
  "kind" | "fill" | "headerFill" | "footerFill" | "ink" | "pattern" | "patternColor"
>;

const THEMES: Record<string, { name: string; palette: ThemePalette }> = {
  white: {
    name: "부스",
    palette: {
      kind: "booth",
      fill: "#f7f4ee",
      headerFill: "#efe8dc",
      footerFill: "#ebe4d6",
      ink: "#5c5348",
    },
  },
  black: {
    name: "필름",
    palette: {
      kind: "film",
      fill: "#1a1a1a",
      headerFill: "#141414",
      footerFill: "#f3efe6",
      ink: "#d8d2c6",
    },
  },
  cream: {
    name: "빈티지",
    palette: {
      kind: "paper",
      fill: "#f3e6c8",
      headerFill: "#ead9b0",
      footerFill: "#e6d4a8",
      ink: "#6b542e",
    },
  },
  pink: {
    name: "체크",
    palette: {
      kind: "gingham",
      fill: "#fff5f7",
      headerFill: "#f4c6d4",
      footerFill: "#f4c6d4",
      ink: "#9a4458",
      pattern: "gingham",
      patternColor: "#e58aa4",
    },
  },
  sky: {
    name: "도트",
    palette: {
      kind: "dots",
      fill: "#eef7fc",
      headerFill: "#c8def0",
      footerFill: "#c8def0",
      ink: "#3d6a88",
      pattern: "dots",
      patternColor: "#6eb3d9",
    },
  },
};

const THEME_KEYS = ["white", "black", "cream", "pink", "sky"] as const;

function stackSkin(key: (typeof THEME_KEYS)[number]): FourCutSkinDefinition {
  const theme = THEMES[key];
  return {
    id: `fourcut.stack.${key}`,
    name: theme.name,
    layout: "stack4",
    aspect: STACK4_ASPECT,
    listed: true,
    ...theme.palette,
  };
}

function gridSkin(key: (typeof THEME_KEYS)[number]): FourCutSkinDefinition {
  const theme = THEMES[key];
  return {
    id: `fourcut.grid.${key}`,
    name: theme.name,
    layout: "grid2x2",
    aspect: GRID2X2_ASPECT,
    listed: true,
    ...theme.palette,
  };
}

export const FOUR_CUT_SKINS: FourCutSkinDefinition[] = [
  ...THEME_KEYS.map(stackSkin),
  ...THEME_KEYS.map(gridSkin),
];

const byId = new Map(FOUR_CUT_SKINS.map((skin) => [skin.id, skin]));

export function getFourCutSkin(id: string | undefined | null): FourCutSkinDefinition | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function getListedFourCutSkins(layout?: FourCutLayout): FourCutSkinDefinition[] {
  return FOUR_CUT_SKINS.filter(
    (skin) => skin.listed !== false && (layout == null || skin.layout === layout),
  );
}

export function fourCutThemeSwatchCss(theme: FourCutSkinDefinition): string {
  if (!theme.pattern) return theme.fill;
  const frame: PhotoFrameDefinition = {
    id: theme.id,
    name: theme.name,
    kind: "pattern",
    inset: { top: 0, right: 0, bottom: 0, left: 0 },
    pattern: theme.pattern,
    patternColor: theme.patternColor,
    matteFill: theme.fill,
  };
  return patternSwatchCss(frame);
}
