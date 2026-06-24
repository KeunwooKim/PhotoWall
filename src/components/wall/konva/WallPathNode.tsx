"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type Konva from "konva";
import { Group, Line, Rect } from "react-konva";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import { registerWallNode, setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { applyDragSnapToNode, clearDragSnapGuides } from "@/lib/wall-scene/drag-snap";
import {
  applyGroupDrag,
  beginGroupDrag,
  commitGroupDrag,
} from "@/lib/wall-scene/group-drag";
import type { WallScenePath } from "@/types/wall-scene-v2";
import {
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE_WIDTH,
  isStraightHighlighterPath,
  linePointsToHighlighterRect,
} from "@/lib/wall-scene/highlighter";
import WallHighlighterRect from "./WallHighlighterRect";
import { useNodeContextTrigger } from "./useNodeContextTrigger";

interface WallPathNodeProps {
  object: WallScenePath;
  readOnly?: boolean;
  selected?: boolean;
  onSelect: (additive?: boolean) => void;
  onInteractionStart?: () => void;
  onManipulationChange?: (active: boolean, objectId: string) => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

export default function WallPathNode({
  object,
  readOnly = false,
  selected = false,
  onSelect,
  onInteractionStart,
  onManipulationChange,
  registerNode,
}: WallPathNodeProps) {
  const objectId = object.id;
  const groupRef = useRef<Konva.Group | null>(null);
  const isDraggingRef = useRef(false);

  const attachGroupRef = useCallback(
    (node: Konva.Group | null) => {
      groupRef.current = node;
      registerNode(objectId, node);
      registerWallNode(objectId, node);
    },
    [objectId, registerNode],
  );

  const broadcastLivePosition = useMemo(() => createLivePatchBroadcaster(), []);

  const handleSelect = useCallback(
    (additive = false) => {
      if (readOnly) return;
      onSelect(additive);
    },
    [readOnly, onSelect],
  );

  const beginInteraction = useCallback(
    (additive = false) => {
      handleSelect(additive);
      onInteractionStart?.();
    },
    [handleSelect, onInteractionStart],
  );

  const isHighlighter = isStraightHighlighterPath(object.points);
  const strokeWidth = isHighlighter ? object.strokeWidth || HIGHLIGHTER_STROKE_WIDTH : object.strokeWidth;
  const opacity = object.opacity ?? (isHighlighter ? HIGHLIGHTER_OPACITY : 1);
  const selectionLayout = isHighlighter ? linePointsToHighlighterRect(object.points, strokeWidth + 6) : null;
  const hitLayout = isHighlighter ? linePointsToHighlighterRect(object.points, strokeWidth + 28) : null;

  const contextEnabled = !readOnly;
  const {
    handlePointerDown: handleContextPointerDown,
    handlePointerMove: handleContextPointerMove,
    handlePointerUp: handleContextPointerUp,
    handleContextMenu,
    cancelLongPress,
  } = useNodeContextTrigger(objectId, contextEnabled);

  const handlePointerDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>, additive: boolean) => {
      event.cancelBubble = true;
      handleContextPointerDown(event);
      beginInteraction(additive);
    },
    [beginInteraction, handleContextPointerDown],
  );

  const handleDragStart = useCallback(() => {
    if (!isHighlighter) return;
    cancelLongPress();
    isDraggingRef.current = true;
    beginInteraction(false);
    beginGroupDrag(objectId);
    setWallNodeDragging(objectId, true);
    onManipulationChange?.(true, objectId);
  }, [beginInteraction, cancelLongPress, isHighlighter, objectId, onManipulationChange]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!isHighlighter) return;
      const node = e.target;
      applyDragSnapToNode(node, objectId);
      applyGroupDrag(node);
      broadcastLivePosition(objectId, { x: node.x(), y: node.y() });
    },
    [broadcastLivePosition, isHighlighter, objectId],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!isHighlighter) return;
      clearDragSnapGuides();
      broadcastLivePosition.flush();
      commitGroupDrag(e.target);
      isDraggingRef.current = false;
      setWallNodeDragging(objectId, false);
      onManipulationChange?.(false, objectId);
    },
    [broadcastLivePosition, isHighlighter, objectId, onManipulationChange],
  );

  useLayoutEffect(() => {
    const node = groupRef.current;
    if (!node || isDraggingRef.current) return;
    node.position({ x: object.x, y: object.y });
    node.getLayer()?.batchDraw();
  }, [object.x, object.y]);

  return (
    <Group
      ref={attachGroupRef}
      id={objectId}
      x={object.x}
      y={object.y}
      draggable={isHighlighter && !readOnly}
      listening={isHighlighter ? contextEnabled : false}
      onContextMenu={isHighlighter ? handleContextMenu : undefined}
      onMouseDown={
        isHighlighter
          ? (e) => {
              e.cancelBubble = true;
              handleContextPointerDown(e);
              beginInteraction(e.evt.shiftKey);
            }
          : undefined
      }
      onTouchStart={
        isHighlighter
          ? (e) => {
              e.cancelBubble = true;
              handleContextPointerDown(e);
              beginInteraction(false);
            }
          : undefined
      }
      onMouseMove={isHighlighter ? handleContextPointerMove : undefined}
      onTouchMove={isHighlighter ? handleContextPointerMove : undefined}
      onMouseUp={isHighlighter ? handleContextPointerUp : undefined}
      onTouchEnd={isHighlighter ? handleContextPointerUp : undefined}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {isHighlighter ? (
        <>
          <WallHighlighterRect
            points={object.points}
            fill={object.stroke}
            height={strokeWidth}
            opacity={opacity}
            listening={false}
          />
          {hitLayout && (
            <Rect
              x={hitLayout.x}
              y={hitLayout.y}
              width={hitLayout.width}
              height={hitLayout.height}
              offsetY={hitLayout.height / 2}
              rotation={hitLayout.rotation}
              fill="rgba(0,0,0,0.001)"
              listening={contextEnabled}
              perfectDrawEnabled={false}
            />
          )}
        </>
      ) : (
        <Line
          points={object.points}
          stroke={object.stroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="butt"
          lineJoin="miter"
          hitStrokeWidth={Math.max(24, strokeWidth + 10)}
          listening={contextEnabled}
          onContextMenu={handleContextMenu}
          onMouseDown={(e) => handlePointerDown(e, e.evt.shiftKey)}
          onTouchStart={(e) => handlePointerDown(e, false)}
          onMouseMove={handleContextPointerMove}
          onTouchMove={handleContextPointerMove}
          onMouseUp={handleContextPointerUp}
          onTouchEnd={handleContextPointerUp}
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
