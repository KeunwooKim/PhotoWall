import type { WallSceneObject } from "@/types/wall-scene-v2";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";

/** Merge a realtime/local patch into a scene object (handles groupId clearing). */
export function mergeObjectPatch(
  object: WallSceneObject,
  patch: WallObjectPatch,
): WallSceneObject {
  const merged = { ...object, ...patch } as WallSceneObject & { groupId?: string };

  if ("groupId" in patch && patch.groupId === null) {
    delete merged.groupId;
  }
  if ("frameId" in patch && patch.frameId === null && merged.type === "photo") {
    delete (merged as { frameId?: string }).frameId;
  }
  if ("decoId" in patch && patch.decoId === null && merged.type === "photo") {
    delete (merged as { decoId?: string }).decoId;
  }

  return merged as WallSceneObject;
}
