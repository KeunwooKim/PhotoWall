"use client";

import { dedupePresencePeers, presencePeerKey } from "@/lib/wall-scene/presence-utils";
import {
  assignPresenceColors,
  presenceColorForUser,
} from "@/lib/wall-scene/presence-colors";
import { useWallPresencePeers } from "@/lib/wall-scene/realtime/wall-presence-store";

const MAX_VISIBLE = 4;

export interface PeerAvatarSelf {
  userId: string;
  displayName: string;
  sessionId?: string;
}

interface PeerAvatarStackProps {
  /** Always show the current session first when provided. */
  self?: PeerAvatarSelf | null;
  maxVisible?: number;
  className?: string;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).slice(0, 2).toUpperCase();
  }
  return trimmed.slice(0, 2);
}

function AvatarCircle({
  name,
  color,
  title,
  zIndex,
}: {
  name: string;
  color: string;
  title: string;
  zIndex: number;
}) {
  return (
    <span
      title={title}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background text-[9px] font-semibold text-foreground/80 shadow-sm"
      style={{ backgroundColor: color, zIndex, marginLeft: zIndex === 0 ? 0 : -8 }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping circular presence avatars — one circle per session (same user on two devices = two). */
export default function PeerAvatarStack({
  self,
  maxVisible = MAX_VISIBLE,
  className = "",
}: PeerAvatarStackProps) {
  const peers = useWallPresencePeers();
  const others = dedupePresencePeers(peers).filter((p) => {
    if (!self?.sessionId) return true;
    return p.sessionId !== self.sessionId;
  });

  const roster = [
    ...(self?.userId
      ? [{ userId: self.userId, sessionId: self.sessionId }]
      : []),
    ...others,
  ];
  const colors = assignPresenceColors(roster);

  const entries: { key: string; displayName: string; color: string }[] = [];
  if (self?.userId) {
    const key = self.sessionId || `self:${self.userId}`;
    entries.push({
      key,
      displayName: self.displayName || "나",
      color:
        colors.get(presencePeerKey(self)) ??
        presenceColorForUser(self.userId, self.sessionId),
    });
  }
  for (const peer of others) {
    const sameUser = self?.userId && peer.userId === self.userId;
    entries.push({
      key: presencePeerKey(peer),
      displayName: sameUser
        ? `${peer.displayName || "나"}(다른 기기)`
        : peer.displayName || "친구",
      color:
        peer.color ||
        colors.get(presencePeerKey(peer)) ||
        presenceColorForUser(peer.userId, peer.sessionId),
    });
  }

  if (entries.length === 0) return null;

  const visible = entries.slice(0, maxVisible);
  const overflow = entries.length - visible.length;
  const names = entries.map((e) => e.displayName).join(", ");

  return (
    <div
      className={`flex items-center ${className}`}
      title={names}
      aria-label={`접속 중 ${entries.length}명: ${names}`}
    >
      {visible.map((entry, index) => (
        <AvatarCircle
          key={entry.key}
          name={entry.displayName}
          color={entry.color}
          title={entry.displayName}
          zIndex={index}
        />
      ))}
      {overflow > 0 && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-foreground/10 text-[9px] font-semibold text-foreground/90 shadow-sm"
          style={{ marginLeft: -8, zIndex: visible.length }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
