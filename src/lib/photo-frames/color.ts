export function cssHexToNumber(hex: string): number {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  return Number.isFinite(n) ? n : 0xffffff;
}

export function cssHexToRgba(hex: string, alpha = 1): string {
  const n = cssHexToNumber(hex);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
