"use client";

import { useEffect, useRef } from "react";
import { Graphics } from "pixi.js";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PixiWallEngine } from "./pixi-wall-engine";

/** World-space grid overlay when "격자 보기" is on (Pixi path). */
export function usePixiWallGrid(engine: PixiWallEngine | null): void {
  const showGrid = useWallSceneStore((s) => s.showGrid);
  const gridSize = useWallSceneStore((s) => s.gridSize);
  const wallBounds = useWallSceneStore((s) => s.document.meta.wallBounds);
  const gfxRef = useRef<Graphics | null>(null);

  useEffect(() => {
    if (!engine) return;
    if (!gfxRef.current) {
      const g = new Graphics();
      g.eventMode = "none";
      g.label = "wall-grid";
      engine.world.addChild(g);
      gfxRef.current = g;
    }
    const g = gfxRef.current;
    // Keep grid above wallpaper, below scene objects.
    const wp = engine.wallpaperSprite;
    if (wp && wp.parent === engine.world) {
      const idx = engine.world.getChildIndex(wp);
      engine.world.setChildIndex(g, Math.min(idx + 1, engine.world.children.length - 1));
    } else if (g.parent === engine.world) {
      engine.world.setChildIndex(g, 0);
    }
    g.clear();
    if (!showGrid) {
      g.visible = false;
      return;
    }
    g.visible = true;

    const w = wallBounds.width;
    const h = wallBounds.height;
    const step = Math.max(8, gridSize || 20);
    const line = 0x000000;
    const alpha = 0.08;

    // Soft surface wash so grid reads over wallpaper.
    g.rect(0, 0, w, h).fill({ color: 0xf5f5f4, alpha: 0.55 });

    for (let x = 0; x <= w; x += step) {
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke({ width: 1, color: line, alpha });
    }
    for (let y = 0; y <= h; y += step) {
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke({ width: 1, color: line, alpha });
    }
  }, [engine, showGrid, gridSize, wallBounds.width, wallBounds.height]);

  useEffect(() => {
    return () => {
      if (gfxRef.current) {
        gfxRef.current.destroy();
        gfxRef.current = null;
      }
    };
  }, [engine]);
}
