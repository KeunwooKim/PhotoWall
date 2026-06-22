import type Konva from "konva";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import type { WallSceneObject } from "@/types/wall-scene-v2";

const nodes = new Map<string, Konva.Group>();
const locallyDragging = new Set<string>();
const pendingPatches = new Map<string, WallObjectPatch>();

export function registerWallNode(id: string, node: Konva.Group | null): void {
  if (node) {
    nodes.set(id, node);
    const pending = pendingPatches.get(id);
    if (pending) {
      pendingPatches.delete(id);
      applyRemotePatchToNode(id, pending);
    }
    return;
  }

  nodes.delete(id);
}

export function setWallNodeDragging(id: string, active: boolean): void {
  if (active) locallyDragging.add(id);
  else locallyDragging.delete(id);
}

export function isAnyWallNodeDragging(): boolean {
  return locallyDragging.size > 0;
}

export function applyRemotePatchToNode(id: string, patch: WallObjectPatch): boolean {
  if (locallyDragging.has(id)) return false;

  const node = nodes.get(id);
  if (!node) {
    const existing = pendingPatches.get(id) ?? {};
    pendingPatches.set(id, { ...existing, ...patch });
    return false;
  }

  if (patch.x != null || patch.y != null) {
    node.position({ x: patch.x ?? node.x(), y: patch.y ?? node.y() });
  }
  if (patch.rotation != null) node.rotation(patch.rotation);
  if (patch.scaleX != null) node.scaleX(patch.scaleX);
  if (patch.scaleY != null) node.scaleY(patch.scaleY);
  node.getLayer()?.batchDraw();
  return true;
}

export function applyRemoteObjectsToNodes(objects: WallSceneObject[]): void {
  const manipulable = new Set(["photo", "sticker", "emoji", "tape"]);

  for (const obj of objects) {
    if (!manipulable.has(obj.type)) continue;
    if (locallyDragging.has(obj.id)) continue;

    const node = nodes.get(obj.id);
    if (!node) continue;

    node.position({ x: obj.x, y: obj.y });
    node.rotation(obj.rotation);
    node.scaleX(obj.scaleX);
    node.scaleY(obj.scaleY);
    node.getLayer()?.batchDraw();
  }
}
