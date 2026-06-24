import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { applyRemotePatchToNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PositionPatch } from "@/lib/wall-scene/align-objects";
import type { FlipPatch } from "@/lib/wall-scene/flip-objects";

function broadcastMetadata(
  id: string,
  patch: WallObjectPatch,
  broadcast?: (id: string, patch: WallObjectPatch) => void,
): void {
  if (broadcast) {
    broadcast(id, patch);
    return;
  }
  broadcastWallPatch(id, patch);
}

export interface MetadataPatch {
  id: string;
  groupId?: string | null;
}

export function applyPositionPatches(
  patches: PositionPatch[],
  broadcast?: (id: string, patch: WallObjectPatch) => void,
): boolean {
  if (patches.length === 0) return false;

  const store = useWallSceneStore.getState();
  store.recordHistory();

  for (const { id, x, y } of patches) {
    store.patchObject(id, { x, y });
    applyRemotePatchToNode(id, { x, y });
    broadcast?.(id, { x, y });
  }

  store.bumpRevision();
  return true;
}

export function applyTransformPatches(
  patches: FlipPatch[],
  broadcast?: (id: string, patch: WallObjectPatch) => void,
): boolean {
  if (patches.length === 0) return false;

  const store = useWallSceneStore.getState();
  store.recordHistory();

  for (const patch of patches) {
    const { id, ...values } = patch;
    store.patchObject(id, values);
    applyRemotePatchToNode(id, values);
    broadcast?.(id, values);
  }

  store.bumpRevision();
  return true;
}

export function applyMetadataPatches(
  patches: MetadataPatch[],
  broadcast?: (id: string, patch: WallObjectPatch) => void,
): boolean {
  if (patches.length === 0) return false;

  const store = useWallSceneStore.getState();
  store.recordHistory();

  for (const { id, ...values } of patches) {
    const patch = values as WallObjectPatch;
    store.patchObject(id, patch);
    broadcastMetadata(id, patch, broadcast);
  }

  store.bumpRevision();
  return true;
}
