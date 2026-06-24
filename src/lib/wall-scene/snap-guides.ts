import type { WallBounds } from "@/lib/wall-bounds";
import { getSceneObjectExtents } from "@/lib/wall-bounds";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export const SNAP_THRESHOLD = 6;

export interface SnapGuide {
  orientation: "horizontal" | "vertical";
  position: number;
}

export interface SnapResult {
  deltaX: number;
  deltaY: number;
  guides: SnapGuide[];
}

interface SnapExtents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function collectGridTargets(size: number, max: number): number[] {
  const targets: number[] = [];
  for (let pos = 0; pos <= max; pos += size) {
    targets.push(pos);
  }
  return targets;
}

function collectSnapTargets(
  objects: WallSceneObject[],
  excludeIds: Set<string>,
  wallBounds: WallBounds,
  snapToGrid: boolean,
  gridSize: number,
): { x: number[]; y: number[] } {
  const xTargets = new Set<number>([0, wallBounds.width / 2, wallBounds.width]);
  const yTargets = new Set<number>([0, wallBounds.height / 2, wallBounds.height]);

  if (snapToGrid) {
    for (const pos of collectGridTargets(gridSize, wallBounds.width)) xTargets.add(pos);
    for (const pos of collectGridTargets(gridSize, wallBounds.height)) yTargets.add(pos);
  }

  for (const object of objects) {
    if (excludeIds.has(object.id)) continue;
    const ext = getSceneObjectExtents(object);
    xTargets.add(ext.minX);
    xTargets.add((ext.minX + ext.maxX) / 2);
    xTargets.add(ext.maxX);
    yTargets.add(ext.minY);
    yTargets.add((ext.minY + ext.maxY) / 2);
    yTargets.add(ext.maxY);
  }

  return {
    x: [...xTargets],
    y: [...yTargets],
  };
}

function bestSnapDelta(
  edges: number[],
  targets: number[],
  threshold: number,
): { delta: number; guide?: number } {
  let bestDelta = 0;
  let bestDistance = threshold + 1;
  let guide: number | undefined;

  for (const edge of edges) {
    for (const target of targets) {
      const delta = target - edge;
      const distance = Math.abs(delta);
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance;
        bestDelta = delta;
        guide = target;
      }
    }
  }

  return { delta: bestDistance <= threshold ? bestDelta : 0, guide };
}

export function computeSnapResult({
  extents,
  objects,
  excludeIds,
  wallBounds,
  threshold = SNAP_THRESHOLD,
  snapToGrid = false,
  gridSize = 20,
}: {
  extents: SnapExtents;
  objects: WallSceneObject[];
  excludeIds: string[];
  wallBounds: WallBounds;
  threshold?: number;
  snapToGrid?: boolean;
  gridSize?: number;
}): SnapResult {
  const exclude = new Set(excludeIds);
  const targets = collectSnapTargets(
    objects,
    exclude,
    wallBounds,
    snapToGrid,
    gridSize,
  );

  const centerX = (extents.minX + extents.maxX) / 2;
  const centerY = (extents.minY + extents.maxY) / 2;

  const snapX = bestSnapDelta([extents.minX, centerX, extents.maxX], targets.x, threshold);
  const snapY = bestSnapDelta([extents.minY, centerY, extents.maxY], targets.y, threshold);

  const guides: SnapGuide[] = [];
  if (snapX.guide != null) {
    guides.push({ orientation: "vertical", position: snapX.guide });
  }
  if (snapY.guide != null) {
    guides.push({ orientation: "horizontal", position: snapY.guide });
  }

  return {
    deltaX: snapX.delta,
    deltaY: snapY.delta,
    guides,
  };
}
