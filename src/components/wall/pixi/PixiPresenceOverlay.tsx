"use client";

import {
  dedupePresencePeers,
  shouldShowPeerCursor,
} from "@/lib/wall-scene/presence-utils";
import { useWallPresencePeers } from "@/lib/wall-scene/realtime/wall-presence-store";
import type { PixiWallEngine } from "./pixi-wall-engine";

interface PixiPresenceOverlayProps {
  currentSessionId: string;
  engine: PixiWallEngine | null;
  containerWidth: number;
  containerHeight: number;
}

/** Peer cursors in screen space via Pixi viewport camera. */
export default function PixiPresenceOverlay({
  currentSessionId,
  engine,
}: PixiPresenceOverlayProps) {
  const peers = useWallPresencePeers();
  const visiblePeers = dedupePresencePeers(peers).filter((peer) =>
    shouldShowPeerCursor(peer, { currentSessionId }),
  );

  if (!engine || visiblePeers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {visiblePeers.map((peer) => {
        const screen = engine.viewport.toScreen(peer.cursorX, peer.cursorY);
        return (
          <div
            key={peer.sessionId ?? peer.userId}
            className="absolute flex items-center gap-1"
            style={{
              left: screen.x,
              top: screen.y,
              transform: "translate(-4px, -4px)",
            }}
          >
            <span
              className="h-3 w-3 rounded-full ring-2 ring-white"
              style={{ backgroundColor: peer.color }}
            />
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-foreground/85 shadow-sm"
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
