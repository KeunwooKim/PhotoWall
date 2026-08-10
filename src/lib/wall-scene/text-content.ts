import type { WallSceneText } from "@/types/wall-scene-v2";

/** Soft cap for a single wall text box (Unicode code points). */
export const TEXT_MAX_LENGTH = 200;
const TEXT_LINE_HEIGHT_RATIO = 1.35;

/** Normalize newlines and enforce max length (empty → single space so Konva keeps a hit target). */
export function clampWallTextContent(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chars = [...normalized];
  const sliced = chars.slice(0, TEXT_MAX_LENGTH).join("");
  return sliced.length === 0 ? " " : sliced;
}

/** Approximate layout height for selection / culling (explicit \\n + soft wrap). */
export function estimateTextBlockHeight(
  object: Pick<WallSceneText, "text" | "fontSize" | "width">,
): number {
  const lineHeight = object.fontSize * TEXT_LINE_HEIGHT_RATIO;
  const avgCharW = Math.max(object.fontSize * 0.65, 1);
  const cols = Math.max(1, Math.floor(object.width / avgCharW));
  let lines = 0;
  for (const paragraph of object.text.split("\n")) {
    const len = Math.max([...paragraph].length, 1);
    lines += Math.ceil(len / cols);
  }
  return Math.max(lineHeight, lines * lineHeight);
}
