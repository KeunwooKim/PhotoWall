import { getStickerById } from "@/lib/stickers";
import { isStraightHighlighterPath } from "@/lib/wall-scene/highlighter";
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
    case "text":
      return object.text?.slice(0, 12) || "텍스트";
    case "tape":
      return "테이프";
    case "path":
      if (object.tool === "pen" || !isStraightHighlighterPath(object.points)) {
        return "펜";
      }
      return "마스킹 테이프";
    case "svg":
      return "SVG";
    default:
      return "요소";
  }
}
