"use client";

import { Rect } from "react-konva";
import {
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE_WIDTH,
  linePointsToHighlighterRect,
} from "@/lib/wall-scene/highlighter";

interface WallHighlighterRectProps {
  points: number[];
  fill: string;
  height?: number;
  opacity?: number;
  listening?: boolean;
  onSelect?: () => void;
}

export default function WallHighlighterRect({
  points,
  fill,
  height = HIGHLIGHTER_STROKE_WIDTH,
  opacity = HIGHLIGHTER_OPACITY,
  listening = false,
  onSelect,
}: WallHighlighterRectProps) {
  const layout = linePointsToHighlighterRect(points, height);
  if (!layout) return null;

  return (
    <Rect
      x={layout.x}
      y={layout.y}
      width={layout.width}
      height={layout.height}
      offsetY={layout.height / 2}
      rotation={layout.rotation}
      fill={fill}
      opacity={opacity}
      listening={listening}
      onClick={onSelect}
      onTap={onSelect}
      perfectDrawEnabled={false}
    />
  );
}
