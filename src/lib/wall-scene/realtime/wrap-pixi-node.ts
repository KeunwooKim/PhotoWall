import type { Container } from "pixi.js";
import type { WallDisplayNode } from "@/lib/wall-scene/realtime/wall-display-node";

const DEG = Math.PI / 180;

/**
 * Wrap a Pixi Container as WallDisplayNode (rotation stored in degrees on the wall model).
 */
export function wrapPixiContainer(container: Container, objectId: string): WallDisplayNode {
  return {
    id: () => objectId,
    x: () => container.x,
    y: () => container.y,
    position: (pos) => {
      container.x = pos.x;
      container.y = pos.y;
    },
    rotation: ((value?: number) => {
      if (value === undefined) return container.rotation / DEG;
      container.rotation = value * DEG;
      return value;
    }) as WallDisplayNode["rotation"],
    scaleX: ((value?: number) => {
      if (value === undefined) return container.scale.x;
      container.scale.x = value;
      return value;
    }) as WallDisplayNode["scaleX"],
    scaleY: ((value?: number) => {
      if (value === undefined) return container.scale.y;
      container.scale.y = value;
      return value;
    }) as WallDisplayNode["scaleY"],
    destroy: () => {
      container.destroy({ children: true });
    },
  };
}
