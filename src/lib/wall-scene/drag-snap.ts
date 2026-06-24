import type Konva from "konva";
import { getSceneObjectExtents } from "@/lib/wall-bounds";
import { computeSnapResult } from "@/lib/wall-scene/snap-guides";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

/** Snap a dragged node to nearby edges/centers and show alignment guides. */
export function applyDragSnapToNode(node: Konva.Node, objectId: string): void {
  const { document, selectedIds } = useWallSceneStore.getState();
  const object = document.objects.find((item) => item.id === objectId);
  if (!object) return;

  const x = node.x();
  const y = node.y();
  const atObject = { ...object, x, y } as WallSceneObject;
  const extents = getSceneObjectExtents(atObject);
  const excludeIds = selectedIds.includes(objectId) ? selectedIds : [objectId];

  const result = computeSnapResult({
    extents,
    objects: document.objects,
    excludeIds,
    wallBounds: document.meta.wallBounds,
    snapToGrid: useWallSceneStore.getState().snapToGrid,
    gridSize: useWallSceneStore.getState().gridSize,
  });

  if (result.deltaX !== 0 || result.deltaY !== 0) {
    node.position({ x: x + result.deltaX, y: y + result.deltaY });
  }

  useWallSceneStore.getState().setSnapGuides(result.guides);
}

export function clearDragSnapGuides(): void {
  useWallSceneStore.getState().setSnapGuides([]);
}
