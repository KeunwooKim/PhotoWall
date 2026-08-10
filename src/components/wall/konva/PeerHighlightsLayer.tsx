"use client";

import { Group, Layer } from "react-konva";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { peerHighlightLayout } from "@/lib/wall-scene/presence-utils";
import { getWallNode, registerPeerHighlightNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { usePeerSelectionsByObjectId } from "@/lib/wall-scene/realtime/wall-presence-store";
import { wrapKonvaNode } from "@/lib/wall-scene/realtime/wrap-konva-node";
import PeerObjectHighlight from "./PeerObjectHighlight";

interface PeerHighlightsLayerProps {
  currentSessionId?: string;
}

/**
 * Own presence subscription (selection only) so cursor moves do not re-render
 * the main object Stage — critical for large walls on iOS Safari.
 */
export default function PeerHighlightsLayer({
  currentSessionId,
}: PeerHighlightsLayerProps) {
  const objects = useWallSceneStore((s) => s.document.objects);
  const peerHighlightsByObjectId = usePeerSelectionsByObjectId(currentSessionId);

  if (peerHighlightsByObjectId.size === 0) return null;

  return (
    <Layer listening={false}>
      {objects.map((object) => {
        const highlights = peerHighlightsByObjectId.get(object.id);
        if (!highlights?.length) return null;

        const live = getWallNode(object.id);
        const layoutObject = live
          ? {
              ...object,
              x: live.x(),
              y: live.y(),
              rotation: live.rotation(),
              scaleX: live.scaleX(),
              scaleY: live.scaleY(),
            }
          : object;
        const layout = peerHighlightLayout(layoutObject);
        if (!layout) return null;

        return (
          <Group
            key={`peer-highlight-${object.id}`}
            ref={(node) =>
              registerPeerHighlightNode(object.id, node ? wrapKonvaNode(node) : null)
            }
            x={layout.x}
            y={layout.y}
            rotation={layout.rotation}
            scaleX={layout.scaleX}
            scaleY={layout.scaleY}
            offsetY={layout.offsetY ?? 0}
          >
            <PeerObjectHighlight
              peers={highlights}
              width={layout.width}
              height={layout.height}
              scaleX={layout.scaleX}
              scaleY={layout.scaleY}
            />
          </Group>
        );
      })}
    </Layer>
  );
}
