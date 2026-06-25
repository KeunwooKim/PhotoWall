import type { WallTheme, WallThemeId } from "@/types/wall";

export const DEFAULT_WALL_THEME_ID: WallThemeId = "linen-cream";

/** DB·localStorage에 남아 있는 구 CSS 벽지 ID → 이미지 벽지 */
const LEGACY_THEME_IDS: Record<string, WallThemeId> = {
  white: "linen-cream",
  "brick-red": "cafe-brick",
  corkboard: "cafe-cork",
  "wood-panel": "linen-cream",
  "plaster-worn": "linen-cream",
  "booth-curtain": "studio-pink",
  pastel: "studio-pink",
  concrete: "sage-room",
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
    preview: `${url} center / cover no-repeat`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export const WALL_THEMES: WallTheme[] = [
  imageWallTheme("linen-cream", "린넨 크림", "부드러운 린넨 질감 — 사진이 잘 돋보여요", "linen-cream.png"),
  imageWallTheme("studio-pink", "스튜디오 핑크", "인생네컷 부스 커튼 감성", "studio-pink.png"),
  imageWallTheme("sage-room", "세이지 룸", "요즘 감성 세이지 그린 벽", "sage-room.png"),
  imageWallTheme("starry-dream", "별밤 드림", "은은한 별이 반짝이는 밤하늘", "starry-dream.png"),
  imageWallTheme("cafe-chalkboard", "카페 칠판", "골목 카페 메뉴판 느낌 칠판", "cafe-chalkboard.png"),
  imageWallTheme("cafe-cork", "카페 코르크", "핀보드 감성 코르크 벽", "cafe-cork.png"),
  imageWallTheme("cafe-brick", "카페 벽돌", "빈티지 적벽돌 카페 인테리어", "cafe-brick.png"),
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
