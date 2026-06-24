import type { WallPresenceState, WallSceneObject } from "@/types/wall-scene-v2";

export interface PeerHighlightLayout {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
}

/** Local box for peer selection frames (photo, sticker, tape, emoji). */
export function peerHighlightLayout(object: WallSceneObject): PeerHighlightLayout | null {
  const base = {
    x: object.x,
    y: object.y,
    rotation: object.rotation,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
  };

  if (
    object.type === "photo" ||
    object.type === "sticker" ||
    object.type === "tape"
  ) {
    return { ...base, width: object.width, height: object.height };
  }

  if (object.type === "emoji") {
    const size = object.fontSize;
    return { ...base, width: size, height: size };
  }

  return null;
}

/** Resolved selection list from a presence snapshot (multi-select aware). */
export function peerSelectedObjectIds(peer: WallPresenceState): string[] {
  if (peer.selectedObjectIds?.length) return peer.selectedObjectIds;
  if (peer.selectedObjectId) return [peer.selectedObjectId];
  return [];
}

function hasMeaningfulCursor(peer: WallPresenceState): boolean {
  return (
    Number.isFinite(peer.cursorX) &&
    Number.isFinite(peer.cursorY) &&
    !(peer.cursorX === 0 && peer.cursorY === 0)
  );
}

/** Prefer the newest presence snapshot — do not resurrect cleared selection fields. */
export function mergePeerPresence(
  existing: WallPresenceState | undefined,
  incoming: WallPresenceState,
): WallPresenceState {
  if (!existing) return incoming;

  const existingAt = existing.updatedAt ?? 0;
  const incomingAt = incoming.updatedAt ?? 0;

  if (incomingAt >= existingAt) {
    const keepExistingCursor =
      !hasMeaningfulCursor(incoming) && hasMeaningfulCursor(existing);
    const incomingIds = peerSelectedObjectIds(incoming);

    return {
      ...existing,
      ...incoming,
      cursorX: keepExistingCursor ? existing.cursorX : incoming.cursorX,
      cursorY: keepExistingCursor ? existing.cursorY : incoming.cursorY,
      selectedObjectIds: incomingIds.length > 0 ? incomingIds : undefined,
      selectedObjectId: incomingIds.at(-1),
      isManipulating: incoming.isManipulating,
      updatedAt: incomingAt,
    };
  }

  return existing;
}

/** One presence entry per user — latest cursor wins (multi-tab / reconnect safe). */
export function dedupePresencePeers(peers: WallPresenceState[]): WallPresenceState[] {
  const byUserId = new Map<string, WallPresenceState>();

  for (const peer of peers) {
    if (!peer.userId) continue;
    const existing = byUserId.get(peer.userId);
    if (!existing || peer.updatedAt >= existing.updatedAt) {
      byUserId.set(peer.userId, peer);
    }
  }

  return [...byUserId.values()];
}

/** Peers (excluding self) grouped by the object they are selecting / moving. */
export function peerSelectionsByObjectId(
  peers: WallPresenceState[],
  currentUserId?: string,
): Map<string, WallPresenceState[]> {
  const map = new Map<string, WallPresenceState[]>();

  for (const peer of dedupePresencePeers(peers)) {
    if (currentUserId && peer.userId === currentUserId) continue;

    for (const objectId of peerSelectedObjectIds(peer)) {
      const list = map.get(objectId) ?? [];
      list.push(peer);
      map.set(objectId, list);
    }
  }

  return map;
}
