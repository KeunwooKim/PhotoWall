"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Group, Text } from "react-konva";
import type Konva from "konva";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import { registerWallNode, setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { applyDragSnapToNode, clearDragSnapGuides } from "@/lib/wall-scene/drag-snap";
import {
  applyGroupDrag,
  beginGroupDrag,
  commitGroupDrag,
} from "@/lib/wall-scene/group-drag";
import type { WallSceneText } from "@/types/wall-scene-v2";
import { useNodeContextTrigger } from "./useNodeContextTrigger";

interface WallTextNodeProps {
  object: WallSceneText;
  readOnly?: boolean;
  onSelect: (additive?: boolean) => void;
  onInteractionStart?: () => void;
  onManipulationChange?: (active: boolean, objectId: string) => void;
  onEditRequest?: (objectId: string) => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

function applyTransformToNode(node: Konva.Group, object: WallSceneText) {
  node.position({ x: object.x, y: object.y });
  node.rotation(object.rotation);
  node.scaleX(object.scaleX);
  node.scaleY(object.scaleY);
}

export default function WallTextNode({
  object,
  readOnly = false,
  onSelect,
  onInteractionStart,
  onManipulationChange,
  onEditRequest,
  registerNode,
}: WallTextNodeProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const isDraggingRef = useRef(false);
  const objectId = object.id;

  const attachGroupRef = useCallback(
    (node: Konva.Group | null) => {
      groupRef.current = node;
      registerNode(objectId, node);
      registerWallNode(objectId, node);
    },
    [objectId, registerNode],
  );

  const broadcastLivePosition = useMemo(() => createLivePatchBroadcaster(), []);

  const beginInteraction = useCallback(
    (additive = false) => {
      onSelect(additive);
      onInteractionStart?.();
    },
    [onSelect, onInteractionStart],
  );

  const requestEdit = useCallback(() => {
    if (readOnly) return;
    onSelect(false);
    onInteractionStart?.();
    onEditRequest?.(objectId);
  }, [objectId, onEditRequest, onInteractionStart, onSelect, readOnly]);

  // Long-press (touch) + right-click → context menu (same as other objects)
  const {
    handlePointerDown: handleContextPointerDown,
    handlePointerMove: handleContextPointerMove,
    handlePointerUp: handleContextPointerUp,
    handleContextMenu,
    cancelLongPress,
  } = useNodeContextTrigger(objectId, !readOnly);

  const handleDragStart = useCallback(() => {
    cancelLongPress();
    isDraggingRef.current = true;
    beginGroupDrag(objectId);
    setWallNodeDragging(objectId, true);
    onInteractionStart?.();
    onManipulationChange?.(true, objectId);
  }, [cancelLongPress, objectId, onInteractionStart, onManipulationChange]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      applyDragSnapToNode(node, objectId);
      applyGroupDrag(node);
      broadcastLivePosition(objectId, { x: node.x(), y: node.y() });
    },
    [broadcastLivePosition, objectId],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      clearDragSnapGuides();
      broadcastLivePosition.flush();
      commitGroupDrag(e.target);
      isDraggingRef.current = false;
      setWallNodeDragging(objectId, false);
      onManipulationChange?.(false, objectId);
    },
    [broadcastLivePosition, onManipulationChange, objectId],
  );

  useLayoutEffect(() => {
    const node = groupRef.current;
    if (!node || isDraggingRef.current) return;
    applyTransformToNode(node, object);
    node.getLayer()?.batchDraw();
  }, [object.x, object.y, object.rotation, object.scaleX, object.scaleY]);

  return (
    <Group
      ref={attachGroupRef}
      id={objectId}
      opacity={object.opacity ?? 1}
      draggable={!readOnly}
      listening
      onContextMenu={handleContextMenu}
      onDblClick={(e) => {
        e.cancelBubble = true;
        requestEdit();
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        requestEdit();
      }}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        handleContextPointerDown(e);
        if (!readOnly) beginInteraction(e.evt.shiftKey);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        handleContextPointerDown(e);
        if (!readOnly) beginInteraction(false);
      }}
      onMouseMove={handleContextPointerMove}
      onTouchMove={handleContextPointerMove}
      onMouseUp={handleContextPointerUp}
      onTouchEnd={handleContextPointerUp}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <Text
        text={object.text}
        fontSize={object.fontSize}
        fontFamily={object.fontFamily}
        fontStyle={object.fontWeight === "bold" ? "bold" : "normal"}
        align={object.textAlign ?? "left"}
        fill={object.fill}
        width={object.width}
        wrap="word"
      />
    </Group>
  );
}
