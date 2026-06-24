import { getStickerById } from "@/lib/stickers";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export function getObjectLabel(object: WallSceneObject): string {
  switch (object.type) {
    case "photo":
      return "사진";
    case "sticker": {
      const sticker = getStickerById(object.stickerId);
      return sticker?.name ?? "스티커";
    }
    case "emoji":
      return object.text || "이모지";
    case "tape":
      return "테이프";
    case "path":
      return "형광펜";
    case "svg":
      return "SVG";
    default:
      return "요소";
  }
}
