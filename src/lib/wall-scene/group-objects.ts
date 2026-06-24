import { isSelectableObject } from "@/lib/wall-scene/selectable-objects";
import { applyMetadataPatches } from "@/lib/wall-scene/object-transform";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export function getGroupMemberIds(
  objects: WallSceneObject[],
  groupId: string,
): string[] {
  return objects
    .filter((object) => object.groupId === groupId && isSelectableObject(object))
    .map((object) => object.id);
}

export function expandToGroupSelection(
  objects: WallSceneObject[],
  ids: string[],
): string[] {
  const expanded = new Set<string>();

  for (const id of ids) {
    const object = objects.find((item) => item.id === id);
    if (!object) continue;

    if (object.groupId) {
      for (const memberId of getGroupMemberIds(objects, object.groupId)) {
        expanded.add(memberId);
      }
      continue;
    }

    expanded.add(id);
  }

  return [...expanded];
}

/** Assign a shared groupId to 2+ selected objects. */
export function groupSelectedObjects(
  broadcast?: (id: string, patch: WallObjectPatch) => void,
): boolean {
  const store = useWallSceneStore.getState();
  const { selectedIds } = store;
  if (selectedIds.length < 2) return false;

  const groupId = crypto.randomUUID();
  return applyMetadataPatches(
    selectedIds.map((id) => ({ id, groupId })),
    broadcast,
  );
}

/** Remove groupId from selected objects' groups. */
export function ungroupSelectedObjects(
  broadcast?: (id: string, patch: WallObjectPatch) => void,
): boolean {
  const store = useWallSceneStore.getState();
  const { selectedIds, document } = store;
  if (selectedIds.length === 0) return false;

  const groupIds = new Set<string>();
  for (const id of selectedIds) {
    const object = document.objects.find((item) => item.id === id);
    if (object?.groupId) groupIds.add(object.groupId);
  }

  if (groupIds.size === 0) return false;

  const patches = document.objects
    .filter((object) => object.groupId && groupIds.has(object.groupId))
    .map((object) => ({ id: object.id, groupId: null }));

  return applyMetadataPatches(patches, broadcast);
}

export function selectionHasGroup(selectedIds: string[], objects: WallSceneObject[]): boolean {
  return selectedIds.some((id) => {
    const object = objects.find((item) => item.id === id);
    return !!object?.groupId;
  });
}

export function canGroupSelection(selectedIds: string[]): boolean {
  return selectedIds.length >= 2;
}
