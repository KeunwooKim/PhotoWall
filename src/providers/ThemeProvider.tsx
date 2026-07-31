"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_COLOR_PALETTE, type ColorPaletteId } from "@/lib/color-palettes";
import { authFetch } from "@/lib/auth/api-fetch";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/types/profile";
import {
  applyPaletteToDocument,
  getStoredPalette,
  getStoredTheme,
  resolveTheme,
  setStoredPalette,
  setStoredTheme,
  type ThemeMode,
} from "@/lib/settings-storage";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  palette: ColorPaletteId;
  setPalette: (palette: ColorPaletteId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [palette, setPaletteState] = useState<ColorPaletteId>(DEFAULT_COLOR_PALETTE);
  const syncedUserIdRef = useRef<string | null>(null);

  const applyTheme = useCallback((nextMode: ThemeMode) => {
    const nextResolved = resolveTheme(nextMode);
    setResolved(nextResolved);
    document.documentElement.classList.toggle("dark", nextResolved === "dark");
  }, []);

  const applyLocal = useCallback(
    (nextMode: ThemeMode, nextPalette: ColorPaletteId) => {
      setModeState(nextMode);
      setPaletteState(nextPalette);
      setStoredTheme(nextMode);
      setStoredPalette(nextPalette);
      applyPaletteToDocument(nextPalette);
      applyTheme(nextMode);
    },
    [applyTheme],
  );

  // Boot from localStorage (ThemeScript already painted)
  useEffect(() => {
    const stored = getStoredTheme();
    const storedPalette = getStoredPalette();
    setModeState(stored);
    setPaletteState(storedPalette);
    applyPaletteToDocument(storedPalette);
    applyTheme(stored);
  }, [applyTheme]);

  useEffect(() => {
    if (mode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [mode, applyTheme]);

  // Pull account prefs after login; push local prefs if account still at defaults
  // and this device already customized.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current === user.id) return;
    syncedUserIdRef.current = user.id;

    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/profile");
        if (!res.ok || cancelled) return;
        const profile = (await res.json()) as Profile;
        const serverMode = profile.themeMode ?? "system";
        const serverPalette = profile.colorPalette ?? DEFAULT_COLOR_PALETTE;
        const localMode = getStoredTheme();
        const localPalette = getStoredPalette();

        const serverIsDefault = serverMode === "system" && serverPalette === DEFAULT_COLOR_PALETTE;
        const localIsCustom = localMode !== "system" || localPalette !== DEFAULT_COLOR_PALETTE;

        if (serverIsDefault && localIsCustom) {
          applyLocal(localMode, localPalette);
          await authFetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ themeMode: localMode, colorPalette: localPalette }),
          });
          return;
        }

        applyLocal(serverMode, serverPalette);
      } catch {
        // Keep local preference
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, applyLocal]);

  const persistToAccount = useCallback(
    async (next: { themeMode?: ThemeMode; colorPalette?: ColorPaletteId }) => {
      if (!user) return;
      try {
        await authFetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
      } catch {
        // localStorage already updated
      }
    },
    [user],
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setStoredTheme(next);
      applyTheme(next);
      void persistToAccount({ themeMode: next });
    },
    [applyTheme, persistToAccount],
  );

  const setPalette = useCallback(
    (next: ColorPaletteId) => {
      setPaletteState(next);
      setStoredPalette(next);
      applyPaletteToDocument(next);
      void persistToAccount({ colorPalette: next });
    },
    [persistToAccount],
  );

  const value = useMemo(
    () => ({ mode, resolved, setMode, palette, setPalette }),
    [mode, resolved, setMode, palette, setPalette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
