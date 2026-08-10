import type Konva from "konva";
import type { WallDisplayNode } from "@/lib/wall-scene/realtime/wall-display-node";

/** Adapt a Konva Group/Node to WallDisplayNode without changing runtime behavior. */
export function wrapKonvaNode(node: Konva.Node): WallDisplayNode {
  return {
    id: () => node.id(),
    x: () => node.x(),
    y: () => node.y(),
    position: (pos) => {
      node.position(pos);
    },
    rotation: ((value?: number) => {
      if (value === undefined) return node.rotation();
      node.rotation(value);
      return value;
    }) as WallDisplayNode["rotation"],
    scaleX: ((value?: number) => {
      if (value === undefined) return node.scaleX();
      node.scaleX(value);
      return value;
    }) as WallDisplayNode["scaleX"],
    scaleY: ((value?: number) => {
      if (value === undefined) return node.scaleY();
      node.scaleY(value);
      return value;
    }) as WallDisplayNode["scaleY"],
    destroy: () => {
      node.destroy();
    },
    requestRedraw: () => {
      node.getLayer()?.batchDraw();
    },
  };
}
