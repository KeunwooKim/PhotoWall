"use client";

import { useEffect, useRef } from "react";
import { Graphics } from "pixi.js";
import { getEffectiveWallBounds } from "@/lib/wall-scene/wall-drag-expand";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PixiWallEngine } from "./pixi-wall-engine";

/** Draw snap guides into the Pixi overlay layer. */
export function usePixiSnapGuides(engine: PixiWallEngine | null): void {
  const guides = useWallSceneStore((s) => s.snapGuides);
  const gfxRef = useRef<Graphics | null>(null);

  useEffect(() => {
    if (!engine) return;
    if (!gfxRef.current) {
      const g = new Graphics();
      g.eventMode = "none";
      engine.overlayLayer.addChild(g);
      gfxRef.current = g;
    }
    const g = gfxRef.current;
    const wall = getEffectiveWallBounds();
    g.clear();
    for (const guide of guides) {
      if (guide.orientation === "horizontal") {
        g.moveTo(0, guide.position);
        g.lineTo(wall.width, guide.position);
      } else {
        g.moveTo(guide.position, 0);
        g.lineTo(guide.position, wall.height);
      }
      g.stroke({ width: 1, color: 0xf43f5e, alpha: 0.9 });
    }
  }, [engine, guides]);

  useEffect(() => {
    return () => {
      gfxRef.current?.destroy();
      gfxRef.current = null;
    };
  }, [engine]);
}
