"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Circle, Group, Image as KonvaImage, Rect, Shape } from "react-konva";
import type KonvaType from "konva";
import {
  coverBlitRects,
  fitWindowToDest,
  fourCutSlotDestHoles,
  getFourCutSkin,
  getFourCutThemeCanvas,
  panWindowByDestDelta,
  slotImagePlacement,
  windowsClose,
  zoomWindowAtDest,
} from "@/lib/four-cut";
import type { PhotoCropRect, WallSceneFourCut, WallScenePhoto } from "@/types/wall-scene-v2";

interface FourCutSlotCropOverlayProps {
  photo: WallScenePhoto;
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  slotIndex: number;
  slotWindows: WallSceneFourCut["windows"];
  onSlotWindowChange: (index: number, window: PhotoCropRect) => void;
  onDraftChange?: (
    crop: PhotoCropRect,
    display: { x: number; y: number; width: number; height: number },
  ) => void;
}

const HANDLE = 10;

function stopPointerBubble(e: KonvaType.KonvaEventObject<MouseEvent | TouchEvent | WheelEvent>) {
  e.cancelBubble = true;
}

function touchDistance(e: TouchEvent): number | null {
  if (e.touches.length < 2) return null;
  const a = e.touches[0];
  const b = e.touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export default function FourCutSlotCropOverlay({
  photo,
  image,
  naturalWidth,
  naturalHeight,
  slotIndex,
  slotWindows,
  onSlotWindowChange,
  onDraftChange,
}: FourCutSlotCropOverlayProps) {
  const fourCut = photo.fourCut;
  const dragRef = useRef<
    | { mode: "pan"; lastX: number; lastY: number }
    | { mode: "zoom"; startDist: number; origin: PhotoCropRect }
    | { mode: "pinch"; startDist: number; origin: PhotoCropRect }
    | null
  >(null);
  const windowRef = useRef(slotWindows[slotIndex]);
  windowRef.current = slotWindows[slotIndex];

  const holes = useMemo(
    () => fourCutSlotDestHoles(photo, naturalWidth, naturalHeight),
    [naturalHeight, naturalWidth, photo],
  );
  const baseWindows = fourCut?.baseWindows ?? fourCut?.windows;
  const dest = holes?.[slotIndex];
  const bounds = baseWindows?.[slotIndex];
  const skin = getFourCutSkin(fourCut?.skinId);
  const themeCanvas =
    skin && !skin.src ? getFourCutThemeCanvas(skin, photo.width, photo.height) : null;

  const emit = useCallback(
    (window: PhotoCropRect) => {
      if (!dest) return;
      onSlotWindowChange(slotIndex, window);
      onDraftChange?.(window, dest);
    },
    [dest, onDraftChange, onSlotWindowChange, slotIndex],
  );

  useEffect(() => {
    if (!dest || !bounds) return;
    const fitted = fitWindowToDest(windowRef.current, dest, bounds);
    if (!windowsClose(fitted, windowRef.current)) {
      windowRef.current = fitted;
      emit(fitted);
    }
  }, [bounds, dest, emit, slotIndex]);

  const handlePanMove = useCallback(
    (x: number, y: number) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== "pan" || !dest || !bounds) return;
      const next = panWindowByDestDelta(
        windowRef.current,
        { x: x - drag.lastX, y: y - drag.lastY },
        dest,
        bounds,
      );
      drag.lastX = x;
      drag.lastY = y;
      windowRef.current = next;
      emit(next);
    },
    [bounds, dest, emit],
  );

  const beginPan = useCallback(
    (e: KonvaType.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      const pos = e.currentTarget.getParent()?.getRelativePointerPosition();
      if (!pos) return;
      dragRef.current = { mode: "pan", lastX: pos.x, lastY: pos.y };
    },
    [],
  );

  if (!fourCut || !holes || !dest || !bounds) return null;

  const selectedPlace = slotImagePlacement(bounds, slotWindows[slotIndex], dest);

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
      onMouseMove={(e) => {
        const pos = e.currentTarget.getRelativePointerPosition();
        if (!pos) return;
        const drag = dragRef.current;
        if (drag?.mode === "zoom" && dest && bounds) {
          const cx = dest.x + dest.width / 2;
          const cy = dest.y + dest.height / 2;
          const dist = Math.max(8, Math.hypot(pos.x - cx, pos.y - cy));
          const next = zoomWindowAtDest(drag.origin, dist / drag.startDist, dest, bounds);
          windowRef.current = next;
          emit(next);
          return;
        }
        handlePanMove(pos.x, pos.y);
      }}
      onTouchMove={(e) => {
        const evt = e.evt;
        const drag = dragRef.current;
        if (drag?.mode === "pinch" && dest && bounds) {
          const dist = touchDistance(evt);
          if (dist && drag.startDist > 1) {
            const next = zoomWindowAtDest(drag.origin, dist / drag.startDist, dest, bounds);
            windowRef.current = next;
            emit(next);
          }
          e.cancelBubble = true;
          return;
        }
        const pos = e.currentTarget.getRelativePointerPosition();
        if (!pos) return;
        if (drag?.mode === "zoom" && dest && bounds) {
          const cx = dest.x + dest.width / 2;
          const cy = dest.y + dest.height / 2;
          const dist = Math.max(8, Math.hypot(pos.x - cx, pos.y - cy));
          const next = zoomWindowAtDest(drag.origin, dist / drag.startDist, dest, bounds);
          windowRef.current = next;
          emit(next);
          return;
        }
        handlePanMove(pos.x, pos.y);
      }}
      onMouseUp={() => {
        dragRef.current = null;
      }}
      onTouchEnd={() => {
        dragRef.current = null;
      }}
      onMouseLeave={() => {
        if (dragRef.current?.mode === "pan") dragRef.current = null;
      }}
    >
      {themeCanvas ? (
        <KonvaImage
          image={themeCanvas}
          x={0}
          y={0}
          width={photo.width}
          height={photo.height}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : (
        <KonvaImage
          image={image}
          x={0}
          y={0}
          width={photo.width}
          height={photo.height}
          opacity={0.4}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {holes.map((hole, index) => {
        const window = slotWindows[index];
        const cellBounds = baseWindows[index];
        if (index === slotIndex) {
          return (
            <Group key={`slot-${index}`}>
              <Group
                clipFunc={(ctx) => {
                  ctx.rect(hole.x, hole.y, hole.width, hole.height);
                }}
                listening={false}
              >
                <KonvaImage
                  image={image}
                  x={selectedPlace.x}
                  y={selectedPlace.y}
                  width={selectedPlace.width}
                  height={selectedPlace.height}
                  crop={cellBounds}
                  listening={false}
                  imageSmoothingEnabled
                  perfectDrawEnabled={false}
                />
              </Group>
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                fill="rgba(255,255,255,0.01)"
                listening
                onMouseDown={beginPan}
                onTouchStart={(e) => {
                  e.cancelBubble = true;
                  const dist = touchDistance(e.evt);
                  if (dist && e.evt.touches.length >= 2) {
                    dragRef.current = {
                      mode: "pinch",
                      startDist: dist,
                      origin: windowRef.current,
                    };
                    return;
                  }
                  beginPan(e);
                }}
                onWheel={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if (!dest || !bounds) return;
                  const pos = e.currentTarget.getParent()?.getRelativePointerPosition();
                  const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1;
                  const next = zoomWindowAtDest(
                    windowRef.current,
                    factor,
                    dest,
                    bounds,
                    pos ?? undefined,
                  );
                  windowRef.current = next;
                  emit(next);
                }}
              />
            </Group>
          );
        }

        const blit = coverBlitRects(window, hole);
        return (
          <Group
            key={`slot-${index}`}
            clipFunc={(ctx) => {
              ctx.rect(hole.x, hole.y, hole.width, hole.height);
            }}
            listening={false}
            opacity={0.38}
          >
            <KonvaImage
              image={image}
              x={blit.dx}
              y={blit.dy}
              width={blit.dw}
              height={blit.dh}
              crop={{ x: blit.sx, y: blit.sy, width: blit.sw, height: blit.sh }}
              listening={false}
              imageSmoothingEnabled
              perfectDrawEnabled={false}
            />
          </Group>
        );
      })}

      <Shape
        listening={false}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.rect(0, 0, photo.width, photo.height);
          for (const hole of holes) {
            ctx.rect(hole.x, hole.y, hole.width, hole.height);
          }
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fill("evenodd");
          ctx.fillStrokeShape(shape);
        }}
      />

      <Rect
        x={dest.x}
        y={dest.y}
        width={dest.width}
        height={dest.height}
        stroke="#ffffff"
        strokeWidth={2}
        listening={false}
        perfectDrawEnabled={false}
      />

      <Circle
        x={dest.x + dest.width}
        y={dest.y + dest.height}
        radius={HANDLE}
        fill="#ffffff"
        stroke="#111111"
        strokeWidth={1}
        onMouseDown={(e) => {
          e.cancelBubble = true;
          const pos = e.currentTarget.getParent()?.getRelativePointerPosition();
          if (!pos) return;
          const cx = dest.x + dest.width / 2;
          const cy = dest.y + dest.height / 2;
          dragRef.current = {
            mode: "zoom",
            startDist: Math.max(8, Math.hypot(pos.x - cx, pos.y - cy)),
            origin: windowRef.current,
          };
        }}
        onTouchStart={(e) => {
          e.cancelBubble = true;
          const pos = e.currentTarget.getParent()?.getRelativePointerPosition();
          if (!pos) return;
          const cx = dest.x + dest.width / 2;
          const cy = dest.y + dest.height / 2;
          dragRef.current = {
            mode: "zoom",
            startDist: Math.max(8, Math.hypot(pos.x - cx, pos.y - cy)),
            origin: windowRef.current,
          };
        }}
      />
    </Group>
  );
}
