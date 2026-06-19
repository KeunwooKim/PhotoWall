const STORAGE_KEY = "photowall-pending-imports";

export function savePendingImports(dataUrls: string[]): void {
  if (typeof window === "undefined" || dataUrls.length === 0) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataUrls));
}

export function consumePendingImports(): string[] {
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
