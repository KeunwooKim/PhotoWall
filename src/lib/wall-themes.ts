import type { WallTheme, WallThemeId } from "@/types/wall";
import { WALL_HOME_TILE_HEIGHT, WALL_HOME_TILE_WIDTH } from "@/lib/wall-bounds";

export const DEFAULT_WALL_THEME_ID: WallThemeId = "magic-partition";

/** One wallpaper tile = home cell size — expanding reveals more tiles. */
export const WALL_TILE_SIZE = `${WALL_HOME_TILE_WIDTH}px ${WALL_HOME_TILE_HEIGHT}px`;

/** DB·localStorage에 남아 있는 구 벽지 ID → 현재 벽지 */
const LEGACY_THEME_IDS: Record<string, WallThemeId> = {
  white: "linen-cream",
  "wood-panel": "linen-cream",
  "plaster-worn": "linen-cream",
  "booth-curtain": "linen-cream",
  pastel: "linen-cream",
  concrete: "linen-cream",
  "studio-pink": "linen-cream",
  "sage-room": "linen-cream",
  "starry-dream": "linen-cream",
  "cafe-chalkboard": "linen-cream",
  "brick-red": "red-brick",
  "cafe-brick": "red-brick",
  corkboard: "cork-board",
  "cafe-cork": "cork-board",
  "magic-partition-hole": "magic-partition",
};

function imageWallTheme(
  id: WallThemeId,
  name: string,
  description: string,
  file: string,
): WallTheme {
  const url = `url('/wallpapers/${file}')`;
  return {
    id,
    name,
    description,
    background: url,
    preview: `${url} 0 0 / ${WALL_TILE_SIZE} repeat`,
    backgroundSize: WALL_TILE_SIZE,
    backgroundPosition: "0 0",
    backgroundRepeat: "repeat",
  };
}

export const WALL_THEMES: WallTheme[] = [
  imageWallTheme("magic-partition", "매직파티션", "매직파티션 보드 벽", "magic-partition.webp"),
  imageWallTheme("linen-cream", "린넨 크림", "부드러운 린넨 질감 — 사진이 잘 돋보여요", "linen-cream.webp"),
  imageWallTheme("white-brick", "하얀 벽돌", "깔끔한 화이트 벽돌 벽", "white-brick.webp"),
  imageWallTheme("red-brick", "적 벽돌", "빈티지 적벽돌 인테리어", "red-brick.webp"),
  imageWallTheme("cork-board", "코르크보드", "핀보드 감성 코르크 벽", "cork-board.webp"),
];

export function isWallThemeId(id: string): id is WallThemeId {
  return WALL_THEMES.some((t) => t.id === id);
}

export function resolveWallThemeId(id: string): WallThemeId {
  if (isWallThemeId(id)) return id;
  return LEGACY_THEME_IDS[id] ?? DEFAULT_WALL_THEME_ID;
}

export function getWallTheme(id: string): WallTheme {
  return WALL_THEMES.find((t) => t.id === resolveWallThemeId(id)) ?? WALL_THEMES[0];
}
