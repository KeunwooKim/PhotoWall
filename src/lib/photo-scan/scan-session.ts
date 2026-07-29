const STORAGE_KEY = "photowall-pending-scans";

/** Persist flattened scan data URLs for /wall/edit to consume. */
export function savePendingScans(dataUrls: string[]): void {
  if (typeof window === "undefined" || dataUrls.length === 0) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataUrls));
}

export function consumePendingScans(): string[] {
  if (typeof window === "undefined") return [];

  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}
