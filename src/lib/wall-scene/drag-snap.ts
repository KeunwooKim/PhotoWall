import type Konva from "konva";
import { getSceneObjectExtents } from "@/lib/wall-bounds";
import { computeSnapResult, type SnapGuide } from "@/lib/wall-scene/snap-guides";
import { getEffectiveWallBounds } from "@/lib/wall-scene/wall-drag-expand";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

/**
 * Snap guides used to go through Zustand on every pointermove, which re-rendered
 * the entire Konva stage (Safari often crashed: "A problem occurred with this webpage").
 * Cache snap targets for the drag and throttle guide commits to the store.
 */
interface DragSnapSession {
  objectId: string;
  excludeIds: string[];
}

let session: DragSnapSession | null = null;
let pendingGuides: SnapGuide[] | null = null;
let guidesRaf: number | null = null;

function flushPendingGuides(): void {
  guidesRaf = null;
  if (!pendingGuides) return;
  const guides = pendingGuides;
  pendingGuides = null;
  useWallSceneStore.getState().setSnapGuides(guides);
}

function scheduleGuides(guides: SnapGuide[]): void {
  pendingGuides = guides;
  if (guidesRaf != null) return;
  guidesRaf = requestAnimationFrame(flushPendingGuides);
}

function cancelScheduledGuides(): void {
  if (guidesRaf != null) {
    cancelAnimationFrame(guidesRaf);
    guidesRaf = null;
  }
  pendingGuides = null;
}

/** Call once at drag start so exclude set stays stable for the gesture. */
export function beginDragSnap(objectId: string): void {
  const { selectedIds } = useWallSceneStore.getState();
  session = {
    objectId,
    excludeIds: selectedIds.includes(objectId) ? [...selectedIds] : [objectId],
  };
}

/** Snap a dragged node to nearby edges/centers and show alignment guides. */
export function applyDragSnapToNode(node: Konva.Node, objectId: string): void {
  const { document, snapToGrid, gridSize } = useWallSceneStore.getState();
  const object = document.objects.find((item) => item.id === objectId);
  if (!object) return;

  if (!session || session.objectId !== objectId) {
    beginDragSnap(objectId);
  }

  const x = node.x();
  const y = node.y();
  const atObject = { ...object, x, y } as WallSceneObject;
  const extents = getSceneObjectExtents(atObject);
  const excludeIds = session?.excludeIds ?? [objectId];

  const result = computeSnapResult({
    extents,
    objects: document.objects,
    excludeIds,
    wallBounds: getEffectiveWallBounds(),
    snapToGrid,
    gridSize,
  });

  if (result.deltaX !== 0 || result.deltaY !== 0) {
    node.position({ x: x + result.deltaX, y: y + result.deltaY });
  }

  scheduleGuides(result.guides);
}

export function clearDragSnapGuides(): void {
  session = null;
  cancelScheduledGuides();
  useWallSceneStore.getState().setSnapGuides([]);
}
