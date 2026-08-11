"use client";

import { useEffect, useMemo, useState } from "react";
import type { PixiWallEngine } from "@/components/wall/pixi/pixi-wall-engine";
import type { WallBounds } from "@/lib/wall-bounds";
import {
  createKonvaViewportAdapter,
  createPixiViewportAdapter,
  type WallViewportAdapter,
} from "@/lib/wall-scene/wall-viewport-adapter";
import { useWallSceneStore } from "@/stores/wall-scene-store";

export function useWallViewportAdapter(options: {
  pixiEngine: PixiWallEngine | null;
  wallStageRef: React.RefObject<HTMLDivElement | null>;
  wallBounds: WallBounds;
  stageReady?: boolean;
}): WallViewportAdapter | null {
  const panX = useWallSceneStore((s) => s.panX);
  const panY = useWallSceneStore((s) => s.panY);
  const viewportScale = useWallSceneStore((s) => s.viewportScale);
  const [pixiTick, setPixiTick] = useState(0);

  useEffect(() => {
    if (!options.pixiEngine) return;
    const vp = options.pixiEngine.viewport;
    const bump = () => setPixiTick((n) => n + 1);
    vp.on("moved", bump);
    vp.on("zoomed", bump);
    return () => {
      vp.off("moved", bump);
      vp.off("zoomed", bump);
    };
  }, [options.pixiEngine]);

  return useMemo(() => {
    void pixiTick;
    if (options.pixiEngine) {
      return createPixiViewportAdapter(options.pixiEngine);
    }
    const wallStageEl = options.wallStageRef.current;
    if (wallStageEl && options.stageReady !== false) {
      return createKonvaViewportAdapter({
        wallStage: wallStageEl,
        wallBounds: options.wallBounds,
        getScale: () => useWallSceneStore.getState().viewportScale,
        subscribeViewport: (listener) =>
          useWallSceneStore.subscribe((state, prev) => {
            if (
              state.panX !== prev.panX ||
              state.panY !== prev.panY ||
              state.viewportScale !== prev.viewportScale
            ) {
              listener();
            }
          }),
      });
    }
    return null;
  }, [
    options.pixiEngine,
    options.wallStageRef,
    options.wallBounds,
    options.stageReady,
    panX,
    panY,
    viewportScale,
    pixiTick,
  ]);
}
