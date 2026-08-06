export type WallThemeId =
  | "linen-cream"
  | "studio-pink"
  | "sage-room"
  | "starry-dream"
  | "cafe-chalkboard"
  | "cafe-cork"
  | "cafe-brick";

export type WallObjectType = "photo" | "sticker" | "tape" | "drawing";

export interface WallObjectMeta {
  id: string;
  type: WallObjectType;
  imageUrl?: string;
  x: number;
  y: number;
  angle: number;
  scale: number;
  zIndex: number;
  createdAt: string;
}

export interface WallData {
  id: string;
  themeId: WallThemeId;
  canvasJson: object;
  updatedAt: string;
}

export interface WallTheme {
  id: WallThemeId;
  name: string;
  description: string;
  background: string;
  preview: string;
  /** CSS background-size — 기본 벽 크기 타일로 반복해 확장·축소가 보이게 */
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
}

export interface PublishedWall {
  id: string;
  themeId: WallThemeId;
  canvasJson: object;
  updatedAt: string;
  /** Storage path in wall-photos for fast read-only preview */
  previewPath?: string | null;
}
