import type { WallPresenceState, WallSceneObject } from "@/types/wall-scene-v2";
import {
  HIGHLIGHTER_STROKE_WIDTH,
  isStraightHighlighterPath,
  linePointsToHighlighterRect,
} from "@/lib/wall-scene/highlighter";

export interface PeerHighlightLayout {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  /** Centered stroke highlight (form path / highlighter) */
  offsetY?: number;
}

/** Stable map key for a presence peer — prefer session (device/tab), not user. */
export function presencePeerKey(peer: {
  userId: string;
  sessionId?: string;
}): string {
  return peer.sessionId || peer.userId;
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

  if (object.type === "text") {
    return {
      ...base,
      width: object.width,
      height: object.fontSize * 1.4,
    };
  }

  if (object.type === "path" && isStraightHighlighterPath(object.points)) {
    const strokeWidth = object.strokeWidth || HIGHLIGHTER_STROKE_WIDTH;
    const line = linePointsToHighlighterRect(object.points, strokeWidth + 4);
    if (!line) return null;

    return {
      x: object.x + line.x,
      y: object.y + line.y,
      rotation: line.rotation,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      width: line.width,
      height: line.height,
      offsetY: line.height / 2,
    };
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

/** Peer cursor chip — other sessions only, and only while idle (no selection / drag). */
export function shouldShowPeerCursor(
  peer: WallPresenceState,
  options: { currentSessionId?: string },
): boolean {
  if (options.currentSessionId && peer.sessionId === options.currentSessionId) {
    return false;
  }
  if (peer.isManipulating) return false;
  if (peerSelectedObjectIds(peer).length > 0) return false;
  return hasMeaningfulCursor(peer);
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

/** One presence entry per browser session (same account on two devices stays as two peers). */
export function dedupePresencePeers(peers: WallPresenceState[]): WallPresenceState[] {
  const bySession = new Map<string, WallPresenceState>();

  for (const peer of peers) {
    if (!peer.userId) continue;
    const key = presencePeerKey(peer);
    const existing = bySession.get(key);
    if (!existing || peer.updatedAt >= existing.updatedAt) {
      bySession.set(key, peer);
    }
  }

  return [...bySession.values()];
}

/** Objects currently selected by other sessions — soft-locked for local edit. */
export function peerLockedObjectIds(
  peers: WallPresenceState[],
  currentSessionId?: string,
): Set<string> {
  const locked = new Set<string>();

  for (const peer of dedupePresencePeers(peers)) {
    if (currentSessionId && peer.sessionId === currentSessionId) continue;
    for (const objectId of peerSelectedObjectIds(peer)) {
      locked.add(objectId);
    }
  }

  return locked;
}

/** Peers (excluding this session) grouped by the object they are selecting / moving. */
export function peerSelectionsByObjectId(
  peers: WallPresenceState[],
  currentSessionId?: string,
): Map<string, WallPresenceState[]> {
  const map = new Map<string, WallPresenceState[]>();

  for (const peer of dedupePresencePeers(peers)) {
    if (currentSessionId && peer.sessionId === currentSessionId) continue;

    for (const objectId of peerSelectedObjectIds(peer)) {
      const list = map.get(objectId) ?? [];
      list.push(peer);
      map.set(objectId, list);
    }
  }

  return map;
}
