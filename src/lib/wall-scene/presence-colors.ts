import { presencePeerKey } from "@/lib/wall-scene/presence-utils";

/**
 * Soft pastels in a fixed order — assigned by sorted session key so each
 * collaborator in a room gets a distinct color (wraps after the list).
 */
export const PRESENCE_PASTEL_PALETTE = [
  "#F8B4C4", // rose
  "#A8D8EA", // sky
  "#B5EAD7", // mint
  "#FFE5B4", // peach cream
  "#D4C1EC", // lavender
  "#F5C6AA", // apricot
  "#C7E8A9", // soft lime
  "#B3E5FC", // powder blue
  "#F8C8DC", // blush
  "#E0F0E3", // sage mist
  "#FFD6A5", // light apricot
  "#C9B1FF", // soft violet
] as const;

export function presenceColorAtIndex(index: number): string {
  const n = PRESENCE_PASTEL_PALETTE.length;
  return PRESENCE_PASTEL_PALETTE[((index % n) + n) % n]!;
}

/** Stable hash fallback when no roster is available yet. */
export function presenceColorForUser(userId: string, sessionId?: string): string {
  const key = sessionId ? `${userId}:${sessionId}` : userId;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return presenceColorAtIndex(Math.abs(hash));
}

type PeerRef = { userId: string; sessionId?: string };

/**
 * Map each peer key → pastel color by sorted order among `roster`.
 * Same roster on every client ⇒ same colors (no hash collisions in-room).
 */
export function assignPresenceColors(roster: PeerRef[]): Map<string, string> {
  const keys = [...new Set(roster.map((p) => presencePeerKey(p)))].sort((a, b) =>
    a.localeCompare(b),
  );
  const map = new Map<string, string>();
  keys.forEach((key, index) => {
    map.set(key, presenceColorAtIndex(index));
  });
  return map;
}

export function presenceColorFromRoster(
  peer: PeerRef,
  roster: PeerRef[],
): string {
  const map = assignPresenceColors(roster);
  return map.get(presencePeerKey(peer)) ?? presenceColorForUser(peer.userId, peer.sessionId);
}

/** `#RRGGBB` → Pixi numeric color. */
export function presenceColorToPixi(color: string): number {
  const hex = color.trim().replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return Number.parseInt(hex, 16);
  }
  return 0xf8b4c4;
}
