import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWallScene, serializeWallScene } from "@/lib/wall-scene/fabric-import";
import type { WallScenePhoto } from "@/types/wall-scene-v2";

/** Append a guestbook photo to v2 scene (or migrate legacy Fabric JSON first). */
export function appendGuestbookPhoto(
  canvasJson: object,
  imageDataUrl: string,
  imageWidth: number,
  imageHeight: number,
): object {
  const doc = parseWallScene(canvasJson);
  const { wallBounds } = doc.meta;

  const maxWidth = Math.min(220, wallBounds.width * 0.35);
  const scale = Math.min(1, maxWidth / Math.max(imageWidth, imageHeight, 1));
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  const x = wallBounds.width * 0.2 + Math.random() * (wallBounds.width * 0.2);
  const y = wallBounds.height * 0.15 + Math.random() * (wallBounds.height * 0.2);
  const maxZ = doc.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const photo: WallScenePhoto = {
    id: crypto.randomUUID(),
    type: "photo",
    x: x - width / 2,
    y: y - height / 2,
    rotation: -8 + Math.random() * 16,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    src: imageDataUrl,
    width,
    height,
    source: "guestbook",
  };

  return serializeWallScene({
    ...doc,
    meta: { ...doc.meta, revision: doc.meta.revision + 1 },
    objects: [...doc.objects, photo],
  });
}

/**
 * Remove guestbook embeds from canvas.
 * Prefer `source: "guestbook"`; optionally also strip unmarked data: photos.
 */
export function scrubGuestbookPhotosFromCanvas(
  canvasJson: unknown,
  opts: { includeUnmarkedDataUrls?: boolean } = {},
): { canvas: object; removed: number } | null {
  if (!canvasJson || typeof canvasJson !== "object") return null;

  const doc = parseWallScene(canvasJson as object);
  const before = doc.objects.length;
  const next = doc.objects.filter((obj) => {
    if (obj.type !== "photo") return true;
    const photo = obj as WallScenePhoto;
    if (photo.source === "guestbook") return false;
    if (
      opts.includeUnmarkedDataUrls &&
      typeof photo.src === "string" &&
      photo.src.startsWith("data:")
    ) {
      return false;
    }
    return true;
  });

  const removed = before - next.length;
  if (removed === 0) {
    return { canvas: canvasJson as object, removed: 0 };
  }

  return {
    canvas: serializeWallScene({
      ...doc,
      meta: { ...doc.meta, revision: doc.meta.revision + 1 },
      objects: next,
    }),
    removed,
  };
}

export async function scrubWallGuestbook(
  admin: SupabaseClient,
  wallId: string,
  opts: { includeUnmarkedDataUrls?: boolean; deleteRows?: boolean } = {},
): Promise<{ removedObjects: number; deletedRows: number }> {
  const { data: wall, error } = await admin
    .from("walls")
    .select("id, canvas_json")
    .eq("id", wallId)
    .maybeSingle();

  if (error || !wall) {
    throw new Error(error?.message ?? "벽을 찾을 수 없어요");
  }

  const scrubbed = scrubGuestbookPhotosFromCanvas(wall.canvas_json, {
    includeUnmarkedDataUrls: opts.includeUnmarkedDataUrls,
  });

  let removedObjects = 0;
  if (scrubbed && scrubbed.removed > 0) {
    const { error: updateError } = await admin
      .from("walls")
      .update({ canvas_json: scrubbed.canvas, updated_at: new Date().toISOString() })
      .eq("id", wallId);
    if (updateError) throw new Error(updateError.message);
    removedObjects = scrubbed.removed;
  }

  let deletedRows = 0;
  if (opts.deleteRows !== false) {
    const { data: rows, error: delError } = await admin
      .from("wall_guestbook")
      .delete()
      .eq("wall_id", wallId)
      .select("id");
    if (delError) throw new Error(delError.message);
    deletedRows = rows?.length ?? 0;
  }

  return { removedObjects, deletedRows };
}
