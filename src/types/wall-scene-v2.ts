import type { WallBounds } from "@/lib/wall-bounds";

/** Normalized wall scene (v2) — replaces Fabric canvas_json blob */
export const WALL_SCENE_VERSION = 2 as const;

export type WallSceneObjectType =
  | "photo"
  | "emoji"
  | "svg"
  | "tape"
  | "path"
  | "sticker"
  | "text";

export interface WallSceneMeta {
  version: typeof WALL_SCENE_VERSION;
  /**
   * Wall AABB in world coordinates.
   * World origin (0,0) is the center of the default home frame.
   */
  wallBounds: WallBounds;
  /** Monotonic revision for DB persist / conflict detection */
  revision: number;
  /**
   * Wallpaper tile offset in wall coordinates (decorative).
   * No longer coupled to west/north expand content shifts.
   */
  wallpaperOffset?: { x: number; y: number };
  /**
   * @deprecated Center-origin walls use a fixed home frame at DEFAULT_WALL_BOUNDS (2×3).
   * Kept for migrate-on-load of legacy scenes.
   */
  homeOrigin?: { x: number; y: number };
  /**
   * When true, the wall must not grow (drag expand / sanitize reconcile).
   * Shared via realtime + persist so all collaborators share the same lock.
   */
  wallSizeLocked?: boolean;
  /**
   * When true, empty wall edges may reclaim after drag-end (not during drag).
   * Default off — expand-only until enabled in wall settings.
   */
  wallShrinkEnabled?: boolean;
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
  /** Logical group — members move/select together */
  groupId?: string;
}

export interface PhotoCropRect {
  /** Region in source image pixels */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Vertical 4-stack (인생네컷) or 2×2 booth print. */
export type FourCutLayout = "stack4" | "grid2x2";

export interface WallSceneFourCut {
  layout: FourCutLayout;
  /** Source-pixel windows. stack4: top→bottom. grid2x2: TL→TR→BL→BR. */
  windows: [PhotoCropRect, PhotoCropRect, PhotoCropRect, PhotoCropRect];
  /** Detected windows; slot crop clamps and 원본 restore against these. */
  baseWindows?: [PhotoCropRect, PhotoCropRect, PhotoCropRect, PhotoCropRect];
  /** Catalog skin. Absent/null keeps the original bitmap chrome. */
  skinId?: string | null;
  /** Photo size before theme chrome. 원본 restores size at the current center. */
  base?: { x: number; y: number; width: number; height: number };
}

export interface WallScenePhoto extends WallSceneObjectBase {
  type: "photo";
  /** wall-photo://path, https signed URL, or data: URL */
  src: string;
  width: number;
  height: number;
  /** Visible region of the source image (defaults to full image) */
  crop?: PhotoCropRect;
  /** Set when posted via guestbook API — used for admin scrub */
  source?: "guestbook";
  /** Catalog id from photo-frames (one per photo). */
  frameId?: string;
  /** Detected 네컷 strip — windows stay on the original src. */
  fourCut?: WallSceneFourCut;
}

export interface WallSceneEmoji extends WallSceneObjectBase {
  type: "emoji";
  text: string;
  fontSize: number;
}

export interface WallSceneText extends WallSceneObjectBase {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  /** Layout width for wrapping */
  width: number;
  fontWeight?: "normal" | "bold";
  textAlign?: "left" | "center" | "right";
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
  /** pen = freehand ink, tape = straight masking strip (legacy highlighter) */
  tool?: "pen" | "tape";
  /** Freehand pen variant — drives opacity / cap / tension when rendering */
  penStyle?: "fine" | "ink" | "marker" | "brush";
  /** Masking-tape end cap style */
  tapeEndStyle?: "round" | "square" | "pinking";
  /** Masking-tape fill pattern (solid = translucent color only) */
  tapePattern?: "solid" | "stripe" | "dot" | "grid" | "diagonal";
  /** Accent color for tapePattern overlays */
  tapePatternAccent?: string;
}

export type WallSceneObject =
  | WallScenePhoto
  | WallSceneEmoji
  | WallSceneText
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
  /** @deprecated Use selectedObjectIds — kept for older clients */
  selectedObjectId?: string;
  selectedObjectIds?: string[];
  /**
   * True while dragging/resizing.
   * Peers also hide the cursor chip whenever selectedObjectIds is non-empty.
   */
  isManipulating?: boolean;
  updatedAt: number;
  /** Unique per browser tab — avoids Supabase presence key collisions */
  sessionId?: string;
}
