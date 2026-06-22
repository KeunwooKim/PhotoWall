import {
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE_WIDTH,
  type LineEndpoints,
  endpointsToPoints,
} from "@/lib/wall-scene/highlighter";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePath } from "@/types/wall-scene-v2";

export function commitHighlighterLine(
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
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(path);
  useWallSceneStore.getState().bumpRevision();
  return path;
}

/** @deprecated 레거시 자유 곡선 — 신규 UI에서는 사용하지 않음 */
export function commitPathToWallScene(
  points: number[],
  stroke: string,
  strokeWidth: number,
): WallScenePath | null {
  if (points.length < 4) return null;
  return commitHighlighterLine(
    { x1: points[0], y1: points[1], x2: points[2], y2: points[3] },
    stroke,
    { strokeWidth, opacity: 1 },
  );
}
