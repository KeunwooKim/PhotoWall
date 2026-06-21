import type { WallPresenceState } from "@/types/wall-scene-v2";

/** Prefer the newest presence snapshot — do not resurrect cleared selection fields. */
export function mergePeerPresence(
  existing: WallPresenceState | undefined,
  incoming: WallPresenceState,
): WallPresenceState {
  if (!existing) return incoming;

  const existingAt = existing.updatedAt ?? 0;
  const incomingAt = incoming.updatedAt ?? 0;

  if (incomingAt >= existingAt) {
    return {
      ...existing,
      ...incoming,
      selectedObjectId: incoming.selectedObjectId,
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
    if (!peer.selectedObjectId) continue;

    const list = map.get(peer.selectedObjectId) ?? [];
    list.push(peer);
    map.set(peer.selectedObjectId, list);
  }

  return map;
}
