import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import type { WallSceneObject } from "@/types/wall-scene-v2";
import type { WallDisplayNode } from "@/lib/wall-scene/realtime/wall-display-node";

const nodes = new Map<string, WallDisplayNode>();
const peerHighlightNodes = new Map<string, WallDisplayNode>();
const locallyDragging = new Set<string>();
const pendingPatches = new Map<string, WallObjectPatch>();

export function getWallNode(id: string): WallDisplayNode | undefined {
  return nodes.get(id);
}

export function registerWallNode(id: string, node: WallDisplayNode | null): void {
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
export function registerPeerHighlightNode(id: string, node: WallDisplayNode | null): void {
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
  highlight.requestRedraw?.();
}

export function setWallNodeDragging(id: string, active: boolean): void {
  if (active) locallyDragging.add(id);
  else locallyDragging.delete(id);
}

export function isAnyWallNodeDragging(): boolean {
  return locallyDragging.size > 0;
}

export function isWallNodeDragging(id: string): boolean {
  return locallyDragging.has(id);
}

/**
 * West/north live expand shifts stationary wall nodes — peer selection frames must
 * move by the same delta or they appear to slide across the photos.
 * Moving nodes are skipped (drag session + pan/wallpaper handle them live).
 */
export function shiftStationaryWallNodes(
  dx: number,
  dy: number,
  movingIds: ReadonlySet<string>,
): void {
  if (dx === 0 && dy === 0) return;

  for (const [id, node] of nodes) {
    if (movingIds.has(id)) continue;
    node.position({ x: node.x() + dx, y: node.y() + dy });
  }
  for (const [id, highlight] of peerHighlightNodes) {
    if (movingIds.has(id)) continue;
    highlight.position({ x: highlight.x() + dx, y: highlight.y() + dy });
  }
}

export function revertStationaryContentShift(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;

  for (const [id, node] of nodes) {
    if (locallyDragging.has(id)) continue;
    node.position({ x: node.x() - dx, y: node.y() - dy });
  }
  for (const [id, highlight] of peerHighlightNodes) {
    if (locallyDragging.has(id)) continue;
    highlight.position({ x: highlight.x() - dx, y: highlight.y() - dy });
  }
}

export function shiftAllWallNodes(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;

  for (const node of nodes.values()) {
    node.position({ x: node.x() + dx, y: node.y() + dy });
  }
  for (const highlight of peerHighlightNodes.values()) {
    highlight.position({ x: highlight.x() + dx, y: highlight.y() + dy });
  }
}

export function applyRemotePatchToNode(
  id: string,
  patch: WallObjectPatch,
  options?: { draw?: boolean },
): boolean {
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
  if (options?.draw !== false) {
    node.requestRedraw?.();
    peerHighlightNodes.get(id)?.requestRedraw?.();
  }
  return true;
}

/** Apply many live patches then draw once (west-expand shifts every object). */
export function applyRemotePatchesToNodes(
  patches: Array<{ id: string; patch: WallObjectPatch }>,
): void {
  for (const { id, patch } of patches) {
    applyRemotePatchToNode(id, patch, { draw: false });
  }
  for (const { id } of patches) {
    nodes.get(id)?.requestRedraw?.();
    peerHighlightNodes.get(id)?.requestRedraw?.();
  }
}

export function applyRemoteObjectsToNodes(objects: WallSceneObject[]): void {
  const manipulable = new Set(["photo", "sticker", "emoji", "text", "tape", "path"]);
  const keep = new Set(objects.map((object) => object.id));

  for (const id of [...nodes.keys()]) {
    if (keep.has(id) || locallyDragging.has(id)) continue;
    const node = nodes.get(id);
    nodes.delete(id);
    pendingPatches.delete(id);
    peerHighlightNodes.get(id)?.destroy();
    peerHighlightNodes.delete(id);
    node?.destroy();
  }

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
    node.requestRedraw?.();
  }
}

/** Remove objects deleted by a peer from the live display registry. */
export function removeRemoteWallNodes(ids: Iterable<string>): void {
  for (const id of ids) {
    if (locallyDragging.has(id)) continue;
    const node = nodes.get(id);
    if (node) {
      node.destroy();
      nodes.delete(id);
    }
    const highlight = peerHighlightNodes.get(id);
    if (highlight) {
      highlight.destroy();
      peerHighlightNodes.delete(id);
    }
    pendingPatches.delete(id);
  }
}
