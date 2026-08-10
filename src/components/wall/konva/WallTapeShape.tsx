"use client";

import type Konva from "konva";
import { Circle, Group, Line } from "react-konva";
import {
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE_WIDTH,
} from "@/lib/wall-scene/highlighter";
import { buildTapePatternDrawList, buildTapePolygon } from "@/lib/wall-scene/tape-geometry";
import {
  DEFAULT_TAPE_END_STYLE,
  DEFAULT_TAPE_PATTERN,
  type TapeEndStyle,
  type TapePatternId,
} from "@/lib/wall-scene/tape-style";

interface WallTapeShapeProps {
  points: number[];
  fill: string;
  height?: number;
  opacity?: number;
  endStyle?: TapeEndStyle;
  pattern?: TapePatternId;
  patternAccent?: string;
  listening?: boolean;
  onSelect?: (additive?: boolean) => void;
  onContextMenu?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
  onPointerDown?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
  onPointerMove?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
  onPointerUp?: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) => void;
}

/** Vector masking-tape strip with end-cap + pattern support. */
export default function WallTapeShape({
  points,
  fill,
  height = HIGHLIGHTER_STROKE_WIDTH,
  opacity = HIGHLIGHTER_OPACITY,
  endStyle = DEFAULT_TAPE_END_STYLE,
  pattern = DEFAULT_TAPE_PATTERN,
  patternAccent = "#ffffff",
  listening = false,
  onSelect,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: WallTapeShapeProps) {
  if (points.length < 4) return null;
  const x1 = points[0];
  const y1 = points[1];
  const x2 = points[2];
  const y2 = points[3];
  const polygon = buildTapePolygon(x1, y1, x2, y2, height, endStyle);
  if (!polygon || polygon.length < 6) return null;

  const decor = buildTapePatternDrawList(x1, y1, x2, y2, height, pattern);
  const bindSelect =
    listening || onSelect || onContextMenu || onPointerDown
      ? {
          listening: true as const,
          onContextMenu,
          onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true;
            onPointerDown?.(e);
            onSelect?.(e.evt.shiftKey);
          },
          onTouchStart: (e: Konva.KonvaEventObject<TouchEvent>) => {
            e.cancelBubble = true;
            onPointerDown?.(e);
            onSelect?.(false);
          },
          onMouseMove: onPointerMove,
          onTouchMove: onPointerMove,
          onMouseUp: onPointerUp,
          onTouchEnd: onPointerUp,
        }
      : { listening: false as const };

  return (
    <Group
      opacity={opacity}
      listening={listening}
      clipFunc={(ctx) => {
        ctx.beginPath();
        ctx.moveTo(polygon[0], polygon[1]);
        for (let i = 2; i < polygon.length; i += 2) {
          ctx.lineTo(polygon[i], polygon[i + 1]);
        }
        ctx.closePath();
      }}
    >
      <Line
        points={polygon}
        closed
        fill={fill}
        strokeEnabled={false}
        perfectDrawEnabled={false}
        {...bindSelect}
      />
      {decor.strokes.map((s, i) => (
        <Line
          key={`s-${i}`}
          points={[s.x1, s.y1, s.x2, s.y2]}
          stroke={patternAccent}
          strokeWidth={s.width}
          opacity={0.85}
          lineCap="round"
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
      {decor.dots.map((d, i) => (
        <Circle
          key={`d-${i}`}
          x={d.x}
          y={d.y}
          radius={d.r}
          fill={patternAccent}
          opacity={0.9}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  );
}
