import type { WallSceneObject } from "@/types/wall-scene-v2";

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function objectBounds(obj: WallSceneObject): ViewportRect {
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;

  if (obj.type === "photo" || obj.type === "svg" || obj.type === "tape") {
    return {
      x: obj.x,
      y: obj.y,
      width: obj.width * scaleX,
      height: obj.height * scaleY,
    };
  }

  if (obj.type === "emoji") {
    const size = obj.fontSize * Math.max(scaleX, scaleY);
    return { x: obj.x, y: obj.y, width: size, height: size };
  }

  if (obj.type === "path" && obj.points.length >= 2) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < obj.points.length; i += 2) {
      minX = Math.min(minX, obj.points[i] + obj.x);
      minY = Math.min(minY, obj.points[i + 1] + obj.y);
      maxX = Math.max(maxX, obj.points[i] + obj.x);
      maxY = Math.max(maxY, obj.points[i + 1] + obj.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  return { x: obj.x, y: obj.y, width: 1, height: 1 };
}

function intersects(a: ViewportRect, b: ViewportRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Skip rendering objects outside the visible viewport (+padding). */
export function cullObjectsForViewport(
  objects: WallSceneObject[],
  viewport: ViewportRect,
  padding = 80,
): WallSceneObject[] {
  const padded: ViewportRect = {
    x: viewport.x - padding,
    y: viewport.y - padding,
    width: viewport.width + padding * 2,
    height: viewport.height + padding * 2,
  };

  return objects.filter((obj) => intersects(objectBounds(obj), padded));
}
