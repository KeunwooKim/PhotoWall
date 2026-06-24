import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

const DUPLICATE_OFFSET = 16;

function cloneObject(object: WallSceneObject, zIndex: number): WallSceneObject {
  const clone = JSON.parse(JSON.stringify(object)) as WallSceneObject;
  clone.id = crypto.randomUUID();
  clone.x += DUPLICATE_OFFSET;
  clone.y += DUPLICATE_OFFSET;
  clone.zIndex = zIndex;
  delete clone.groupId;
  return clone;
}

/** Duplicate selected objects, offset slightly, and select the copies. */
export function duplicateSelectedObjects(): string[] {
  const store = useWallSceneStore.getState();
  const { selectedIds, document } = store;
  if (selectedIds.length === 0) return [];

  const maxZ = document.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);
  const newIds: string[] = [];
  let nextZ = maxZ;

  store.recordHistory();

  for (const id of selectedIds) {
    const object = document.objects.find((item) => item.id === id);
    if (!object) continue;
    nextZ += 1;
    const clone = cloneObject(object, nextZ);
    store.upsertObject(clone);
    newIds.push(clone.id);
  }

  if (newIds.length === 0) return [];

  store.setSelectedIds(newIds);
  store.bumpRevision();
  return newIds;
}
