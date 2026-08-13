import type { PhotoDecoration, PhotoDecoSlot, WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoFrame } from "./catalog";

const SLOTS = new Set<PhotoDecoSlot>(["tl", "tr", "bl", "br"]);

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeDecoration(raw: PhotoDecoration): PhotoDecoration | null {
  if (!raw || typeof raw.stickerId !== "string" || !raw.stickerId.trim()) return null;
  if (!SLOTS.has(raw.slot)) return null;
  const next: PhotoDecoration = {
    stickerId: raw.stickerId.trim(),
    slot: raw.slot,
  };
  const dx = finiteOr(raw.dx, 0);
  const dy = finiteOr(raw.dy, 0);
  const scale = finiteOr(raw.scale, 1);
  if (dx) next.dx = dx;
  if (dy) next.dy = dy;
  if (scale !== 1 && scale > 0) next.scale = scale;
  return next;
}

/** Shape-only. Unknown catalog ids are kept so lazy sticker packs can load later. */
export function sanitizePhotoDecorFields(object: WallSceneObject): WallSceneObject {
  if (object.type !== "photo") return object;
  const photo = object as WallScenePhoto;
  let changed = false;
  let frameId = photo.frameId;
  if (frameId != null) {
    if (typeof frameId !== "string" || !frameId.trim()) {
      frameId = undefined;
      changed = true;
    } else {
      const trimmed = frameId.trim();
      if (trimmed !== frameId) {
        frameId = trimmed;
        changed = true;
      }
      // Drop only if the catalog is loaded and definitely has no such frame.
      // Matte/slice9 ids are all in PHOTO_FRAMES (eager), so unknown ids go away.
      if (!getPhotoFrame(trimmed)) {
        frameId = undefined;
        changed = true;
      }
    }
  }

  let decorations = photo.decorations;
  if (decorations != null) {
    if (!Array.isArray(decorations)) {
      decorations = undefined;
      changed = true;
    } else {
      const cleaned: PhotoDecoration[] = [];
      const seen = new Set<PhotoDecoSlot>();
      for (const item of decorations) {
        const next = sanitizeDecoration(item);
        if (!next || seen.has(next.slot)) {
          changed = true;
          continue;
        }
        seen.add(next.slot);
        cleaned.push(next);
      }
      if (cleaned.length === 0) {
        decorations = undefined;
        changed = true;
      } else if (cleaned.length !== decorations.length) {
        decorations = cleaned;
        changed = true;
      } else {
        decorations = cleaned;
      }
    }
  }

  if (!changed) return object;
  const next: WallScenePhoto = { ...photo };
  if (frameId) next.frameId = frameId;
  else delete next.frameId;
  if (decorations?.length) next.decorations = decorations;
  else delete next.decorations;
  return next;
}
