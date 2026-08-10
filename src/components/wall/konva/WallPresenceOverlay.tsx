"use client";

import {
  dedupePresencePeers,
  shouldShowPeerCursor,
} from "@/lib/wall-scene/presence-utils";
import {
  getEffectivePan,
  getEffectiveWallBounds,
} from "@/lib/wall-scene/wall-drag-expand";
import { useWallPresencePeers } from "@/lib/wall-scene/realtime/wall-presence-store";
import { useWallSceneStore } from "@/stores/wall-scene-store";

interface WallPresenceOverlayProps {
  currentSessionId: string;
  containerWidth: number;
  containerHeight: number;
}

export default function WallPresenceOverlay({
  currentSessionId,
  containerWidth,
  containerHeight,
}: WallPresenceOverlayProps) {
  const peers = useWallPresencePeers();
  // Read live layout so cursors stay aligned during remote wall-live expand
  // without forcing the Konva Stage to React-render on every presence tick.
  const wall = getEffectiveWallBounds();
  const pan = getEffectivePan();
  const wallScale = useWallSceneStore((s) => s.viewportScale);

  const offsetX = containerWidth / 2 - (wall.width * wallScale) / 2 + pan.x;
  const offsetY = containerHeight / 2 - (wall.height * wallScale) / 2 + pan.y;

  const visiblePeers = dedupePresencePeers(peers).filter((peer) =>
    shouldShowPeerCursor(peer, { currentSessionId }),
  );

  if (visiblePeers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {visiblePeers.map((peer) => {
        const left = offsetX + peer.cursorX * wallScale;
        const top = offsetY + peer.cursorY * wallScale;

        return (
          <div
            key={peer.sessionId ?? peer.userId}
            className="absolute flex items-center gap-1"
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
