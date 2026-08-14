import { patternSwatchCss, type PhotoFrameDefinition } from "@/lib/photo-frames";
import type { FourCutLayout } from "@/types/wall-scene-v2";
import type { FourCutSkinDefinition } from "./types";

/** Width / height. 인생네컷 기본 프레임 51×152mm (2×6). */
export const STACK4_ASPECT = 2 / 6;
/** Width / height. 인생네컷 멀티 프레임 102×152mm (4×6). */
export const GRID2X2_ASPECT = 4 / 6;

type ThemePalette = Pick<
  FourCutSkinDefinition,
  "kind" | "fill" | "headerFill" | "footerFill" | "ink" | "pattern" | "patternColor"
>;

const THEMES: Record<string, { name: string; palette: ThemePalette }> = {
  white: {
    name: "흰색",
    palette: {
      kind: "booth",
      fill: "#ffffff",
      headerFill: "#ffffff",
      footerFill: "#ffffff",
      ink: "#d4d4d4",
    },
  },
  black: {
    name: "검정",
    palette: {
      kind: "booth",
      fill: "#111111",
      headerFill: "#111111",
      footerFill: "#111111",
      ink: "#2a2a2a",
    },
  },
};

const THEME_KEYS = ["white", "black"] as const;

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
  return FOUR_CUT_SKINS.filter((skin) => {
    if (skin.listed === false) return false;
    if (layout == null) return true;
    return skin.layout === layout;
  });
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
