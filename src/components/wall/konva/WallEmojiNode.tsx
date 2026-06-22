"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Group, Text } from "react-konva";
import type Konva from "konva";
import { throttle } from "@/lib/throttle";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { registerWallNode, setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneEmoji } from "@/types/wall-scene-v2";

interface WallEmojiNodeProps {
  object: WallSceneEmoji;
  readOnly?: boolean;
  onSelect: () => void;
  onInteractionStart?: () => void;
  onManipulationChange?: (active: boolean, objectId: string) => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

function applyTransformToNode(node: Konva.Group, object: WallSceneEmoji) {
  node.position({ x: object.x, y: object.y });
  node.rotation(object.rotation);
  node.scaleX(object.scaleX);
  node.scaleY(object.scaleY);
}

export default function WallEmojiNode({
  object,
  readOnly = false,
  onSelect,
  onInteractionStart,
  onManipulationChange,
  registerNode,
}: WallEmojiNodeProps) {
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

  const applyPosition = useMemo(
    () =>
      throttle((id: string, x: number, y: number) => {
        const patch = { x, y };
        useWallSceneStore.getState().patchObject(id, patch);
        broadcastWallPatch(id, patch);
      }, 50),
    [],
  );

  const commitDragPosition = useCallback(
    (node: Konva.Node) => {
      applyPosition.flush();
      const patch: WallObjectPatch = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      };
      useWallSceneStore.getState().patchObject(objectId, patch);
      useWallSceneStore.getState().recordHistory();
      broadcastWallPatch(objectId, patch);
    },
    [applyPosition, objectId],
  );

  const beginInteraction = useCallback(() => {
    onSelect();
    onInteractionStart?.();
  }, [onSelect, onInteractionStart]);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    setWallNodeDragging(objectId, true);
    beginInteraction();
    onManipulationChange?.(true, objectId);
  }, [beginInteraction, onManipulationChange, objectId]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      applyPosition(objectId, node.x(), node.y());
    },
    [applyPosition, objectId],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      commitDragPosition(e.target);
      isDraggingRef.current = false;
      setWallNodeDragging(objectId, false);
      onManipulationChange?.(false, objectId);
    },
    [commitDragPosition, onManipulationChange, objectId],
  );

  useLayoutEffect(() => {
    const node = groupRef.current;
    if (!node || isDraggingRef.current) return;
    applyTransformToNode(node, object);
    node.getLayer()?.batchDraw();
  }, [object.x, object.y, object.rotation, object.scaleX, object.scaleY]);

  const size = object.fontSize * Math.max(object.scaleX, object.scaleY);

  return (
    <Group
      ref={attachGroupRef}
      id={objectId}
      opacity={object.opacity ?? 1}
      draggable={!readOnly}
      onClick={beginInteraction}
      onTap={beginInteraction}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <Text text={object.text} fontSize={object.fontSize} width={size} height={size} />
    </Group>
  );
}
