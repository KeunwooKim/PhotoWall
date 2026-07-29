"use client";

import { useWallSceneStore } from "@/stores/wall-scene-store";

export default function ZoomResetButton() {
  const userZoom = useWallSceneStore((s) => s.userZoom);
  const resetUserZoom = useWallSceneStore((s) => s.resetUserZoom);

  if (Math.abs(userZoom - 1) < 0.01) return null;

  const pct = Math.round(userZoom * 100);

  return (
    <button
      type="button"
      onClick={resetUserZoom}
      className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm ring-1 ring-black/8 transition active:scale-95"
      aria-label="줌 리셋"
    >
      {pct}%
    </button>
  );
}
