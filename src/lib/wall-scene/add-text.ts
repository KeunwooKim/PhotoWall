import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneText } from "@/types/wall-scene-v2";
import { TEXT_FONT_FAMILIES } from "@/lib/fonts/wall-text-fonts";

export { TEXT_FONT_FAMILIES };

export const TEXT_COLORS = [
  "#171717",
  "#ffffff",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#9333ea",
  "#db2777",
] as const;

export const TEXT_SIZE_PRESETS = [24, 36, 48, 64, 80] as const;

export const DEFAULT_TEXT_WIDTH = 220;
export const DEFAULT_TEXT_FONT_SIZE = 36;
export const DEFAULT_TEXT_FILL = "#171717";
export const DEFAULT_TEXT_FONT_FAMILY = TEXT_FONT_FAMILIES[0].value;

export function addTextToWallScene(options: {
  x: number;
  y: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  width?: number;
}): WallSceneText {
  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const width = options.width ?? DEFAULT_TEXT_WIDTH;
  const fontSize = options.fontSize ?? DEFAULT_TEXT_FONT_SIZE;

  const textObject: WallSceneText = {
    id: crypto.randomUUID(),
    type: "text",
    x: options.x - width / 2,
    y: options.y - fontSize / 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    text: options.text ?? "텍스트",
    fontSize,
    fontFamily: options.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
    fill: options.fill ?? DEFAULT_TEXT_FILL,
    width,
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(textObject);
  useWallSceneStore.getState().setSelectedIds([textObject.id]);
  useWallSceneStore.getState().bumpRevision();
  return textObject;
}

export function updateTextObject(
  id: string,
  patch: Partial<Pick<WallSceneText, "text" | "fontSize" | "fontFamily" | "fill" | "width">>,
): void {
  const current = useWallSceneStore.getState().document.objects.find((o) => o.id === id);
  if (!current || current.type !== "text") return;

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject({ ...current, ...patch });
  useWallSceneStore.getState().bumpRevision();
}
