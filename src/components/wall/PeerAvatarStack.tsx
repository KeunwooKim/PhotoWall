"use client";

import { dedupePresencePeers } from "@/lib/wall-scene/presence-utils";
import { presenceColorForUser } from "@/lib/wall-scene/presence-colors";
import type { WallPresenceState } from "@/types/wall-scene-v2";

const MAX_VISIBLE = 4;

export interface PeerAvatarSelf {
  userId: string;
  displayName: string;
}

interface PeerAvatarStackProps {
  peers: WallPresenceState[];
  /** Always show the current user first when provided. */
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-[9px] font-semibold text-white shadow-sm"
      style={{ backgroundColor: color, zIndex, marginLeft: zIndex === 0 ? 0 : -8 }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping circular presence avatars for the editor header. */
export default function PeerAvatarStack({
  peers,
  self,
  maxVisible = MAX_VISIBLE,
  className = "",
}: PeerAvatarStackProps) {
  const others = dedupePresencePeers(peers).filter((p) => !self || p.userId !== self.userId);

  const entries: { userId: string; displayName: string; color: string }[] = [];
  if (self?.userId) {
    entries.push({
      userId: self.userId,
      displayName: self.displayName || "나",
      color: presenceColorForUser(self.userId),
    });
  }
  for (const peer of others) {
    entries.push({
      userId: peer.userId,
      displayName: peer.displayName || "친구",
      color: peer.color || presenceColorForUser(peer.userId),
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
          key={entry.userId}
          name={entry.displayName}
          color={entry.color}
          title={entry.displayName}
          zIndex={index}
        />
      ))}
      {overflow > 0 && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-[9px] font-semibold text-neutral-700 shadow-sm"
          style={{ marginLeft: -8, zIndex: visible.length }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
