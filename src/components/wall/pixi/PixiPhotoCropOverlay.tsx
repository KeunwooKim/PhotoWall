"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCachedHtmlImage, loadHtmlImage } from "@/lib/storage/load-html-image";
import {
  CROP_ASPECT_PRESETS,
  clampCropInBounds,
  cropRecoveryLayout,
  displayCropToSource,
  initialCropDisplay,
  largestAspectCropInRecovery,
  recoveryCropBounds,
  type CropAspectPresetId,
} from "@/lib/wall-scene/photo-crop";
import type { PhotoCropRect, WallScenePhoto } from "@/types/wall-scene-v2";
import type { PixiWallEngine } from "./pixi-wall-engine";

type DisplayCrop = { x: number; y: number; width: number; height: number };

const MIN_CROP = 24;
const HANDLE = 14;

interface PixiPhotoCropOverlayProps {
  engine: PixiWallEngine;
  photo: WallScenePhoto;
  aspectPreset: CropAspectPresetId;
  resolvePhotoSrc?: (src: string) => Promise<string>;
  onDraftChange: (
    crop: PhotoCropRect,
    display: { x: number; y: number; width: number; height: number },
  ) => void;
  onNaturalSize: (width: number, height: number) => void;
}

/**
 * HTML crop UI with recovery: previously cropped-away source regions stay
 * visible (dimmed) so the crop rect can expand back to the full photo.
 */
export default function PixiPhotoCropOverlay({
  engine,
  photo,
  aspectPreset,
  resolvePhotoSrc,
  onDraftChange,
  onNaturalSize,
}: PixiPhotoCropOverlayProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [displayCrop, setDisplayCrop] = useState<DisplayCrop>(() => initialCropDisplay(photo));
  const dragRef = useRef<
    | { mode: "move"; startX: number; startY: number; origin: DisplayCrop }
    | {
        mode: "resize";
        corner: "nw" | "ne" | "sw" | "se";
        startX: number;
        startY: number;
        origin: DisplayCrop;
      }
    | null
  >(null);

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

  const recovery = useMemo(
    () => (natural ? cropRecoveryLayout(photo, natural.width, natural.height) : null),
    [natural, photo],
  );
  const cropBounds = useMemo(
    () => (recovery ? recoveryCropBounds(recovery) : null),
    [recovery],
  );

  const aspectRatio =
    CROP_ASPECT_PRESETS.find((preset) => preset.id === aspectPreset)?.ratio ?? null;

  const emitDraft = useCallback(
    (next: DisplayCrop) => {
      if (!natural) return;
      onDraftChange(displayCropToSource(next, photo, natural.width, natural.height), next);
    },
    [natural, onDraftChange, photo],
  );

  useEffect(() => {
    if (!natural || !cropBounds) return;
    const next = clampCropInBounds(initialCropDisplay(photo), cropBounds, MIN_CROP);
    setDisplayCrop(next);
    emitDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per crop session
  }, [photo.id, natural?.width, natural?.height]);

  useEffect(() => {
    if (!aspectRatio || !recovery || !cropBounds) return;
    const next = clampCropInBounds(
      largestAspectCropInRecovery(recovery, aspectRatio),
      cropBounds,
      MIN_CROP,
    );
    setDisplayCrop(next);
    emitDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectPreset]);

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

  const onPointerDownMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      origin: displayCrop,
    };
  };

  const onPointerDownResize =
    (corner: "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode: "resize",
        corner,
        startX: e.clientX,
        startY: e.clientY,
        origin: displayCrop,
      };
    };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !cropBounds) return;
    const dx = (e.clientX - drag.startX) / screen.sx;
    const dy = (e.clientY - drag.startY) / screen.sy;
    let next: DisplayCrop = { ...drag.origin };

    if (drag.mode === "move") {
      next = { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy };
    } else {
      const o = drag.origin;
      next = { ...o };
      if (drag.corner.includes("w")) {
        next.x = o.x + dx;
        next.width = o.width - dx;
      }
      if (drag.corner.includes("e")) next.width = o.width + dx;
      if (drag.corner.includes("n")) {
        next.y = o.y + dy;
        next.height = o.height - dy;
      }
      if (drag.corner.includes("s")) next.height = o.height + dy;
      if (aspectRatio && next.width > 0) {
        next.height = next.width / aspectRatio;
      }
    }

    next = clampCropInBounds(next, cropBounds, MIN_CROP);
    setDisplayCrop(next);
    emitDraft(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    dragRef.current = null;
  };

  if (!natural || !displaySrc || !recovery || !cropBounds) {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <span className="rounded-full bg-foreground/80 px-3 py-1.5 text-xs text-background">
          자르기 준비 중…
        </span>
      </div>
    );
  }

  const { offsetX, offsetY, fullWidth, fullHeight, hasRecovery } = recovery;
  const imgLeft = offsetX * screen.sx;
  const imgTop = offsetY * screen.sy;
  const imgW = fullWidth * screen.sx;
  const imgH = fullHeight * screen.sy;
  const cropLeft = displayCrop.x * screen.sx;
  const cropTop = displayCrop.y * screen.sy;
  const cropW = displayCrop.width * screen.sx;
  const cropH = displayCrop.height * screen.sy;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-label="사진 자르기">
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
      >
        {/* Recovery hit/visual area — full source mapped into photo-local space */}
        <div
          className="absolute"
          style={{
            left: imgLeft,
            top: imgTop,
            width: imgW,
            height: imgH,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none object-fill"
            style={{
              opacity: hasRecovery ? 0.42 : 0.55,
              filter: hasRecovery ? "blur(6px)" : undefined,
            }}
          />
        </div>

        {/* Sharp preview inside the live crop window */}
        <div
          className="absolute overflow-hidden border-2 border-white"
          style={{
            left: cropLeft,
            top: cropTop,
            width: cropW,
            height: cropH,
            cursor: "move",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
          onPointerDown={onPointerDownMove}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none object-fill"
            style={{
              left: imgLeft - cropLeft,
              top: imgTop - cropTop,
              width: imgW,
              height: imgH,
            }}
          />
          {(
            [
              ["nw", 0, 0],
              ["ne", 1, 0],
              ["sw", 0, 1],
              ["se", 1, 1],
            ] as const
          ).map(([corner, ox, oy]) => (
            <span
              key={corner}
              className="absolute rounded-sm bg-white shadow"
              style={{
                left: `${ox * 100}%`,
                top: `${oy * 100}%`,
                width: HANDLE,
                height: HANDLE,
                marginLeft: -HANDLE / 2,
                marginTop: -HANDLE / 2,
                cursor:
                  corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
              }}
              onPointerDown={onPointerDownResize(corner)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
