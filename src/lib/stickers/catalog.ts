import type { StickerDefinition, StickerPack } from "./types";
import { preferWebpSrc } from "@/lib/optimized-image-src";
import {
  ensureStickersForIds,
  getCachedStickerById,
  getLoadedStickerPack,
  getStickerPackShells,
  loadStickerPack,
  packIdForStickerId,
  preloadDefaultStickerPack,
  STICKER_PACK_META,
} from "./catalog-loaders";
import { getInstalledUgcPacks, getUgcStickerById } from "./ugc-registry";

/** Pack shells (no generated catalogs in the main bundle). */
export const STICKER_PACKS: StickerPack[] = STICKER_PACK_META.map((meta) => ({
  ...meta,
  stickers: [],
  categories: [],
}));

export { preloadDefaultStickerPack, loadStickerPack, ensureStickersForIds };

export function getStickerById(id: string): StickerDefinition | undefined {
  const cached = getCachedStickerById(id);
  if (cached) return cached;
  const ugc = getUgcStickerById(id);
  if (ugc) return ugc;
  const packId = packIdForStickerId(id);
  if (packId) {
    void loadStickerPack(packId);
  }
  return undefined;
}

/** Packs visible in the picker — shells + any loaded pack data + UGC. */
export function getStickerPacks(options?: { includeSeasonal?: boolean }): StickerPack[] {
  const includeSeasonal = options?.includeSeasonal ?? true;

  const builtIn = STICKER_PACK_META.filter((pack) => {
    if (!pack.availableFrom && !pack.availableTo) return true;
    return includeSeasonal;
  }).map((meta) => getLoadedStickerPack(meta.id) ?? { ...meta, stickers: [], categories: [] });

  return [...builtIn, ...getInstalledUgcPacks()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getStickerPreviewSrc(sticker: StickerDefinition): string {
  if (sticker.kind === "emoji") return sticker.src;
  return preferWebpSrc(sticker.src);
}

export { getStickerPackShells };
