import type { WallTheme } from "@/types/wall";

const BRICK_PATTERN = `url("data:image/svg+xml,%3Csvg width='60' height='30' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='60' height='30' fill='%23a0522d'/%3E%3Crect x='1' y='1' width='28' height='13' fill='%23b85c38' rx='1'/%3E%3Crect x='31' y='1' width='28' height='13' fill='%23c4613a' rx='1'/%3E%3Crect x='16' y='16' width='28' height='13' fill='%23b85c38' rx='1'/%3E%3Crect x='1' y='16' width='13' height='13' fill='%23a34e2f' rx='1'/%3E%3Crect x='46' y='16' width='13' height='13' fill='%23c4613a' rx='1'/%3E%3C/svg%3E")`;

const WOOD_PATTERN = `url("data:image/svg+xml,%3Csvg width='80' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='80' height='40' fill='%23c4a574'/%3E%3Cpath d='M0 10 Q20 8 40 10 T80 10' stroke='%23b8956a' stroke-width='0.5' fill='none'/%3E%3Cpath d='M0 20 Q20 22 40 20 T80 20' stroke='%23a67c52' stroke-width='0.5' fill='none'/%3E%3Cpath d='M0 30 Q20 28 40 30 T80 30' stroke='%23b8956a' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`;

export const WALL_THEMES: WallTheme[] = [
  {
    id: "white",
    name: "화이트 월",
    description: "깔끔한 크림 화이트 벽",
    background:
      "radial-gradient(circle at 50% 0%, #ffffff 0%, transparent 60%), linear-gradient(180deg, #fefefe 0%, #f5f3ef 100%)",
    preview: "#f5f3ef",
  },
  {
    id: "brick-red",
    name: "적벽돌",
    description: "골목 카페 감성 빈티지 벽돌",
    background: `${BRICK_PATTERN} repeat, linear-gradient(160deg, #9a4a2a 0%, #7a3a20 100%)`,
    preview: "#b85c38",
  },
  {
    id: "corkboard",
    name: "코르크보드",
    description: "빈티지 감성 코르크 벽",
    background:
      "radial-gradient(circle at 20% 30%, #c4a574 0%, transparent 50%), radial-gradient(circle at 80% 70%, #b8956a 0%, transparent 40%), linear-gradient(135deg, #d4b896 0%, #a67c52 50%, #8b6914 100%)",
    preview: "#c4a574",
  },
  {
    id: "wood-panel",
    name: "우드 패널",
    description: "따뜻한 원룸 우드 벽",
    background: `${WOOD_PATTERN} repeat, linear-gradient(180deg, #d4b896 0%, #a67c52 100%)`,
    preview: "#c4a574",
  },
  {
    id: "plaster-worn",
    name: "낡은 벽",
    description: "크랙 있는 빈티지 석고벽",
    background:
      "radial-gradient(circle at 30% 40%, #e8e4dc 0%, transparent 50%), radial-gradient(circle at 70% 60%, #d8d4cc 0%, transparent 40%), linear-gradient(145deg, #f0ece4 0%, #d0ccc4 40%, #c8c4bc 100%)",
    preview: "#e8e4dc",
  },
  {
    id: "booth-curtain",
    name: "포토부스",
    description: "인생네컷 커튼 배경",
    background:
      "repeating-linear-gradient(90deg, #f8a4c8 0px, #f8a4c8 40px, #f090b8 40px, #f090b8 80px), linear-gradient(180deg, #fce4ec 0%, #f48fb1 100%)",
    preview: "#f8a4c8",
  },
  {
    id: "pastel",
    name: "하이틴 파스텔",
    description: "파스텔 핑크·라벤더 벽",
    background:
      "radial-gradient(circle at 25% 25%, #ffd6e8 0%, transparent 45%), radial-gradient(circle at 75% 75%, #e8d6ff 0%, transparent 40%), linear-gradient(135deg, #ffe4ec 0%, #f5d0e8 40%, #e8d4f8 100%)",
    preview: "#ffd6e8",
  },
  {
    id: "concrete",
    name: "콘크리트",
    description: "차분한 그레이 톤 벽",
    background:
      "radial-gradient(circle at 15% 85%, #9a9a9a 0%, transparent 35%), radial-gradient(circle at 85% 15%, #7a7a7a 0%, transparent 30%), linear-gradient(160deg, #b8b8b8 0%, #8e8e8e 45%, #6b6b6b 100%)",
    preview: "#9a9a9a",
  },
];

export function getWallTheme(id: string): WallTheme {
  return WALL_THEMES.find((t) => t.id === id) ?? WALL_THEMES[0];
}

export function isWallThemeId(id: string): id is WallTheme["id"] {
  return WALL_THEMES.some((t) => t.id === id);
}
