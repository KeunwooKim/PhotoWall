"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { registerWallNode, setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { applyDragSnapToNode, clearDragSnapGuides } from "@/lib/wall-scene/drag-snap";
import {
  applyGroupDrag,
  beginGroupDrag,
  commitGroupDrag,
} from "@/lib/wall-scene/group-drag";
import { useResolvedImageSrc } from "./useResolvedImageSrc";
import { useNodeContextTrigger } from "./useNodeContextTrigger";

interface WallPhotoNodeProps {
  object: WallScenePhoto;
  readOnly?: boolean;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onSelect: (additive?: boolean) => void;
  onInteractionStart?: () => void;
  onObjectPatch?: (id: string, patch: WallObjectPatch) => void;
  onManipulationChange?: (active: boolean, objectId: string) => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

function applyTransformToNode(node: Konva.Group, object: WallScenePhoto) {
  node.position({ x: object.x, y: object.y });
  node.rotation(object.rotation);
  node.scaleX(object.scaleX);
  node.scaleY(object.scaleY);
}

export default function WallPhotoNode({
  object,
  readOnly = false,
  resolvePhotoSrc,
  onSelect,
  onInteractionStart,
  onManipulationChange,
  registerNode,
}: WallPhotoNodeProps) {
  const displaySrc = useResolvedImageSrc(object.src, resolvePhotoSrc);
  const [image, setImage] = useState<HTMLImageElement | null>(() => {
    if (!displaySrc) return null;
    return getCachedHtmlImage(displaySrc);
  });
  const imageCacheRef = useRef<HTMLImageElement | null>(null);
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

  useEffect(() => {
    if (!displaySrc) {
      setImage(null);
      return;
    }

    const cached = getCachedHtmlImage(displaySrc);
    if (cached) {
      imageCacheRef.current = cached;
      setImage(cached);
      return;
    }

    let cancelled = false;

    void loadHtmlImage(displaySrc)
      .then((img) => {
        if (cancelled) return;
        imageCacheRef.current = img;
        setImage(img);
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [displaySrc]);

  const shownImage = image ?? imageCacheRef.current;

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
      {shownImage ? (
        <KonvaImage
          image={shownImage}
          width={object.width}
          height={object.height}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ) : null}
    </Group>
  );
}
