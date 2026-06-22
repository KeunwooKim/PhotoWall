import { useWallSceneStore } from "@/stores/wall-scene-store";

function sortedObjects() {
  return [...useWallSceneStore.getState().document.objects].sort(
    (a, b) => a.zIndex - b.zIndex,
  );
}

export function bringObjectForward(id: string): boolean {
  const objects = sortedObjects();
  const index = objects.findIndex((object) => object.id === id);
  if (index < 0 || index >= objects.length - 1) return false;

  const current = objects[index];
  const above = objects[index + 1];

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().patchObject(current.id, { zIndex: above.zIndex });
  useWallSceneStore.getState().patchObject(above.id, { zIndex: current.zIndex });
  useWallSceneStore.getState().bumpRevision();
  return true;
}

export function sendObjectBackward(id: string): boolean {
  const objects = sortedObjects();
  const index = objects.findIndex((object) => object.id === id);
  if (index <= 0) return false;

  const current = objects[index];
  const below = objects[index - 1];

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().patchObject(current.id, { zIndex: below.zIndex });
  useWallSceneStore.getState().patchObject(below.id, { zIndex: current.zIndex });
  useWallSceneStore.getState().bumpRevision();
  return true;
}
