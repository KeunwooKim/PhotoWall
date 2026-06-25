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
  /** CSS background-size — image 벽지는 cover 권장 */
  backgroundSize?: string;
  backgroundPosition?: string;
}

export interface PublishedWall {
  id: string;
  themeId: WallThemeId;
  canvasJson: object;
  updatedAt: string;
}
