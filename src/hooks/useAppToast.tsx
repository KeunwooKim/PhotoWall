"use client";

import { useCallback, useEffect, useState } from "react";

/** Lightweight fixed toast for hub pages (home, sidebar, picker). */
export function useAppToast(durationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), durationMs);
    return () => window.clearTimeout(t);
  }, [message, durationMs]);

  const showToast = useCallback((next: string) => setMessage(next), []);

  const Toast = message ? (
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-5"
      style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
      role="status"
      aria-live="polite"
    >
      <div className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-lg">
        {message}
      </div>
    </div>
  ) : null;

  return { showToast, Toast };
}
