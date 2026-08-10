"use client";

import { Group, Label, Rect, Tag, Text } from "react-konva";
import type { WallPresenceState } from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { selectionStrokeWallPx } from "@/lib/wall-scene/selection-chrome";

interface PeerObjectHighlightProps {
  peers: WallPresenceState[];
  width: number;
  height: number;
  /** Object scale — chrome stays constant in wall pixels. */
  scaleX?: number;
  scaleY?: number;
}

const PAD_PX = 3;
const STACK_PX = 4;
const LABEL_OFFSET_PX = 26;
const LABEL_STACK_PX = 18;
const CORNER_RADIUS_PX = 3;
const FONT_SIZE = 11;

/** Figma-style colored frame + name tag for remote collaborators. */
export default function PeerObjectHighlight({
  peers,
  width,
  height,
  scaleX = 1,
  scaleY = 1,
}: PeerObjectHighlightProps) {
  const viewportScale = useWallSceneStore((s) => s.viewportScale);
  const strokeWidth = selectionStrokeWallPx(viewportScale);

  if (peers.length === 0) return null;

  const sx = Math.abs(scaleX) || 1;
  const sy = Math.abs(scaleY) || 1;
  const padX = PAD_PX / sx;
  const padY = PAD_PX / sy;
  const stackX = STACK_PX / sx;
  const stackY = STACK_PX / sy;
  const cornerRadius = CORNER_RADIUS_PX / Math.min(sx, sy);

  return (
    <>
      {peers.map((peer, index) => {
        const insetX = index * stackX;
        const insetY = index * stackY;
        const labelY = -LABEL_OFFSET_PX / sy - index * (LABEL_STACK_PX / sy);

        return (
          <Group key={peer.userId} listening={false}>
            <Rect
              x={-padX - insetX}
              y={-padY - insetY}
              width={width + (padX + insetX) * 2}
              height={height + (padY + insetY) * 2}
              stroke={peer.color}
              strokeWidth={strokeWidth}
              strokeScaleEnabled={false}
              cornerRadius={cornerRadius}
              listening={false}
            />
            <Label
              x={-padX - insetX}
              y={labelY}
              scaleX={1 / sx}
              scaleY={1 / sy}
              listening={false}
            >
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
                fontSize={FONT_SIZE}
                fontStyle="600"
                fill="#3f3f46"
                padding={5}
              />
            </Label>
          </Group>
        );
      })}
    </>
  );
}
