import { DEFAULT_WALL_BOUNDS, clampWallBounds } from "@/lib/wall-bounds";
import { normalizeImageSrcForStorage } from "@/lib/storage/wall-photos";
import { unpackCanvasJson } from "@/lib/wall-canvas-json";
import {
  WALL_SCENE_VERSION,
  type WallSceneDocument,
  type WallSceneObject,
  type WallSceneEnvelope,
} from "@/types/wall-scene-v2";

type FabricObjectJson = {
  type?: string;
  left?: number;
  top?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  src?: string;
  text?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  path?: unknown;
  objects?: FabricObjectJson[];
  originX?: string;
  originY?: string;
};

function isSceneDocument(value: unknown): value is WallSceneDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as WallSceneDocument;
  return doc.meta?.version === WALL_SCENE_VERSION && Array.isArray(doc.objects);
}

export function isWallSceneEnvelope(json: object): boolean {
  const record = json as WallSceneEnvelope;
  if (record.photowallScene) return isSceneDocument(record.photowallScene);
  return false;
}

function fabricObjectToScene(obj: FabricObjectJson, zIndex: number): WallSceneObject | null {
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;
  const originX = obj.originX ?? (obj.type === "Image" ? "center" : "left");
  const originY = obj.originY ?? (obj.type === "Image" ? "center" : "top");

  let x = obj.left ?? 0;
  let y = obj.top ?? 0;

  const base = {
    id: crypto.randomUUID(),
    x,
    y,
    rotation: obj.angle ?? 0,
    scaleX,
    scaleY,
    zIndex,
    opacity: obj.opacity,
  };

  if (obj.type === "Image" && typeof obj.src === "string") {
    const width = (obj.width ?? 200) * scaleX;
    const height = (obj.height ?? 200) * scaleY;

    if (originX === "center") x -= width / 2;
    else if (originX === "right") x -= width;

    if (originY === "center") y -= height / 2;
    else if (originY === "bottom") y -= height;

    return {
      ...base,
      x,
      y,
      scaleX: 1,
      scaleY: 1,
      type: "photo",
      src: normalizeImageSrcForStorage(obj.src),
      width,
      height,
    };
  }

  if ((obj.type === "Text" || obj.type === "IText" || obj.type === "FabricText") && obj.text) {
    return {
      ...base,
      type: "emoji",
      text: obj.text,
      fontSize: obj.fontSize ?? 48,
    };
  }

  if (obj.type === "Rect" && obj.fill) {
    return {
      ...base,
      type: "tape",
      width: obj.width ?? 140,
      height: obj.height ?? 28,
      fill: String(obj.fill),
    };
  }

  if (obj.type === "Path") {
    const points = flattenFabricPath(obj.path);
    if (points.length < 4) return null;
    return {
      ...base,
      type: "path",
      points,
      stroke: obj.stroke ?? "#1a1a1a",
      strokeWidth: obj.strokeWidth ?? 4,
    };
  }

  if (obj.type === "Group" && Array.isArray(obj.objects)) {
    return null;
  }

  return null;
}

/** Best-effort Fabric SVG path → flat points for Konva Line */
function flattenFabricPath(path: unknown): number[] {
  if (!Array.isArray(path)) return [];
  const points: number[] = [];
  let cursorX = 0;
  let cursorY = 0;

  for (let i = 0; i < path.length; ) {
    const cmd = path[i];
    if (cmd === "M" || cmd === "L") {
      cursorX = Number(path[i + 1] ?? 0);
      cursorY = Number(path[i + 2] ?? 0);
      points.push(cursorX, cursorY);
      i += 3;
      continue;
    }
    if (cmd === "Q") {
      cursorX = Number(path[i + 3] ?? cursorX);
      cursorY = Number(path[i + 4] ?? cursorY);
      points.push(cursorX, cursorY);
      i += 5;
      continue;
    }
    i += 1;
  }

  return points;
}

function importFabricJson(fabricJson: object, wallBounds = DEFAULT_WALL_BOUNDS): WallSceneDocument {
  const record = fabricJson as { objects?: FabricObjectJson[] };
  const objects: WallSceneObject[] = [];

  for (const [index, obj] of (record.objects ?? []).entries()) {
    const mapped = fabricObjectToScene(obj, index);
    if (mapped) objects.push(mapped);
  }

  return {
    meta: {
      version: WALL_SCENE_VERSION,
      wallBounds: clampWallBounds(wallBounds),
      revision: 0,
    },
    objects,
  };
}

/** Load v2 scene or migrate legacy Fabric canvas_json */
export function parseWallScene(json: object): WallSceneDocument {
  const envelope = json as WallSceneEnvelope;

  if (envelope.photowallScene && isSceneDocument(envelope.photowallScene)) {
    return envelope.photowallScene;
  }

  const { fabricJson, wallBounds } = unpackCanvasJson(json);
  return importFabricJson(fabricJson, wallBounds);
}

export function serializeWallScene(doc: WallSceneDocument): WallSceneEnvelope {
  return {
    photowallScene: {
      ...doc,
      meta: {
        ...doc.meta,
        wallBounds: clampWallBounds(doc.meta.wallBounds),
      },
    },
  };
}
