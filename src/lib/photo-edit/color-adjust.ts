/** Non-destructive color adjustment params (−100…100). */

export type ColorAdjustParams = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export type ColorAdjustPresetId =
  | "original"
  | "natural"
  | "vivid"
  | "warm"
  | "mono";

export const DEFAULT_COLOR_ADJUST: ColorAdjustParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
};

export const COLOR_ADJUST_PRESETS: ReadonlyArray<{
  id: ColorAdjustPresetId;
  label: string;
  params: ColorAdjustParams;
}> = [
  { id: "original", label: "원본", params: { ...DEFAULT_COLOR_ADJUST } },
  {
    id: "natural",
    label: "자연스럽게",
    params: { brightness: 6, contrast: 12, saturation: 8, warmth: 10 },
  },
  {
    id: "vivid",
    label: "선명",
    params: { brightness: 4, contrast: 22, saturation: 28, warmth: 4 },
  },
  {
    id: "warm",
    label: "따뜻하게",
    params: { brightness: 8, contrast: 8, saturation: 6, warmth: 32 },
  },
  {
    id: "mono",
    label: "흑백",
    params: { brightness: 4, contrast: 16, saturation: -100, warmth: 0 },
  },
];

export function clampColorAdjust(params: ColorAdjustParams): ColorAdjustParams {
  const clamp = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));
  return {
    brightness: clamp(params.brightness),
    contrast: clamp(params.contrast),
    saturation: clamp(params.saturation),
    warmth: clamp(params.warmth),
  };
}

export function isNeutralColorAdjust(params: ColorAdjustParams): boolean {
  return (
    params.brightness === 0 &&
    params.contrast === 0 &&
    params.saturation === 0 &&
    params.warmth === 0
  );
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Apply color adjustments in place on ImageData. */
export function applyColorAdjust(
  imageData: ImageData,
  rawParams: ColorAdjustParams,
): void {
  const params = clampColorAdjust(rawParams);
  if (isNeutralColorAdjust(params)) return;

  const { data } = imageData;
  const brightness = (params.brightness / 100) * 64;
  const contrastFactor = 1 + params.contrast / 100;
  const satFactor = 1 + params.saturation / 100;
  const warmth = (params.warmth / 100) * 36;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness
    r += brightness;
    g += brightness;
    b += brightness;

    // Contrast around mid-gray
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    // Saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * satFactor;
    g = gray + (g - gray) * satFactor;
    b = gray + (b - gray) * satFactor;

    // Warmth (push red/yellow vs blue)
    r += warmth;
    b -= warmth * 0.85;

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

export function applyColorAdjustToCanvas(
  canvas: HTMLCanvasElement,
  params: ColorAdjustParams,
): void {
  if (isNeutralColorAdjust(params)) return;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyColorAdjust(imageData, params);
  ctx.putImageData(imageData, 0, 0);
}

/** Draw source image onto a new canvas (same natural size). */
export function imageToCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
  const width =
    "naturalWidth" in source && source.naturalWidth ? source.naturalWidth : source.width;
  const height =
    "naturalHeight" in source && source.naturalHeight ? source.naturalHeight : source.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(source, 0, 0);
  return canvas;
}
