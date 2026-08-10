/** Shared helpers for admin dashboard aggregates. */

export type DayKey = string; // YYYY-MM-DD (local calendar)

export type DayBucket = {
  date: DayKey;
  users: number;
  walls: number;
  inquiries: number;
  importOk: number;
  importFail: number;
  activeEditors: number;
};

export function startOfLocalDay(d = new Date()): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function toDayKey(d: Date): DayKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayKeyFromIso(iso: string): DayKey | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return toDayKey(new Date(t));
}

/** Inclusive local calendar window: today and the previous (days-1) days. */
export function lastNDayKeys(days: number, from = new Date()): DayKey[] {
  const start = startOfLocalDay(from);
  const keys: DayKey[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(start.getDate() - i);
    keys.push(toDayKey(d));
  }
  return keys;
}

export function emptyBuckets(days: number): DayBucket[] {
  return lastNDayKeys(days).map((date) => ({
    date,
    users: 0,
    walls: 0,
    inquiries: 0,
    importOk: 0,
    importFail: 0,
    activeEditors: 0,
  }));
}

export function countByDay(
  rows: { created_at?: string | null }[] | null | undefined,
): Map<DayKey, number> {
  const map = new Map<DayKey, number>();
  for (const row of rows ?? []) {
    if (!row.created_at) continue;
    const key = dayKeyFromIso(row.created_at);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/** Distinct owner_id per local day from wall updates. */
export function distinctOwnersByDay(
  rows: { owner_id?: string | null; updated_at?: string | null }[] | null | undefined,
): Map<DayKey, Set<string>> {
  const map = new Map<DayKey, Set<string>>();
  for (const row of rows ?? []) {
    if (!row.owner_id || !row.updated_at) continue;
    const key = dayKeyFromIso(row.updated_at);
    if (!key) continue;
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(row.owner_id);
  }
  return map;
}

export function mergeSeries(args: {
  days: number;
  users: Map<DayKey, number>;
  walls: Map<DayKey, number>;
  inquiries: Map<DayKey, number>;
  importOk: Map<DayKey, number>;
  importFail: Map<DayKey, number>;
  activeEditors: Map<DayKey, Set<string>>;
}): DayBucket[] {
  return emptyBuckets(args.days).map((bucket) => ({
    ...bucket,
    users: args.users.get(bucket.date) ?? 0,
    walls: args.walls.get(bucket.date) ?? 0,
    inquiries: args.inquiries.get(bucket.date) ?? 0,
    importOk: args.importOk.get(bucket.date) ?? 0,
    importFail: args.importFail.get(bucket.date) ?? 0,
    activeEditors: args.activeEditors.get(bucket.date)?.size ?? 0,
  }));
}
