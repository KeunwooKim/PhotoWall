import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

const PASTE_OFFSET = 16;

let clipboard: WallSceneObject[] | null = null;
let pasteCount = 0;

function cloneForClipboard(objects: WallSceneObject[]): WallSceneObject[] {
  return objects.map((object) => JSON.parse(JSON.stringify(object)) as WallSceneObject);
}

function cloneForPaste(object: WallSceneObject, zIndex: number, offset: number): WallSceneObject {
  const clone = JSON.parse(JSON.stringify(object)) as WallSceneObject;
  clone.id = crypto.randomUUID();
  clone.x += offset;
  clone.y += offset;
  clone.zIndex = zIndex;
  delete clone.groupId;
  return clone;
}

/** Copy selected objects to the in-memory clipboard. */
export function copySelectedObjects(): boolean {
  const { selectedIds, document } = useWallSceneStore.getState();
  if (selectedIds.length === 0) return false;

  const objects = selectedIds
    .map((id) => document.objects.find((object) => object.id === id))
    .filter((object): object is WallSceneObject => object != null);

  if (objects.length === 0) return false;

  clipboard = cloneForClipboard(objects);
  pasteCount = 0;
  return true;
}

/** Copy then delete the current selection. */
export function cutSelectedObjects(): boolean {
  if (!copySelectedObjects()) return false;
  useWallSceneStore.getState().removeSelectedObjects();
  useWallSceneStore.getState().bumpRevision();
  return true;
}

/** Paste clipboard objects with a staggered offset and select the copies. */
export function pasteClipboardObjects(): string[] {
  if (!clipboard || clipboard.length === 0) return [];

  const store = useWallSceneStore.getState();
  pasteCount += 1;
  const offset = PASTE_OFFSET * pasteCount;

  const maxZ = store.document.objects.reduce(
    (max, object) => Math.max(max, object.zIndex),
    0,
  );

  const newIds: string[] = [];
  let nextZ = maxZ;

  store.recordHistory();

  for (const object of clipboard) {
    nextZ += 1;
    const clone = cloneForPaste(object, nextZ, offset);
    store.upsertObject(clone);
    newIds.push(clone.id);
  }

  if (newIds.length === 0) return [];

  store.setSelectedIds(newIds);
  store.bumpRevision();
  return newIds;
}

export function hasClipboardContent(): boolean {
  return clipboard != null && clipboard.length > 0;
}
