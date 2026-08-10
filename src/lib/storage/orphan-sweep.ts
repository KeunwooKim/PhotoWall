import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WALL_PHOTOS_BUCKET,
  collectWallPhotoPathsFromCanvas,
} from "@/lib/storage/wall-photos";

export type StorageFileEntry = {
  path: string;
  updatedAt: string | null;
};

const LIST_PAGE = 100;
/** Orphans newer than this are kept (in-flight uploads / race with saves). */
export const ORPHAN_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function listPrefix(
  admin: SupabaseClient,
  prefix: string,
): Promise<StorageFileEntry[]> {
  const out: StorageFileEntry[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage.from(WALL_PHOTOS_BUCKET).list(prefix, {
      limit: LIST_PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const item of data) {
      const name = item.name;
      if (!name || name === ".emptyFolderPlaceholder") continue;
      const fullPath = prefix ? `${prefix}/${name}` : name;
      // Folders have null id / no metadata in some API versions — recurse when no size/metadata
      const isFile = Boolean(item.id) || Boolean(item.metadata);
      if (!isFile && !item.metadata) {
        // Heuristic: recurse into subfolders (userId, previews)
        const nested = await listPrefix(admin, fullPath);
        out.push(...nested);
        continue;
      }
      if (item.id || item.metadata) {
        out.push({
          path: fullPath,
          updatedAt: item.updated_at ?? item.created_at ?? null,
        });
      }
    }

    if (data.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }

  return out;
}

/** List all objects under wall-photos (user folders at root). */
export async function listAllWallPhotoFiles(
  admin: SupabaseClient,
): Promise<StorageFileEntry[]> {
  const { data: roots, error } = await admin.storage.from(WALL_PHOTOS_BUCKET).list("", {
    limit: LIST_PAGE,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(error.message);

  const files: StorageFileEntry[] = [];
  for (const root of roots ?? []) {
    if (!root.name || root.name === ".emptyFolderPlaceholder") continue;
    if (root.id || root.metadata) {
      files.push({
        path: root.name,
        updatedAt: root.updated_at ?? root.created_at ?? null,
      });
    } else {
      files.push(...(await listPrefix(admin, root.name)));
    }
  }
  return files;
}

export async function collectReferencedWallPhotoPaths(
  admin: SupabaseClient,
): Promise<Set<string>> {
  const referenced = new Set<string>();
  const pageSize = 200;
  let from = 0;

  for (;;) {
    const { data, error } = await admin
      .from("walls")
      .select("canvas_json, preview_path")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      for (const p of collectWallPhotoPathsFromCanvas(row.canvas_json)) {
        referenced.add(p);
      }
      if (typeof row.preview_path === "string" && row.preview_path) {
        referenced.add(row.preview_path);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return referenced;
}

export function filterOrphanCandidates(
  files: StorageFileEntry[],
  referenced: Set<string>,
  now = Date.now(),
): StorageFileEntry[] {
  return files.filter((f) => {
    if (referenced.has(f.path)) return false;
    if (!f.updatedAt) return true;
    const age = now - new Date(f.updatedAt).getTime();
    return age >= ORPHAN_MIN_AGE_MS;
  });
}

export async function removeStoragePaths(
  admin: SupabaseClient,
  paths: string[],
): Promise<number> {
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error } = await admin.storage.from(WALL_PHOTOS_BUCKET).remove(chunk);
    if (error) throw new Error(error.message);
    removed += chunk.length;
  }
  return removed;
}

export async function scanOrphanWallPhotos(admin: SupabaseClient) {
  const [files, referenced] = await Promise.all([
    listAllWallPhotoFiles(admin),
    collectReferencedWallPhotoPaths(admin),
  ]);
  const orphans = filterOrphanCandidates(files, referenced);
  return {
    totalFiles: files.length,
    referenced: referenced.size,
    orphanCount: orphans.length,
    orphans: orphans.slice(0, 200),
  };
}
