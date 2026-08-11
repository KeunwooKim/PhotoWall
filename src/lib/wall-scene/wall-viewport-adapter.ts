import type { PixiWallEngine } from "@/components/wall/pixi/pixi-wall-engine";
import type { WallBounds } from "@/lib/wall-bounds";

export type WallViewportAdapter = {
  toScreen: (world: { x: number; y: number }) => { x: number; y: number };
  toWorld: (clientX: number, clientY: number) => { x: number; y: number };
  getScale: () => number;
  subscribe: (listener: () => void) => () => void;
};

export function createPixiViewportAdapter(engine: PixiWallEngine): WallViewportAdapter {
  const vp = engine.viewport;
  const host = engine.app.canvas.parentElement;
  return {
    toScreen: (world) => vp.toScreen(world),
    toWorld: (clientX, clientY) => {
      if (!host) return { x: 0, y: 0 };
      const rect = host.getBoundingClientRect();
      return vp.toWorld({ x: clientX - rect.left, y: clientY - rect.top });
    },
    getScale: () => vp.scale.x,
    subscribe: (listener) => {
      vp.on("moved", listener);
      vp.on("zoomed", listener);
      return () => {
        vp.off("moved", listener);
        vp.off("zoomed", listener);
      };
    },
  };
}

export function createKonvaViewportAdapter(options: {
  wallStage: HTMLElement;
  wallBounds: WallBounds;
  getScale: () => number;
  subscribeViewport: (listener: () => void) => () => void;
}): WallViewportAdapter {
  const { wallStage, wallBounds } = options;
  const container = () => wallStage.parentElement;

  return {
    toScreen: (world) => {
      const rect = wallStage.getBoundingClientRect();
      const parent = container()?.getBoundingClientRect();
      if (!parent) {
        return { x: 0, y: 0 };
      }
      const localX = (world.x - wallBounds.x) / Math.max(1, wallBounds.width);
      const localY = (world.y - wallBounds.y) / Math.max(1, wallBounds.height);
      return {
        x: rect.left - parent.left + localX * rect.width,
        y: rect.top - parent.top + localY * rect.height,
      };
    },
    toWorld: (clientX, clientY) => {
      const rect = wallStage.getBoundingClientRect();
      const localX = (clientX - rect.left) / Math.max(1, rect.width);
      const localY = (clientY - rect.top) / Math.max(1, rect.height);
      return {
        x: wallBounds.x + localX * wallBounds.width,
        y: wallBounds.y + localY * wallBounds.height,
      };
    },
    getScale: () => options.getScale(),
    subscribe: (listener) => options.subscribeViewport(listener),
  };
}

export function worldRectToScreen(
  adapter: WallViewportAdapter,
  frame: { x: number; y: number; width: number; height: number },
): { left: number; top: number; width: number; height: number } {
  const tl = adapter.toScreen({ x: frame.x, y: frame.y });
  const br = adapter.toScreen({ x: frame.x + frame.width, y: frame.y + frame.height });
  return {
    left: Math.min(tl.x, br.x),
    top: Math.min(tl.y, br.y),
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
  };
}
