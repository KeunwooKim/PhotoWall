"use client";

import type { WallPresenceState } from "@/types/wall-scene-v2";
import { dedupePresencePeers } from "@/lib/wall-scene/presence-utils";

interface WallPresenceOverlayProps {
  peers: WallPresenceState[];
  currentUserId: string;
  wallWidth: number;
  wallHeight: number;
  containerWidth: number;
  containerHeight: number;
  wallScale: number;
}

export default function WallPresenceOverlay({
  peers,
  currentUserId,
  wallWidth,
  wallHeight,
  containerWidth,
  containerHeight,
  wallScale,
}: WallPresenceOverlayProps) {
  const offsetX = containerWidth / 2 - (wallWidth * wallScale) / 2;
  const offsetY = containerHeight / 2 - (wallHeight * wallScale) / 2;

  const visiblePeers = dedupePresencePeers(peers).filter(
    (peer) => peer.userId !== currentUserId && !peer.isManipulating,
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {visiblePeers.map((peer) => {
        const left = offsetX + peer.cursorX * wallScale;
        const top = offsetY + peer.cursorY * wallScale;

        return (
          <div
            key={peer.userId}
            className="absolute flex items-center gap-1 transition-transform duration-75"
            style={{
              left,
              top,
              transform: "translate(-4px, -4px)",
            }}
          >
            <span
              className="h-3 w-3 rounded-full ring-2 ring-white"
              style={{ backgroundColor: peer.color }}
            />
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
              style={{ backgroundColor: peer.color }}
            >
              {peer.displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
