"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text as KonvaText } from "react-konva";
import type Konva from "konva";
import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
import { createLivePatchBroadcaster } from "@/lib/wall-scene/realtime/live-object-patch";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import type { PhotoCropRect, PhotoDecoration, WallScenePhoto } from "@/types/wall-scene-v2";
import { registerWallNode, setWallNodeDragging } from "@/lib/wall-scene/realtime/wall-node-sync";
import { wrapKonvaNode } from "@/lib/wall-scene/realtime/wrap-konva-node";
import { applyDragSnapToNode, beginDragSnap, clearDragSnapGuides } from "@/lib/wall-scene/drag-snap";
import {
  applyGroupDrag,
  beginGroupDrag,
  commitGroupDrag,
} from "@/lib/wall-scene/group-drag";
import { useResolvedImageSrc } from "./useResolvedImageSrc";
import { useNodeContextTrigger } from "./useNodeContextTrigger";
import { ensureStickersForIds, getStickerById } from "@/lib/stickers";
import {
  computeSlice9Rects,
  filmSprocketRects,
  getDecorationLocalBox,
  getPhotoFrame,
  getPhotoFrameInset,
  getPhotoFrameOuterSize,
} from "@/lib/photo-frames";

interface WallPhotoNodeProps {
  object: WallScenePhoto;
  readOnly?: boolean;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onSelect: (additive?: boolean) => void;
  onInteractionStart?: () => void;
  onObjectPatch?: (id: string, patch: WallObjectPatch) => void;
  onManipulationChange?: (active: boolean, objectId: string) => void;
  onCropRequest?: (objectId: string) => void;
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
  onCropRequest,
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
      registerWallNode(objectId, node ? wrapKonvaNode(node) : null);
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
    beginDragSnap(objectId);
    beginGroupDrag(objectId);
    setWallNodeDragging(objectId, true);
    onInteractionStart?.();
    onManipulationChange?.(true, objectId);
  }, [onInteractionStart, onManipulationChange, objectId, cancelLongPress]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      applyDragSnapToNode(wrapKonvaNode(node), objectId);
      applyGroupDrag(wrapKonvaNode(node), e.evt);
      broadcastLivePosition(objectId, { x: node.x(), y: node.y() });
    },
    [broadcastLivePosition, objectId],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      clearDragSnapGuides();
      broadcastLivePosition.flush();
      commitGroupDrag(wrapKonvaNode(e.target));
      isDraggingRef.current = false;
      setWallNodeDragging(objectId, false);
      onManipulationChange?.(false, objectId);
    },
    [broadcastLivePosition, onManipulationChange, objectId],
  );

  const requestCrop = useCallback(() => {
    if (readOnly) return;
    onSelect(false);
    onInteractionStart?.();
    onCropRequest?.(objectId);
  }, [objectId, onCropRequest, onInteractionStart, onSelect, readOnly]);

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

  const konvaCrop = useMemo((): PhotoCropRect | undefined => {
    if (!shownImage || !object.crop) return undefined;
    return {
      x: object.crop.x,
      y: object.crop.y,
      width: object.crop.width,
      height: object.crop.height,
    };
  }, [object.crop, shownImage]);

  const frame = getPhotoFrame(object.frameId);
  const inset = getPhotoFrameInset(object);
  const outer = getPhotoFrameOuterSize(object);
  const sprockets = frame?.id === "frame.film" ? filmSprocketRects(object, inset) : [];

  const [stickerEpoch, setStickerEpoch] = useState(0);

  useEffect(() => {
    const ids = (object.decorations ?? []).map((item) => item.stickerId);
    if (!ids.length) return;
    let cancelled = false;
    void ensureStickersForIds(ids).then(() => {
      if (!cancelled) setStickerEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [object.decorations]);

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
        cancelLongPress();
        requestCrop();
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        cancelLongPress();
        requestCrop();
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
      {frame && (inset.left || inset.top || inset.right || inset.bottom) ? (
        <Rect
          x={outer.offsetX}
          y={outer.offsetY}
          width={outer.width}
          height={outer.height}
          fill={frame.matteFill ?? "#ffffff"}
          listening
        />
      ) : null}
      {sprockets.map((hole, index) => (
        <Rect
          key={`sprocket-${index}`}
          x={hole.x}
          y={hole.y}
          width={hole.width}
          height={hole.height}
          fill="#d4d4d4"
          listening={false}
        />
      ))}
      {shownImage ? (
        <KonvaImage
          image={shownImage}
          width={object.width}
          height={object.height}
          crop={konvaCrop}
          imageSmoothingEnabled
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ) : null}
      {frame?.kind === "slice9" && frame.src && frame.slice9 ? (
        <PhotoSlice9Overlay src={frame.src} outer={outer} slice={frame.slice9} />
      ) : null}
      {(object.decorations ?? []).map((deco) => (
        <PhotoCornerNode
          key={`${deco.slot}-${deco.stickerId}-${stickerEpoch}`}
          photo={object}
          deco={deco}
        />
      ))}
    </Group>
  );
}

function useHtmlImage(src: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(() =>
    src ? getCachedHtmlImage(src) : null,
  );
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const cached = getCachedHtmlImage(src);
    if (cached) {
      setImage(cached);
      return;
    }
    let cancelled = false;
    void loadHtmlImage(src)
      .then((img) => {
        if (!cancelled) setImage(img);
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return image;
}

function PhotoSlice9Overlay({
  src,
  outer,
  slice,
}: {
  src: string;
  outer: { offsetX: number; offsetY: number; width: number; height: number };
  slice: { top: number; right: number; bottom: number; left: number };
}) {
  const image = useHtmlImage(src);
  const rects = useMemo(() => {
    if (!image) return [];
    return computeSlice9Rects(image.naturalWidth, image.naturalHeight, outer, slice);
  }, [image, outer, slice]);
  if (!image) return null;
  return (
    <>
      {rects.map((rect, index) => (
        <KonvaImage
          key={index}
          image={image}
          x={rect.dx}
          y={rect.dy}
          width={rect.dw}
          height={rect.dh}
          crop={{ x: rect.sx, y: rect.sy, width: rect.sw, height: rect.sh }}
          listening
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
}

function PhotoCornerNode({
  photo,
  deco,
}: {
  photo: WallScenePhoto;
  deco: PhotoDecoration;
}) {
  const def = getStickerById(deco.stickerId);
  const box = getDecorationLocalBox(photo, deco);
  const image = useHtmlImage(def && def.kind !== "emoji" ? def.src : undefined);
  if (!box) return null;
  if (def?.kind === "emoji") {
    return (
      <KonvaText
        text={def.src}
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fontSize={Math.min(box.width, box.height)}
        listening
      />
    );
  }
  if (!image) return null;
  return (
    <KonvaImage
      image={image}
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      listening
      perfectDrawEnabled={false}
    />
  );
}
