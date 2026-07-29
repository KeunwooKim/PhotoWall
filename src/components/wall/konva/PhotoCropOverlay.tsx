"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Rect, Transformer } from "react-konva";
import Konva from "konva";
import type KonvaType from "konva";
import {
  clampCropInBounds,
  cropRecoveryLayout,
  displayCropToSource,
  initialCropDisplay,
  largestAspectCropInRecovery,
  recoveryCropBounds,
  type CropAspectPresetId,
  CROP_ASPECT_PRESETS,
} from "@/lib/wall-scene/photo-crop";
import type { PhotoCropRect, WallScenePhoto } from "@/types/wall-scene-v2";

interface PhotoCropOverlayProps {
  photo: WallScenePhoto;
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  aspectPreset: CropAspectPresetId;
  onDraftChange?: (
    crop: PhotoCropRect,
    display: { x: number; y: number; width: number; height: number },
  ) => void;
}

const MIN_CROP = 24;

type DisplayCrop = { x: number; y: number; width: number; height: number };

function stopPointerBubble(e: KonvaType.KonvaEventObject<MouseEvent | TouchEvent>) {
  e.cancelBubble = true;
}

function readCropFromNode(node: Konva.Rect): DisplayCrop {
  return {
    x: node.x(),
    y: node.y(),
    width: Math.max(MIN_CROP, Math.abs(node.width() * node.scaleX())),
    height: Math.max(MIN_CROP, Math.abs(node.height() * node.scaleY())),
  };
}

function applyCropToNode(node: Konva.Rect, crop: DisplayCrop) {
  node.scaleX(1);
  node.scaleY(1);
  node.position({ x: crop.x, y: crop.y });
  node.width(crop.width);
  node.height(crop.height);
}

type CropHandleProps = {
  photoId: string;
  initialCrop: DisplayCrop;
  cropBounds: DisplayCrop;
  keepRatio: boolean;
  onCommit: (crop: DisplayCrop) => void;
  onLiveChange: (crop: DisplayCrop) => void;
  cropRectRef: React.RefObject<Konva.Rect | null>;
  clipFuncRef: React.RefObject<((ctx: KonvaType.Context) => void) | null>;
};

/** Isolated from parent re-renders so Konva transform state is never reset mid-gesture. */
const CropHandle = memo(
  function CropHandle({
    photoId,
    initialCrop,
    cropBounds,
    keepRatio,
    onCommit,
    onLiveChange,
    cropRectRef,
    clipFuncRef,
  }: CropHandleProps) {
    const transformerRef = useRef<Konva.Transformer>(null);
    const onCommitRef = useRef(onCommit);
    const onLiveChangeRef = useRef(onLiveChange);

    useLayoutEffect(() => {
      onCommitRef.current = onCommit;
      onLiveChangeRef.current = onLiveChange;
    });

    const clampCrop = useCallback(
      (box: DisplayCrop) => clampCropInBounds(box, cropBounds, MIN_CROP),
      [cropBounds],
    );

    clipFuncRef.current = (ctx: KonvaType.Context) => {
      const node = cropRectRef.current;
      if (!node) return;
      const { x, y, width, height } = readCropFromNode(node);
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.closePath();
    };

    const commitNode = useCallback(() => {
      const node = cropRectRef.current;
      if (!node) return;
      const clamped = clampCrop(readCropFromNode(node));
      applyCropToNode(node, clamped);
      transformerRef.current?.nodes([node]);
      transformerRef.current?.getLayer()?.batchDraw();
      onCommitRef.current(clamped);
    }, [clampCrop, cropRectRef]);

    useLayoutEffect(() => {
      const node = cropRectRef.current;
      const tr = transformerRef.current;
      if (!node || !tr) return;
      const initial = clampCropInBounds(initialCrop, cropBounds, MIN_CROP);
      applyCropToNode(node, initial);
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
      onCommitRef.current(initial);
    }, [photoId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDragMove = useCallback(
      (e: KonvaType.KonvaEventObject<DragEvent>) => {
        const node = e.target as Konva.Rect;
        const next = clampCrop(readCropFromNode(node));
        node.position({ x: next.x, y: next.y });
        onLiveChangeRef.current(next);
        node.getLayer()?.batchDraw();
      },
      [clampCrop],
    );

    const handleTransformStart = useCallback(() => {
      cropRectRef.current?.draggable(false);
    }, [cropRectRef]);

    const handleTransform = useCallback(() => {
      const node = cropRectRef.current;
      if (!node) return;
      onLiveChangeRef.current(readCropFromNode(node));
      node.getLayer()?.batchDraw();
    }, [cropRectRef]);

    const handleTransformEnd = useCallback(() => {
      const node = cropRectRef.current;
      if (node) node.draggable(true);
      commitNode();
    }, [commitNode, cropRectRef]);

    return (
      <>
        <Rect
          ref={cropRectRef}
          fill="rgba(255,255,255,0.06)"
          stroke="#ffffff"
          strokeWidth={2}
          dash={[6, 4]}
          draggable
          dragBoundFunc={(pos) => {
            const node = cropRectRef.current;
            if (!node) return pos;
            const w = Math.max(MIN_CROP, Math.abs(node.width() * node.scaleX()));
            const h = Math.max(MIN_CROP, Math.abs(node.height() * node.scaleY()));
            return {
              x: Math.max(cropBounds.x, Math.min(pos.x, cropBounds.x + cropBounds.width - w)),
              y: Math.max(cropBounds.y, Math.min(pos.y, cropBounds.y + cropBounds.height - h)),
            };
          }}
          onMouseDown={stopPointerBubble}
          onTouchStart={stopPointerBubble}
          onDragMove={handleDragMove}
          onDragEnd={commitNode}
          onTransformStart={handleTransformStart}
          onTransform={handleTransform}
          onTransformEnd={handleTransformEnd}
        />
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          keepRatio={keepRatio}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < MIN_CROP || newBox.height < MIN_CROP) return oldBox;
            return newBox;
          }}
        />
      </>
    );
  },
  () => true,
);

function applyBlurFilter(node: Konva.Image | null) {
  if (!node) return;
  node.clearCache();
  node.cache();
  node.filters([Konva.Filters.Blur]);
  node.blurRadius(10);
  node.getLayer()?.batchDraw();
}

export default function PhotoCropOverlay({
  photo,
  image,
  naturalWidth,
  naturalHeight,
  aspectPreset,
  onDraftChange,
}: PhotoCropOverlayProps) {
  const cropRectRef = useRef<Konva.Rect>(null);
  const clipFuncRef = useRef<((ctx: KonvaType.Context) => void) | null>(null);
  const blurredImageRef = useRef<Konva.Image>(null);
  const [displayCrop, setDisplayCrop] = useState<DisplayCrop>(() => initialCropDisplay(photo));

  const recovery = useMemo(
    () => cropRecoveryLayout(photo, naturalWidth, naturalHeight),
    [naturalHeight, naturalWidth, photo],
  );
  const cropBounds = useMemo(() => recoveryCropBounds(recovery), [recovery]);

  const aspectRatio =
    CROP_ASPECT_PRESETS.find((preset) => preset.id === aspectPreset)?.ratio ?? null;

  const { offsetX, offsetY, fullWidth, fullHeight } = recovery;

  const emitDraft = useCallback(
    (next: DisplayCrop) => {
      const source = displayCropToSource(next, photo, naturalWidth, naturalHeight);
      onDraftChange?.(source, next);
    },
    [naturalHeight, naturalWidth, onDraftChange, photo],
  );

  const clampCrop = useCallback(
    (box: DisplayCrop) => clampCropInBounds(box, cropBounds, MIN_CROP),
    [cropBounds],
  );

  useLayoutEffect(() => {
    applyBlurFilter(blurredImageRef.current);
  }, [fullHeight, fullWidth, image, offsetX, offsetY]);

  const handleCommit = useCallback(
    (crop: DisplayCrop) => {
      setDisplayCrop(crop);
      emitDraft(crop);
    },
    [emitDraft],
  );

  const handleLiveChange = useCallback((crop: DisplayCrop) => {
    setDisplayCrop(crop);
  }, []);

  useEffect(() => {
    emitDraft(initialCropDisplay(photo));
  }, [photo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevAspectRef = useRef(aspectPreset);
  useEffect(() => {
    if (prevAspectRef.current === aspectPreset) return;
    prevAspectRef.current = aspectPreset;
    if (!aspectRatio) return;
    const node = cropRectRef.current;
    if (!node) return;
    const next = clampCrop(largestAspectCropInRecovery(recovery, aspectRatio));
    applyCropToNode(node, next);
    setDisplayCrop(next);
    emitDraft(next);
    node.getLayer()?.batchDraw();
  }, [aspectRatio, aspectPreset, clampCrop, emitDraft, photo.id, recovery]);

  const { x, y, width, height } = displayCrop;
  const dimBottom = Math.max(0, cropBounds.y + cropBounds.height - (y + height));
  const dimRight = Math.max(0, cropBounds.x + cropBounds.width - (x + width));

  const clipToLiveCrop = useCallback((ctx: KonvaType.Context) => {
    clipFuncRef.current?.(ctx);
  }, []);

  const handleKey = `${photo.id}-${aspectPreset}`;

  return (
    <Group
      x={photo.x}
      y={photo.y}
      rotation={photo.rotation}
      scaleX={photo.scaleX ?? 1}
      scaleY={photo.scaleY ?? 1}
      listening
      onMouseDown={stopPointerBubble}
      onTouchStart={stopPointerBubble}
    >
      <KonvaImage
        ref={blurredImageRef}
        image={image}
        x={offsetX}
        y={offsetY}
        width={fullWidth}
        height={fullHeight}
        opacity={recovery.hasRecovery ? 0.42 : 0.55}
        listening={false}
        perfectDrawEnabled={false}
      />

      <Group clipFunc={clipToLiveCrop} listening={false}>
        <KonvaImage
          image={image}
          x={offsetX}
          y={offsetY}
          width={fullWidth}
          height={fullHeight}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>

      <Rect
        x={cropBounds.x}
        y={cropBounds.y}
        width={cropBounds.width}
        height={Math.max(0, y - cropBounds.y)}
        fill="rgba(0,0,0,0.5)"
        listening={false}
      />
      <Rect
        x={cropBounds.x}
        y={y + height}
        width={cropBounds.width}
        height={dimBottom}
        fill="rgba(0,0,0,0.5)"
        listening={false}
      />
      <Rect
        x={cropBounds.x}
        y={y}
        width={Math.max(0, x - cropBounds.x)}
        height={height}
        fill="rgba(0,0,0,0.5)"
        listening={false}
      />
      <Rect
        x={x + width}
        y={y}
        width={dimRight}
        height={height}
        fill="rgba(0,0,0,0.5)"
        listening={false}
      />

      <CropHandle
        key={handleKey}
        photoId={photo.id}
        initialCrop={initialCropDisplay(photo)}
        cropRectRef={cropRectRef}
        clipFuncRef={clipFuncRef}
        cropBounds={cropBounds}
        keepRatio={aspectRatio != null}
        onCommit={handleCommit}
        onLiveChange={handleLiveChange}
      />
    </Group>
  );
}
