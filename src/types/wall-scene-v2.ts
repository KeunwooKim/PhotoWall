import type { WallBounds } from "@/lib/wall-bounds";

/** Normalized wall scene (v2) — replaces Fabric canvas_json blob */
export const WALL_SCENE_VERSION = 2 as const;

export type WallSceneObjectType = "photo" | "emoji" | "svg" | "tape" | "path" | "sticker";

export interface WallSceneMeta {
  version: typeof WALL_SCENE_VERSION;
  wallBounds: WallBounds;
  /** Monotonic revision for DB persist / conflict detection */
  revision: number;
}

export interface WallSceneObjectBase {
  id: string;
  type: WallSceneObjectType;
  /** Top-left anchor in wall coordinates (Konva default) */
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
  opacity?: number;
}

export interface WallScenePhoto extends WallSceneObjectBase {
  type: "photo";
  /** wall-photo://path, https signed URL, or data: URL */
  src: string;
  width: number;
  height: number;
}

export interface WallSceneEmoji extends WallSceneObjectBase {
  type: "emoji";
  text: string;
  fontSize: number;
}

export interface WallSceneSvg extends WallSceneObjectBase {
  type: "svg";
  svg: string;
  width: number;
  height: number;
}

export interface WallSceneSticker extends WallSceneObjectBase {
  type: "sticker";
  stickerId: string;
  width: number;
  height: number;
}

export interface WallSceneTape extends WallSceneObjectBase {
  type: "tape";
  width: number;
  height: number;
  fill: string;
}

export interface WallScenePath extends WallSceneObjectBase {
  type: "path";
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export type WallSceneObject =
  | WallScenePhoto
  | WallSceneEmoji
  | WallSceneSvg
  | WallSceneSticker
  | WallSceneTape
  | WallScenePath;

export interface WallSceneDocument {
  meta: WallSceneMeta;
  objects: WallSceneObject[];
}

/** Persisted in Supabase walls.canvas_json during migration window */
export interface WallSceneEnvelope {
  photowallScene?: WallSceneDocument;
  /** Legacy Fabric payload — read-only fallback */
  photowall?: { version: 1; wallBounds: WallBounds };
  objects?: unknown[];
  [key: string]: unknown;
}

/** Realtime cursor / selection (ephemeral — not in DB) */
export interface WallPresenceState {
  userId: string;
  displayName: string;
  color: string;
  cursorX: number;
  cursorY: number;
  selectedObjectId?: string;
  /** True while dragging/resizing — peers hide cursor, show object border only */
  isManipulating?: boolean;
  updatedAt: number;
  /** Unique per browser tab — avoids Supabase presence key collisions */
  sessionId?: string;
}
