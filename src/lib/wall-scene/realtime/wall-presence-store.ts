"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  peerLockedObjectIds,
  peerSelectionsByObjectId,
  presencePeerKey,
} from "@/lib/wall-scene/presence-utils";
import { assignPresenceColors } from "@/lib/wall-scene/presence-colors";
import type { WallPresenceState } from "@/types/wall-scene-v2";

type Listener = () => void;

let peers: WallPresenceState[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setWallPresencePeers(next: WallPresenceState[]): void {
  peers = next;
  emit();
}

/** Apply roster pastel colors (include `self` so local avatar matches peers' view). */
export function setWallPresencePeersWithColors(
  next: WallPresenceState[],
  self: { userId: string; sessionId: string },
): void {
  const roster = [self, ...next];
  const colors = assignPresenceColors(roster);
  peers = next.map((peer) => ({
    ...peer,
    color: colors.get(presencePeerKey(peer)) ?? peer.color,
  }));
  emit();
}

export function clearWallPresencePeers(): void {
  if (peers.length === 0) return;
  peers = [];
  emit();
}

export function getWallPresencePeers(): WallPresenceState[] {
  return peers;
}

export function subscribeWallPresence(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Full peer list — for cursors / avatar stack. Cursor moves re-render subscribers. */
export function useWallPresencePeers(): WallPresenceState[] {
  return useSyncExternalStore(
    subscribeWallPresence,
    getWallPresencePeers,
    getWallPresencePeers,
  );
}

/**
 * Selection/lock snapshot only — ignores cursor churn so the Konva Stage does not
 * re-render when a peer merely moves their pointer (iOS Safari Jetsam trigger).
 */
export function usePeerLockedObjectIds(currentSessionId?: string): Set<string> {
  const cacheRef = useRef<{ key: string; value: Set<string> }>({
    key: "",
    value: new Set(),
  });

  const getSnapshot = useCallback(() => {
    const next = peerLockedObjectIds(getWallPresencePeers(), currentSessionId);
    const key = [...next].sort().join("\0");
    if (key === cacheRef.current.key) return cacheRef.current.value;
    cacheRef.current = { key, value: next };
    return next;
  }, [currentSessionId]);

  return useSyncExternalStore(subscribeWallPresence, getSnapshot, getSnapshot);
}

export function usePeerSelectionsByObjectId(
  currentSessionId?: string,
): Map<string, WallPresenceState[]> {
  const cacheRef = useRef<{
    key: string;
    value: Map<string, WallPresenceState[]>;
  }>({
    key: "",
    value: new Map(),
  });

  const getSnapshot = useCallback(() => {
    const next = peerSelectionsByObjectId(
      getWallPresencePeers(),
      currentSessionId,
    );
    const parts: string[] = [];
    for (const [objectId, list] of next) {
      parts.push(
        `${objectId}:${list.map((p) => `${p.sessionId ?? p.userId}:${p.color}`).join(",")}`,
      );
    }
    parts.sort();
    const key = parts.join("|");
    if (key === cacheRef.current.key) return cacheRef.current.value;
    cacheRef.current = { key, value: next };
    return next;
  }, [currentSessionId]);

  return useSyncExternalStore(subscribeWallPresence, getSnapshot, getSnapshot);
}
