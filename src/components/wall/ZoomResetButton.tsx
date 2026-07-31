"use client";

import { useWallSceneStore } from "@/stores/wall-scene-store";

export default function ZoomResetButton() {
  const userZoom = useWallSceneStore((s) => s.userZoom);
  const panX = useWallSceneStore((s) => s.panX);
  const panY = useWallSceneStore((s) => s.panY);
  const resetUserZoom = useWallSceneStore((s) => s.resetUserZoom);

  const zoomed = Math.abs(userZoom - 1) >= 0.01;
  const panned = Math.abs(panX) >= 1 || Math.abs(panY) >= 1;
  if (!zoomed && !panned) return null;

  const pct = Math.round(userZoom * 100);

  return (
    <button
      type="button"
      onClick={resetUserZoom}
      className="rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium text-foreground/90 shadow-sm ring-1 ring-foreground/10 transition active:scale-95"
      aria-label="줌 리셋"
    >
      {pct}%
    </button>
  );
}
