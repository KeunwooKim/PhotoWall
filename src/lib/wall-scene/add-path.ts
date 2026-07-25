import {
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE_WIDTH,
  type LineEndpoints,
  endpointsToPoints,
} from "@/lib/wall-scene/highlighter";
import { getPenStyle, type PenStyleId } from "@/lib/wall-scene/pen";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePath } from "@/types/wall-scene-v2";

/** Straight masking-tape stroke (former highlighter). */
export function commitTapeStroke(
  endpoints: LineEndpoints,
  stroke: string,
  options?: {
    strokeWidth?: number;
    opacity?: number;
  },
): WallScenePath | null {
  const points = endpointsToPoints(endpoints);
  if (points.length !== 4) return null;

  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const path: WallScenePath = {
    id: crypto.randomUUID(),
    type: "path",
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    opacity: options?.opacity ?? HIGHLIGHTER_OPACITY,
    points,
    stroke,
    strokeWidth: options?.strokeWidth ?? HIGHLIGHTER_STROKE_WIDTH,
    tool: "tape",
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(path);
  useWallSceneStore.getState().bumpRevision();
  return path;
}

/** @deprecated Use commitTapeStroke */
export const commitHighlighterLine = commitTapeStroke;

export const PEN_MIN_POINTS = 4;

/** Freehand pen stroke with a named style (볼펜 / 만년필 / 마카 / 붓펜). */
export function commitPenStroke(
  points: number[],
  stroke: string,
  penStyleId: PenStyleId = "ink",
  strokeWidth?: number,
): WallScenePath | null {
  if (points.length < PEN_MIN_POINTS) return null;

  const style = getPenStyle(penStyleId);
  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const path: WallScenePath = {
    id: crypto.randomUUID(),
    type: "path",
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    opacity: style.opacity,
    points: [...points],
    stroke,
    strokeWidth: strokeWidth ?? style.strokeWidth,
    tool: "pen",
    penStyle: style.id,
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(path);
  useWallSceneStore.getState().bumpRevision();
  return path;
}

/** @deprecated Use commitPenStroke */
export function commitPathToWallScene(
  points: number[],
  stroke: string,
  _strokeWidth: number,
): WallScenePath | null {
  return commitPenStroke(points, stroke, "ink");
}
