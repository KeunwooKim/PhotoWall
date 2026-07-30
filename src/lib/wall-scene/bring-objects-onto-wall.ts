import {
  planBringOntoWall,
  countObjectsOutsideWall,
} from "@/lib/wall-scene/clamp-object-to-wall";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { getWallNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { useWallSceneStore } from "@/stores/wall-scene-store";

/** Bring outside objects onto the wall. Returns how many were moved. */
export function applyBringOntoWall(selectedIds: string[] = []): number {
  const store = useWallSceneStore.getState();
  const wall = store.document.meta.wallBounds;
  const plans = planBringOntoWall(store.document.objects, wall, selectedIds);
  if (plans.length === 0) return 0;

  store.recordHistory();
  for (const plan of plans) {
    store.patchObject(plan.id, { x: plan.x, y: plan.y });
    broadcastWallPatch(plan.id, { x: plan.x, y: plan.y });
    getWallNode(plan.id)?.position({ x: plan.x, y: plan.y });
  }
  store.bumpRevision();
  return plans.length;
}

export function countOutsideObjectsOnWall(): number {
  const { document } = useWallSceneStore.getState();
  return countObjectsOutsideWall(document.objects, document.meta.wallBounds);
}
