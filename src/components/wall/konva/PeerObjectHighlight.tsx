"use client";

import { Group, Label, Rect, Tag, Text } from "react-konva";
import type { WallPresenceState } from "@/types/wall-scene-v2";

interface PeerObjectHighlightProps {
  peers: WallPresenceState[];
  width: number;
  height: number;
}

/** Figma-style colored frame + name tag for remote collaborators. */
export default function PeerObjectHighlight({ peers, width, height }: PeerObjectHighlightProps) {
  if (peers.length === 0) return null;

  const pad = 3;
  const stack = 4;

  return (
    <>
      {peers.map((peer, index) => {
        const inset = index * stack;
        const labelY = -26 - index * 18;

        return (
          <Group key={peer.userId} listening={false}>
            <Rect
              x={-pad - inset}
              y={-pad - inset}
              width={width + (pad + inset) * 2}
              height={height + (pad + inset) * 2}
              stroke={peer.color}
              strokeWidth={2.5}
              cornerRadius={3}
              listening={false}
            />
            <Label x={-pad - inset} y={labelY} listening={false}>
              <Tag
                fill={peer.color}
                cornerRadius={5}
                pointerDirection="down"
                pointerWidth={8}
                pointerHeight={5}
                lineJoin="round"
              />
              <Text
                text={peer.displayName}
                fontSize={11}
                fontStyle="600"
                fill="#ffffff"
                padding={5}
              />
            </Label>
          </Group>
        );
      })}
    </>
  );
}
