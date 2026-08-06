import type Konva from "konva";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import type { WallSceneObject } from "@/types/wall-scene-v2";

const nodes = new Map<string, Konva.Group>();
const peerHighlightNodes = new Map<string, Konva.Group>();
const locallyDragging = new Set<string>();
const pendingPatches = new Map<string, WallObjectPatch>();

export function getWallNode(id: string): Konva.Group | undefined {
  return nodes.get(id);
}

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

/** Peer selection frames — kept in sync with live node transforms (not throttled store). */
export function registerPeerHighlightNode(id: string, node: Konva.Group | null): void {
  if (node) {
    peerHighlightNodes.set(id, node);
    const live = nodes.get(id);
    if (live) {
      syncPeerHighlightTransform(id, {
        x: live.x(),
        y: live.y(),
        rotation: live.rotation(),
        scaleX: live.scaleX(),
        scaleY: live.scaleY(),
      });
    }
    return;
  }
  peerHighlightNodes.delete(id);
}

function syncPeerHighlightTransform(id: string, patch: WallObjectPatch): void {
  const highlight = peerHighlightNodes.get(id);
  if (!highlight) return;

  if (patch.x != null || patch.y != null) {
    highlight.position({
      x: patch.x ?? highlight.x(),
      y: patch.y ?? highlight.y(),
    });
  }
  if (patch.rotation != null) highlight.rotation(patch.rotation);
  if (patch.scaleX != null) highlight.scaleX(patch.scaleX);
  if (patch.scaleY != null) highlight.scaleY(patch.scaleY);
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
  syncPeerHighlightTransform(id, patch);
  node.getLayer()?.batchDraw();
  peerHighlightNodes.get(id)?.getLayer()?.batchDraw();
  return true;
}

export function applyRemoteObjectsToNodes(objects: WallSceneObject[]): void {
  const manipulable = new Set(["photo", "sticker", "emoji", "text", "tape", "path"]);

  for (const object of objects) {
    if (!manipulable.has(object.type)) continue;
    if (locallyDragging.has(object.id)) continue;

    const node = nodes.get(object.id);
    if (!node) continue;

    const patch = {
      x: object.x,
      y: object.y,
      rotation: object.rotation,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
    };
    node.position({ x: object.x, y: object.y });
    node.rotation(object.rotation);
    node.scaleX(object.scaleX);
    node.scaleY(object.scaleY);
    syncPeerHighlightTransform(object.id, patch);
    node.getLayer()?.batchDraw();
  }
}
