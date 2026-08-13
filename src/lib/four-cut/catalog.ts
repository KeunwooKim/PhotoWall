import type { FourCutLayout } from "@/types/wall-scene-v2";
import type { FourCutSkinDefinition } from "./types";

/** Width / height of the on-wall box after a skin is applied. */
export const STACK4_ASPECT = 0.38;
export const GRID2X2_ASPECT = 0.88;

function stackSkin(id: string, name: string, fill: string): FourCutSkinDefinition {
  return {
    id,
    name,
    layout: "stack4",
    fill,
    aspect: STACK4_ASPECT,
    listed: true,
  };
}

function gridSkin(id: string, name: string, fill: string): FourCutSkinDefinition {
  return {
    id,
    name,
    layout: "grid2x2",
    fill,
    aspect: GRID2X2_ASPECT,
    listed: true,
  };
}

export const FOUR_CUT_SKINS: FourCutSkinDefinition[] = [
  stackSkin("fourcut.stack.white", "흰 스트립", "#f7f4ee"),
  stackSkin("fourcut.stack.black", "검정 스트립", "#1a1a1a"),
  stackSkin("fourcut.stack.cream", "크림 스트립", "#f3e6c8"),
  stackSkin("fourcut.stack.pink", "핑크 스트립", "#f4c6d4"),
  stackSkin("fourcut.stack.sky", "하늘 스트립", "#c8def0"),
  gridSkin("fourcut.grid.white", "흰 2×2", "#f7f4ee"),
  gridSkin("fourcut.grid.black", "검정 2×2", "#1a1a1a"),
  gridSkin("fourcut.grid.cream", "크림 2×2", "#f3e6c8"),
  gridSkin("fourcut.grid.pink", "핑크 2×2", "#f4c6d4"),
  gridSkin("fourcut.grid.sky", "하늘 2×2", "#c8def0"),
];

const byId = new Map(FOUR_CUT_SKINS.map((skin) => [skin.id, skin]));

export function getFourCutSkin(id: string | undefined | null): FourCutSkinDefinition | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function getListedFourCutSkins(layout: FourCutLayout): FourCutSkinDefinition[] {
  return FOUR_CUT_SKINS.filter((skin) => skin.listed !== false && skin.layout === layout);
}
