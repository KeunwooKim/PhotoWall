export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "photowall-theme";

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
