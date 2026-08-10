const STORAGE_KEY = "photowall-board-last-seen";

export function getBoardLastSeen(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function markBoardSeen(items: { createdAt?: string }[]): void {
  if (typeof window === "undefined") return;
  let latest = Date.now();
  for (const item of items) {
    if (!item.createdAt) continue;
    const t = new Date(item.createdAt).getTime();
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(latest));
  } catch {
    // ignore
  }
}

export function countUnseenBoardItems(items: { createdAt?: string }[]): number {
  const lastSeen = getBoardLastSeen();
  return items.filter((item) => {
    if (!item.createdAt) return false;
    const t = new Date(item.createdAt).getTime();
    return Number.isFinite(t) && t > lastSeen;
  }).length;
}
