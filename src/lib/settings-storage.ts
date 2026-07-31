import {
  DEFAULT_COLOR_PALETTE,
  isColorPaletteId,
  type ColorPaletteId,
} from "@/lib/color-palettes";

export type ThemeMode = "light" | "dark" | "system";
export type { ColorPaletteId };

const THEME_KEY = "photowall-theme";
const PALETTE_KEY = "photowall-palette";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function setStoredTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, mode);
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredPalette(): ColorPaletteId {
  if (typeof window === "undefined") return DEFAULT_COLOR_PALETTE;
  const stored = localStorage.getItem(PALETTE_KEY);
  return isColorPaletteId(stored) ? stored : DEFAULT_COLOR_PALETTE;
}

export function setStoredPalette(palette: ColorPaletteId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PALETTE_KEY, palette);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemeMode(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : "system";
}

export function parseColorPalette(value: unknown): ColorPaletteId {
  return isColorPaletteId(value) ? value : DEFAULT_COLOR_PALETTE;
}

export function applyPaletteToDocument(palette: ColorPaletteId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", palette);
}
