export const STICKER_ASSETS_BUCKET = "sticker-assets";

export const STICKER_PACK_MIN_ITEMS = 8;
export const STICKER_PACK_MAX_ITEMS = 24;
export const STICKER_ITEM_MAX_BYTES = 512 * 1024;
export const STICKER_ITEM_ALLOWED_MIME = new Set(["image/png", "image/webp"]);

export type StickerPackStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "taken_down";

export type StickerPackRow = {
  id: string;
  creator_id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string | null;
  status: StickerPackStatus;
  reject_reason: string | null;
  cover_path: string | null;
  sticker_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type StickerPackItemRow = {
  id: string;
  pack_id: string;
  sort_order: number;
  name: string;
  storage_path: string;
  width: number;
  height: number;
  created_at: string;
};

export function ugcStickerId(packId: string, itemId: string): string {
  return `ugc.${packId}.${itemId}`;
}

export function parseUgcStickerId(
  stickerId: string,
): { packId: string; itemId: string } | null {
  if (!stickerId.startsWith("ugc.")) return null;
  const parts = stickerId.split(".");
  if (parts.length !== 3) return null;
  const [, packId, itemId] = parts;
  if (!packId || !itemId) return null;
  return { packId, itemId };
}

export function slugifyPackName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `pack-${Date.now().toString(36)}`;
}

/** Placement size capped like built-in stickers (max side 120). */
export function placementSizeFromNatural(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  const maxSide = 120;
  const minSide = 32;
  const w = Math.max(1, naturalWidth);
  const h = Math.max(1, naturalHeight);
  let width = Math.round((w * maxSide) / Math.max(w, h));
  let height = Math.round((h * maxSide) / Math.max(w, h));
  if (width < minSide || height < minSide) {
    const boost = minSide / Math.min(width, height);
    width = Math.round(width * boost);
    height = Math.round(height * boost);
  }
  return {
    width: Math.max(minSide, width),
    height: Math.max(minSide, height),
  };
}
