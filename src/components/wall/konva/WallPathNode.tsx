"use client";

import { useCallback } from "react";
import { Group, Line, Rect } from "react-konva";
import type Konva from "konva";
import type { WallScenePath } from "@/types/wall-scene-v2";
import {
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE_WIDTH,
  isStraightHighlighterPath,
  linePointsToHighlighterRect,
} from "@/lib/wall-scene/highlighter";
import WallHighlighterRect from "./WallHighlighterRect";

interface WallPathNodeProps {
  object: WallScenePath;
  readOnly?: boolean;
  selected?: boolean;
  onSelect: () => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

export default function WallPathNode({
  object,
  readOnly = false,
  selected = false,
  onSelect,
  registerNode,
}: WallPathNodeProps) {
  const objectId = object.id;

  const attachGroupRef = useCallback(
    (node: Konva.Group | null) => {
      registerNode(objectId, node);
    },
    [objectId, registerNode],
  );

  const handleSelect = useCallback(() => {
    if (readOnly) return;
    onSelect();
  }, [readOnly, onSelect]);

  const isHighlighter = isStraightHighlighterPath(object.points);
  const strokeWidth = isHighlighter ? object.strokeWidth || HIGHLIGHTER_STROKE_WIDTH : object.strokeWidth;
  const opacity = object.opacity ?? (isHighlighter ? HIGHLIGHTER_OPACITY : 1);
  const selectionLayout = isHighlighter ? linePointsToHighlighterRect(object.points, strokeWidth + 6) : null;

  return (
    <Group ref={attachGroupRef} id={objectId} x={object.x} y={object.y}>
      {isHighlighter ? (
        <WallHighlighterRect
          points={object.points}
          fill={object.stroke}
          height={strokeWidth}
          opacity={opacity}
          listening={!readOnly}
          onSelect={handleSelect}
        />
      ) : (
        <Line
          points={object.points}
          stroke={object.stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="butt"
          lineJoin="miter"
          hitStrokeWidth={Math.max(24, strokeWidth + 10)}
          listening={!readOnly}
          onClick={handleSelect}
          onTap={handleSelect}
          shadowForStrokeEnabled={false}
          perfectDrawEnabled={false}
        />
      )}
      {selected && isHighlighter && selectionLayout && (
        <Rect
          x={selectionLayout.x}
          y={selectionLayout.y}
          width={selectionLayout.width}
          height={selectionLayout.height}
          offsetY={selectionLayout.height / 2}
          rotation={selectionLayout.rotation}
          fill="#4a90d9"
          opacity={0.28}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {selected && !isHighlighter && (
        <Line
          points={object.points}
          stroke="#4a90d9"
          strokeWidth={strokeWidth + 4}
          opacity={0.35}
          lineCap="butt"
          lineJoin="miter"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}
