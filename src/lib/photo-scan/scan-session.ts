/** In-memory handoff for scan results (sessionStorage is too small for iOS JPEG data URLs). */

let pendingScanDataUrls: string[] = [];

/** Persist flattened scan data URLs for /wall/edit to consume (same-tab navigation). */
export function savePendingScans(dataUrls: string[]): void {
  if (typeof window === "undefined" || dataUrls.length === 0) return;
  pendingScanDataUrls = [...dataUrls];

  // Best-effort tiny backup — ignore quota errors on mobile Safari
  try {
    const compact = dataUrls.filter((url) => url.length < 1_500_000);
    if (compact.length > 0) {
      sessionStorage.setItem("photowall-pending-scans", JSON.stringify(compact));
    } else {
      sessionStorage.removeItem("photowall-pending-scans");
    }
  } catch {
    // ignore
  }
}

export function consumePendingScans(): string[] {
  if (typeof window === "undefined") return [];

  const fromMemory = pendingScanDataUrls;
  pendingScanDataUrls = [];

  let fromStorage: string[] = [];
  try {
    const raw = sessionStorage.getItem("photowall-pending-scans");
    sessionStorage.removeItem("photowall-pending-scans");
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        fromStorage = parsed.filter((item): item is string => typeof item === "string");
      }
    }
  } catch {
    // ignore
  }

  if (fromMemory.length > 0) return fromMemory;
  return fromStorage;
}

export function hasPendingScans(): boolean {
  return pendingScanDataUrls.length > 0;
}
