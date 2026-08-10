"use client";

import { useEffect, useRef } from "react";
import { loadWallViewport } from "@/lib/wall-scene/wall-viewport-storage";
import { useWallSceneStore } from "@/stores/wall-scene-store";

/**
 * Restore pan/zoom per wallId from localStorage before the stage boots.
 * Saves are handled by PixiWallStage (live Pixi camera → localStorage).
 */
export function usePersistWallViewport(wallId: string, _enabled: boolean): void {
  const restoredForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!wallId) return;
    if (restoredForRef.current === wallId) return;
    restoredForRef.current = wallId;
    const snap = loadWallViewport(wallId);
    if (snap) {
      useWallSceneStore.getState().setCamera(snap);
    }
  }, [wallId]);
}
