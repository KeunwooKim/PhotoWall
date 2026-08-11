"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getInstagramExportPreset,
  MIN_EXPORT_FRAME,
  normalizeMarquee,
  refitFrameToAspect,
  type InstagramExportPresetId,
  type WallExportRect,
} from "@/lib/wall-scene/instagram-export";
import { clampCropInBounds } from "@/lib/wall-scene/photo-crop";
import {
  type WallViewportAdapter,
  worldRectToScreen,
} from "@/lib/wall-scene/wall-viewport-adapter";

const HANDLE = 14;
const MIN_MARQUEE = 32;

type InstagramExportOverlayProps = {
  viewport: WallViewportAdapter;
  wallBounds: { x: number; y: number; width: number; height: number };
  phase: "pick" | "adjust";
  presetId: InstagramExportPresetId;
  frame: WallExportRect | null;
  onMarqueeComplete: (rect: WallExportRect) => void;
  onFrameChange: (rect: WallExportRect) => void;
};

export default function InstagramExportOverlay({
  viewport,
  wallBounds,
  phase,
  presetId,
  frame,
  onMarqueeComplete,
  onFrameChange,
}: InstagramExportOverlayProps) {
  const [tick, setTick] = useState(0);
  const pickStartRef = useRef<{ x: number; y: number } | null>(null);
  const [pickDraft, setPickDraft] = useState<WallExportRect | null>(null);
  const dragRef = useRef<
    | { mode: "move"; startX: number; startY: number; origin: WallExportRect }
    | {
        mode: "resize";
        corner: "nw" | "ne" | "sw" | "se";
        startX: number;
        startY: number;
        origin: WallExportRect;
      }
    | null
  >(null);

  const aspectRatio = getInstagramExportPreset(presetId).ratio;

  useEffect(() => viewport.subscribe(() => setTick((n) => n + 1)), [viewport]);

  const screenFrame = useMemo(() => {
    void tick;
    if (phase === "pick" && pickDraft) {
      return worldRectToScreen(viewport, pickDraft);
    }
    if (phase === "adjust" && frame) {
      return worldRectToScreen(viewport, frame);
    }
    return null;
  }, [frame, phase, pickDraft, tick, viewport]);

  const onPickPointerDown = (e: React.PointerEvent) => {
    if (phase !== "pick") return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const world = viewport.toWorld(e.clientX, e.clientY);
    pickStartRef.current = { x: world.x, y: world.y };
    setPickDraft({ x: world.x, y: world.y, width: 0, height: 0 });
  };

  const onPickPointerMove = (e: React.PointerEvent) => {
    if (phase !== "pick" || !pickStartRef.current) return;
    const world = viewport.toWorld(e.clientX, e.clientY);
    const start = pickStartRef.current;
    setPickDraft(normalizeMarquee(start.x, start.y, world.x, world.y));
  };

  const onPickPointerUp = (e: React.PointerEvent) => {
    if (phase !== "pick") return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const start = pickStartRef.current;
    pickStartRef.current = null;
    if (!start) return;
    const world = viewport.toWorld(e.clientX, e.clientY);
    const marquee = normalizeMarquee(start.x, start.y, world.x, world.y);
    setPickDraft(null);
    if (marquee.width < MIN_MARQUEE || marquee.height < MIN_MARQUEE) return;
    onMarqueeComplete(marquee);
  };

  const onAdjustPointerDownMove = (e: React.PointerEvent) => {
    if (!frame) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      origin: frame,
    };
  };

  const onAdjustPointerDownResize =
    (corner: "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
      if (!frame) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode: "resize",
        corner,
        startX: e.clientX,
        startY: e.clientY,
        origin: frame,
      };
    };

  const onAdjustPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || phase !== "adjust") return;
    const scale = viewport.getScale();
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    let next: WallExportRect = { ...drag.origin };

    if (drag.mode === "move") {
      next = {
        ...drag.origin,
        x: drag.origin.x + dx,
        y: drag.origin.y + dy,
      };
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
      if (next.width > 0) {
        next.height = next.width / aspectRatio;
      }
    }

    next = clampCropInBounds(next, wallBounds, MIN_EXPORT_FRAME);
    next = refitFrameToAspect(next, aspectRatio, wallBounds);
    onFrameChange(next);
  };

  const onAdjustPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    dragRef.current = null;
  };

  if (phase === "pick") {
    return (
      <div
        className="absolute inset-0 z-30 touch-none"
        aria-label="인스타 내보내기 영역 선택"
        onPointerDown={onPickPointerDown}
        onPointerMove={onPickPointerMove}
        onPointerUp={onPickPointerUp}
        onPointerCancel={onPickPointerUp}
      >
        {screenFrame && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-white"
            style={{
              left: screenFrame.left,
              top: screenFrame.top,
              width: screenFrame.width,
              height: screenFrame.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4">
          <p className="rounded-full bg-foreground/85 px-4 py-2 text-xs font-medium text-background shadow">
            자랑하고 싶은 구역을 드래그해서 선택하세요
          </p>
        </div>
      </div>
    );
  }

  if (!frame || !screenFrame) return null;

  return (
    <div className="absolute inset-0 z-30 touch-none" aria-label="인스타 크롭">
      <div
        className="absolute inset-0"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      <div
        className="pointer-events-auto absolute border-2 border-white"
        style={{
          left: screenFrame.left,
          top: screenFrame.top,
          width: screenFrame.width,
          height: screenFrame.height,
          cursor: "move",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
        }}
        onPointerDown={onAdjustPointerDownMove}
        onPointerMove={onAdjustPointerMove}
        onPointerUp={onAdjustPointerUp}
        onPointerCancel={onAdjustPointerUp}
      >
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
              cursor: `${corner}-resize`,
            }}
            onPointerDown={onAdjustPointerDownResize(corner)}
          />
        ))}
      </div>
    </div>
  );
}
