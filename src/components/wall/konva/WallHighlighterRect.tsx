"use client";

import type Konva from "konva";
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
  onSelect?: (additive?: boolean) => void;
  onContextMenu?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
  onPointerDown?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
  onPointerMove?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
  onPointerUp?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
}

export default function WallHighlighterRect({
  points,
  fill,
  height = HIGHLIGHTER_STROKE_WIDTH,
  opacity = HIGHLIGHTER_OPACITY,
  listening = false,
  onSelect,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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
      onContextMenu={onContextMenu}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onPointerDown?.(e);
        onSelect?.(e.evt.shiftKey);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        onPointerDown?.(e);
        onSelect?.(false);
      }}
      onMouseMove={onPointerMove}
      onTouchMove={onPointerMove}
      onMouseUp={onPointerUp}
      onTouchEnd={onPointerUp}
      perfectDrawEnabled={false}
    />
  );
}
