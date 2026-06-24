"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Text } from "react-konva";
import type Konva from "konva";
import { getStickerById } from "@/lib/stickers";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import { registerWallNode, setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { applyDragSnapToNode, clearDragSnapGuides } from "@/lib/wall-scene/drag-snap";
import {
  applyGroupDrag,
  beginGroupDrag,
  commitGroupDrag,
} from "@/lib/wall-scene/group-drag";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneSticker } from "@/types/wall-scene-v2";
import { useNodeContextTrigger } from "./useNodeContextTrigger";

interface WallStickerNodeProps {
  object: WallSceneSticker;
  readOnly?: boolean;
  onSelect: (additive?: boolean) => void;
  onInteractionStart?: () => void;
  onManipulationChange?: (active: boolean, objectId: string) => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

function applyTransformToNode(node: Konva.Group, object: WallSceneSticker) {
  node.position({ x: object.x, y: object.y });
  node.rotation(object.rotation);
  node.scaleX(object.scaleX);
  node.scaleY(object.scaleY);
}

export default function WallStickerNode({
  object,
  readOnly = false,
  onSelect,
  onInteractionStart,
  onManipulationChange,
  registerNode,
}: WallStickerNodeProps) {
  const definition = getStickerById(object.stickerId);
  const isEmoji = definition?.kind === "emoji";
  const imageSrc = !isEmoji && definition ? definition.src : "";

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

  const contextEnabled = !readOnly;
  const {
    handlePointerDown: handleContextPointerDown,
    handlePointerMove: handleContextPointerMove,
    handlePointerUp: handleContextPointerUp,
    handleContextMenu,
    cancelLongPress,
  } = useNodeContextTrigger(objectId, contextEnabled);

  const handleDragStart = useCallback(() => {
    cancelLongPress();
    isDraggingRef.current = true;
    beginGroupDrag(objectId);
    setWallNodeDragging(objectId, true);
    onInteractionStart?.();
    onManipulationChange?.(true, objectId);
  }, [onInteractionStart, onManipulationChange, objectId, cancelLongPress]);

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

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  // useResolvedImageSrc returns string; load image in effect
  useLayoutEffect(() => {
    if (!imageSrc || isEmoji) {
      setImage(null);
      return;
    }
    let cancelled = false;
    void loadHtmlImage(imageSrc)
      .then((img) => {
        if (!cancelled) setImage(img);
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc, isEmoji]);

  return (
    <Group
      ref={attachGroupRef}
      id={objectId}
      opacity={object.opacity ?? 1}
      draggable={!readOnly}
      listening
      onContextMenu={handleContextMenu}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        handleContextPointerDown(e);
        beginInteraction(e.evt.shiftKey);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        handleContextPointerDown(e);
        beginInteraction(false);
      }}
      onMouseMove={handleContextPointerMove}
      onTouchMove={handleContextPointerMove}
      onMouseUp={handleContextPointerUp}
      onTouchEnd={handleContextPointerUp}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {isEmoji && definition ? (
        <Text
          text={definition.src}
          fontSize={object.height}
          width={object.width}
          height={object.height}
          align="center"
          verticalAlign="middle"
        />
      ) : image ? (
        <KonvaImage
          image={image}
          width={object.width}
          height={object.height}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ) : null}
    </Group>
  );
}
