"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
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
import type { PixiWallEngine } from "./pixi-wall-engine";

const HANDLE = 14;

interface PixiFourCutSlotCropOverlayProps {
  engine: PixiWallEngine;
  photo: WallScenePhoto;
  slotIndex: number;
  slotWindows: WallSceneFourCut["windows"];
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onSlotWindowChange: (index: number, window: PhotoCropRect) => void;
  onDraftChange: (
    crop: PhotoCropRect,
    display: { x: number; y: number; width: number; height: number },
  ) => void;
  onNaturalSize: (width: number, height: number) => void;
}

function sourceImgStyle(
  natural: { width: number; height: number },
  srcRect: PhotoCropRect,
  destRect: PhotoCropRect,
  hole: PhotoCropRect,
  sx: number,
  sy: number,
): { left: number; top: number; width: number; height: number } {
  const scaleX = destRect.width / Math.max(1e-6, srcRect.width);
  const scaleY = destRect.height / Math.max(1e-6, srcRect.height);
  return {
    left: (destRect.x - srcRect.x * scaleX - hole.x) * sx,
    top: (destRect.y - srcRect.y * scaleY - hole.y) * sy,
    width: natural.width * scaleX * sx,
    height: natural.height * scaleY * sy,
  };
}

export default function PixiFourCutSlotCropOverlay({
  engine,
  photo,
  slotIndex,
  slotWindows,
  resolvePhotoSrc,
  onSlotWindowChange,
  onDraftChange,
  onNaturalSize,
}: PixiFourCutSlotCropOverlayProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [tick, setTick] = useState(0);
  const dragRef = useRef<
    | { mode: "pan"; lastX: number; lastY: number }
    | { mode: "zoom"; startDist: number; origin: PhotoCropRect }
    | { mode: "pinch"; startDist: number; origin: PhotoCropRect }
    | null
  >(null);
  const windowRef = useRef(slotWindows[slotIndex]);
  windowRef.current = slotWindows[slotIndex];
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const src = resolvePhotoSrc ? await resolvePhotoSrc(photo.src) : photo.src;
        if (!cancelled) setDisplaySrc(src);
      } catch {
        if (!cancelled) setDisplaySrc(photo.src);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photo.src, resolvePhotoSrc]);

  useEffect(() => {
    if (!displaySrc) return;
    const cached = getCachedHtmlImage(displaySrc);
    if (cached) {
      const size = { width: cached.naturalWidth, height: cached.naturalHeight };
      setNatural(size);
      onNaturalSize(size.width, size.height);
      return;
    }
    let cancelled = false;
    void loadHtmlImage(displaySrc)
      .then((img) => {
        if (cancelled) return;
        const size = { width: img.naturalWidth, height: img.naturalHeight };
        setNatural(size);
        onNaturalSize(size.width, size.height);
      })
      .catch(() => {
        if (!cancelled) setNatural(null);
      });
    return () => {
      cancelled = true;
    };
  }, [displaySrc, onNaturalSize]);

  useEffect(() => {
    const vp = engine.viewport;
    const bump = () => setTick((n) => n + 1);
    vp.on("moved", bump);
    vp.on("zoomed", bump);
    return () => {
      vp.off("moved", bump);
      vp.off("zoomed", bump);
    };
  }, [engine]);

  const fourCut = photo.fourCut;
  const holes = useMemo(
    () => (natural ? fourCutSlotDestHoles(photo, natural.width, natural.height) : null),
    [natural, photo],
  );
  const dest = holes?.[slotIndex];
  const baseWindows = fourCut?.baseWindows ?? fourCut?.windows;
  const bounds = baseWindows?.[slotIndex];
  const skin = getFourCutSkin(fourCut?.skinId);
  const themeUrl = useMemo(() => {
    if (!skin || skin.src) return null;
    const canvas = getFourCutThemeCanvas(skin, photo.width, photo.height);
    return canvas?.toDataURL() ?? null;
  }, [photo.height, photo.width, skin]);

  const screen = useMemo(() => {
    void tick;
    const origin = engine.viewport.toScreen({ x: photo.x, y: photo.y });
    const sx = engine.viewport.scale.x * Math.abs(photo.scaleX ?? 1);
    const sy = engine.viewport.scale.y * Math.abs(photo.scaleY ?? 1);
    return {
      left: origin.x,
      top: origin.y,
      sx,
      sy,
      rotation: photo.rotation,
    };
  }, [engine, photo, tick]);

  const emit = useCallback(
    (window: PhotoCropRect) => {
      if (!dest) return;
      onSlotWindowChange(slotIndex, window);
      onDraftChange(window, dest);
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

  const localFromClient = (clientX: number, clientY: number) => {
    const dx = (clientX - screen.left) / screen.sx;
    const dy = (clientY - screen.top) / screen.sy;
    const rad = (-screen.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  };

  const onPointerDownPan = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2 && dest && bounds) {
      const pts = [...pointersRef.current.values()];
      dragRef.current = {
        mode: "pinch",
        startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        origin: windowRef.current,
      };
      return;
    }
    const pos = localFromClient(e.clientX, e.clientY);
    dragRef.current = { mode: "pan", lastX: pos.x, lastY: pos.y };
    (e.currentTarget as HTMLElement).style.cursor = "grabbing";
  };

  const onPointerDownZoom = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (!dest) return;
    const pos = localFromClient(e.clientX, e.clientY);
    const cx = dest.x + dest.width / 2;
    const cy = dest.y + dest.height / 2;
    dragRef.current = {
      mode: "zoom",
      startDist: Math.max(8, Math.hypot(pos.x - cx, pos.y - cy)),
      origin: windowRef.current,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const drag = dragRef.current;
    if (!drag || !dest || !bounds) return;
    if (drag.mode === "pinch") {
      const pts = [...pointersRef.current.values()];
      if (pts.length >= 2 && drag.startDist > 1) {
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const next = zoomWindowAtDest(drag.origin, dist / drag.startDist, dest, bounds);
        windowRef.current = next;
        emit(next);
      }
      return;
    }
    const pos = localFromClient(e.clientX, e.clientY);
    if (drag.mode === "pan") {
      const next = panWindowByDestDelta(
        windowRef.current,
        { x: pos.x - drag.lastX, y: pos.y - drag.lastY },
        dest,
        bounds,
      );
      drag.lastX = pos.x;
      drag.lastY = pos.y;
      windowRef.current = next;
      emit(next);
      return;
    }
    const cx = dest.x + dest.width / 2;
    const cy = dest.y + dest.height / 2;
    const dist = Math.max(8, Math.hypot(pos.x - cx, pos.y - cy));
    const next = zoomWindowAtDest(drag.origin, dist / drag.startDist, dest, bounds);
    windowRef.current = next;
    emit(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (pointersRef.current.size < 2 && dragRef.current?.mode === "pinch") {
      dragRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.cursor = "grab";
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dest || !bounds) return;
    const pos = localFromClient(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = zoomWindowAtDest(windowRef.current, factor, dest, bounds, pos);
    windowRef.current = next;
    emit(next);
  };

  if (!natural || !displaySrc || !holes || !dest || !bounds || !fourCut) {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <span className="rounded-full bg-foreground/80 px-3 py-1.5 text-xs text-background">
          칸 자르기 준비 중…
        </span>
      </div>
    );
  }

  const px = (n: number) => n * screen.sx;
  const py = (n: number) => n * screen.sy;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-label="칸 자르기">
      <div
        className="pointer-events-auto absolute origin-top-left"
        style={{
          left: screen.left,
          top: screen.top,
          width: 0,
          height: 0,
          transform: `rotate(${screen.rotation}deg)`,
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute overflow-hidden"
          style={{ left: 0, top: 0, width: px(photo.width), height: py(photo.height) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={themeUrl ?? displaySrc}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none object-fill"
            style={{ opacity: themeUrl ? 1 : 0.4 }}
          />

          {holes.map((hole, index) => {
            const window = slotWindows[index];
            const cellBounds = baseWindows[index];
            const active = index === slotIndex;
            const place = active ? slotImagePlacement(cellBounds, window, hole) : null;
            const blit = active ? null : coverBlitRects(window, hole);
            const imgStyle = place
              ? sourceImgStyle(natural, cellBounds, place, hole, screen.sx, screen.sy)
              : blit
                ? sourceImgStyle(
                    natural,
                    { x: blit.sx, y: blit.sy, width: blit.sw, height: blit.sh },
                    { x: blit.dx, y: blit.dy, width: blit.dw, height: blit.dh },
                    hole,
                    screen.sx,
                    screen.sy,
                  )
                : null;
            return (
              <div
                key={index}
                className="absolute overflow-hidden"
                style={{
                  left: px(hole.x),
                  top: py(hole.y),
                  width: px(hole.width),
                  height: py(hole.height),
                  opacity: active ? 1 : 0.38,
                  cursor: active ? "grab" : undefined,
                  outline: active ? "2px solid #fff" : undefined,
                  boxShadow: active ? "0 0 0 9999px rgba(0,0,0,0.45)" : undefined,
                  touchAction: "none",
                }}
                onPointerDown={active ? onPointerDownPan : undefined}
                onPointerMove={active ? onPointerMove : undefined}
                onPointerUp={active ? onPointerUp : undefined}
                onPointerCancel={active ? onPointerUp : undefined}
              >
                {imgStyle ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displaySrc}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute max-w-none select-none object-fill"
                    style={imgStyle}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <span
          className="absolute rounded-full bg-white shadow"
          style={{
            left: px(dest.x + dest.width) - HANDLE / 2,
            top: py(dest.y + dest.height) - HANDLE / 2,
            width: HANDLE,
            height: HANDLE,
            cursor: "nwse-resize",
          }}
          onPointerDown={onPointerDownZoom}
        />
      </div>
    </div>
  );
}
