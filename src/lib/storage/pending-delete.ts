import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin/service-client";
import {
  WALL_PHOTOS_BUCKET,
  collectWallPhotoPathsFromCanvas,
} from "@/lib/storage/wall-photos";
import {
  collectReferencedWallPhotoPaths,
  removeStoragePaths,
} from "@/lib/storage/orphan-sweep";

/** Grace period after last enqueue before Storage delete. */
export const STORAGE_PENDING_DELETE_MS = 24 * 60 * 60 * 1000;

export function pathsRemovedBetweenCanvases(
  previousCanvas: unknown,
  nextCanvas: unknown,
): string[] {
  const before = new Set(collectWallPhotoPathsFromCanvas(previousCanvas));
  const after = new Set(collectWallPhotoPathsFromCanvas(nextCanvas));
  const removed: string[] = [];
  for (const path of before) {
    if (!after.has(path)) removed.push(path);
  }
  return removed;
}

/** Cancel GC if path is used again on a saved wall. */
export async function cancelPendingDeletesForPaths(
  admin: SupabaseClient,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    await admin.from("storage_pending_delete").delete().in("path", chunk);
  }
}

/**
 * After a successful wall save: keep paths still on this canvas out of the queue;
 * enqueue paths that disappeared and are not referenced by any wall.
 */
export async function schedulePhotoGcAfterWallSave(opts: {
  previousCanvas: unknown;
  nextCanvas: unknown;
  wallId: string;
}): Promise<{ enqueued: number; cancelled: number }> {
  const admin = createAdminClient();
  if (!admin) return { enqueued: 0, cancelled: 0 };

  const nextPaths = collectWallPhotoPathsFromCanvas(opts.nextCanvas);
  let cancelled = 0;
  if (nextPaths.length > 0) {
    await cancelPendingDeletesForPaths(admin, nextPaths);
    cancelled = nextPaths.length;
  }

  const removed = pathsRemovedBetweenCanvases(opts.previousCanvas, opts.nextCanvas);
  if (removed.length === 0) return { enqueued: 0, cancelled };

  let referenced: Set<string>;
  try {
    referenced = await collectReferencedWallPhotoPaths(admin);
  } catch (err) {
    console.warn("[storage-gc] reference scan failed:", err);
    return { enqueued: 0, cancelled };
  }

  const orphans = removed.filter((p) => !referenced.has(p));
  if (orphans.length === 0) return { enqueued: 0, cancelled };

  const deleteAfter = new Date(Date.now() + STORAGE_PENDING_DELETE_MS).toISOString();
  const now = new Date().toISOString();
  const rows = orphans.map((path) => ({
    path,
    wall_id: opts.wallId,
    enqueued_at: now,
    delete_after: deleteAfter,
    reason: "canvas_save_unreferenced",
  }));

  const { error } = await admin.from("storage_pending_delete").upsert(rows, {
    onConflict: "path",
  });
  if (error) {
    console.warn("[storage-gc] enqueue failed:", error.message);
    return { enqueued: 0, cancelled };
  }

  return { enqueued: orphans.length, cancelled };
}

/** Fire-and-forget wrapper for save handlers. */
export function voidSchedulePhotoGcAfterWallSave(opts: {
  previousCanvas: unknown;
  nextCanvas: unknown;
  wallId: string;
}): void {
  void schedulePhotoGcAfterWallSave(opts).catch((err) => {
    console.warn("[storage-gc] schedule failed:", err);
  });
}

export async function processDuePendingDeletes(
  admin: SupabaseClient,
  limit = 200,
): Promise<{ deleted: number; skipped: number; errors: number }> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await admin
    .from("storage_pending_delete")
    .select("path")
    .lte("delete_after", nowIso)
    .order("delete_after", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!due?.length) return { deleted: 0, skipped: 0, errors: 0 };

  const paths = due.map((r) => r.path as string);
  let referenced: Set<string>;
  try {
    referenced = await collectReferencedWallPhotoPaths(admin);
  } catch {
    return { deleted: 0, skipped: paths.length, errors: 1 };
  }

  const toDelete = paths.filter((p) => !referenced.has(p));
  const toSkip = paths.filter((p) => referenced.has(p));

  if (toSkip.length > 0) {
    await cancelPendingDeletesForPaths(admin, toSkip);
  }

  let deleted = 0;
  let errors = 0;
  if (toDelete.length > 0) {
    try {
      deleted = await removeStoragePaths(admin, toDelete);
      await cancelPendingDeletesForPaths(admin, toDelete);
    } catch (err) {
      console.warn("[storage-gc] remove failed:", err);
      errors += 1;
    }
  }

  return { deleted, skipped: toSkip.length, errors };
}

export async function countPendingDeletes(admin: SupabaseClient): Promise<{
  total: number;
  due: number;
} | null> {
  const nowIso = new Date().toISOString();
  const [totalRes, dueRes] = await Promise.all([
    admin.from("storage_pending_delete").select("path", { count: "exact", head: true }),
    admin
      .from("storage_pending_delete")
      .select("path", { count: "exact", head: true })
      .lte("delete_after", nowIso),
  ]);
  if (totalRes.error || dueRes.error) return null;
  return { total: totalRes.count ?? 0, due: dueRes.count ?? 0 };
}

export { WALL_PHOTOS_BUCKET };
