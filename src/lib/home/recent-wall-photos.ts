import { wallPhotoRefToPath, extractWallPhotoPathFromUrl } from "@/lib/storage/wall-photos";
import { parseWallScene } from "@/lib/wall-scene/fabric-import";

/** Newest-first storage paths from a wall scene (max `limit`). */
export function extractRecentWallPhotoPaths(
  canvasJson: unknown,
  limit = 6,
): string[] {
  if (!canvasJson || typeof canvasJson !== "object") return [];

  try {
    const doc = parseWallScene(canvasJson as object);
    const photos = doc.objects
      .filter((o) => o.type === "photo" && typeof o.src === "string")
      .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

    const paths: string[] = [];
    const seen = new Set<string>();
    for (const photo of photos) {
      const src = (photo as { src: string }).src;
      const path = wallPhotoRefToPath(src) ?? extractWallPhotoPathFromUrl(src);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      paths.push(path);
      if (paths.length >= limit) break;
    }
    return paths;
  } catch {
    return [];
  }
}
