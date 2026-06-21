"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { throttle } from "@/lib/throttle";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { registerWallNode, setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { useResolvedImageSrc } from "./useResolvedImageSrc";

interface WallPhotoNodeProps {
  object: WallScenePhoto;
  readOnly?: boolean;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onSelect: () => void;
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
  const [image, setImage] = useState<HTMLImageElement | null>(null);
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
      const patch = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      };
      useWallSceneStore.getState().patchObject(objectId, patch);
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

  useEffect(() => {
    if (!displaySrc) {
      setImage(null);
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
      onClick={beginInteraction}
      onTap={beginInteraction}
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
