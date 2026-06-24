import { useWallSceneStore } from "@/stores/wall-scene-store";

function sortedObjects() {
  return [...useWallSceneStore.getState().document.objects].sort(
    (a, b) => a.zIndex - b.zIndex,
  );
}

function reorderObjects(orderedIds: string[]): void {
  const store = useWallSceneStore.getState();
  store.recordHistory();
  orderedIds.forEach((id, index) => {
    store.patchObject(id, { zIndex: index + 1 });
  });
  store.bumpRevision();
}

export function bringObjectForward(id: string): boolean {
  const objects = sortedObjects();
  const index = objects.findIndex((object) => object.id === id);
  if (index < 0 || index >= objects.length - 1) return false;

  const next = [...objects];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  reorderObjects(next.map((object) => object.id));
  return true;
}

export function sendObjectBackward(id: string): boolean {
  const objects = sortedObjects();
  const index = objects.findIndex((object) => object.id === id);
  if (index <= 0) return false;

  const next = [...objects];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  reorderObjects(next.map((object) => object.id));
  return true;
}

export function bringObjectsToFront(ids: string[]): boolean {
  const selected = new Set(ids);
  const objects = sortedObjects();
  const selectedObjects = objects.filter((object) => selected.has(object.id));
  if (selectedObjects.length === 0) return false;

  const unselected = objects.filter((object) => !selected.has(object.id));
  const topId = objects[objects.length - 1]?.id;
  if (selectedObjects.length === objects.length || topId === selectedObjects[selectedObjects.length - 1]?.id) {
    return false;
  }

  reorderObjects([...unselected, ...selectedObjects].map((object) => object.id));
  return true;
}

export function sendObjectsToBack(ids: string[]): boolean {
  const selected = new Set(ids);
  const objects = sortedObjects();
  const selectedObjects = objects.filter((object) => selected.has(object.id));
  if (selectedObjects.length === 0) return false;

  const unselected = objects.filter((object) => !selected.has(object.id));
  const bottomId = objects[0]?.id;
  if (selectedObjects.length === objects.length || bottomId === selectedObjects[0]?.id) {
    return false;
  }

  reorderObjects([...selectedObjects, ...unselected].map((object) => object.id));
  return true;
}

export function moveObjectToLayerIndex(id: string, targetIndex: number): boolean {
  const objects = sortedObjects();
  const currentIndex = objects.findIndex((object) => object.id === id);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= objects.length) return false;
  if (currentIndex === targetIndex) return false;

  const next = [...objects];
  const [item] = next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, item);
  reorderObjects(next.map((object) => object.id));
  return true;
}
