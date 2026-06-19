export type WallThemeId =
  | "corkboard"
  | "concrete"
  | "pastel"
  | "white"
  | "brick-red"
  | "plaster-worn"
  | "wood-panel"
  | "booth-curtain";

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
}

export interface PublishedWall {
  id: string;
  themeId: WallThemeId;
  canvasJson: object;
  updatedAt: string;
}
