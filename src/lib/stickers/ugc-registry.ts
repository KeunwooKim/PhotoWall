import type { StickerDefinition, StickerPack } from "./types";
import { flattenPackStickers } from "./types";
import { toPublicSupabaseUrl, getSupabaseEnv } from "@/lib/supabase/env";
import { STICKER_ASSETS_BUCKET, ugcStickerId, type StickerPackItemRow, type StickerPackRow } from "./ugc-types";

const ugcById = new Map<string, StickerDefinition>();
const installedPacks: StickerPack[] = [];
let libraryRevision = 0;

export function getUgcLibraryRevision(): number {
  return libraryRevision;
}

export function publicStickerAssetUrl(storagePath: string): string {
  const { publicUrl, url } = getSupabaseEnv();
  const base = (publicUrl || url || "").replace(/\/$/, "");
  if (!base) return storagePath;
  const raw = `${base}/storage/v1/object/public/${STICKER_ASSETS_BUCKET}/${storagePath}`;
  return toPublicSupabaseUrl(raw);
}

export function itemToStickerDefinition(
  pack: Pick<StickerPackRow, "id" | "name">,
  item: StickerPackItemRow,
): StickerDefinition {
  return {
    id: ugcStickerId(pack.id, item.id),
    name: item.name || pack.name,
    kind: "image",
    src: publicStickerAssetUrl(item.storage_path),
    defaultWidth: item.width,
    defaultHeight: item.height,
  };
}

export function registerUgcLibrary(
  packs: Array<{ pack: StickerPackRow; items: StickerPackItemRow[] }>,
): void {
  ugcById.clear();
  installedPacks.length = 0;

  for (const entry of packs) {
    const stickers = entry.items
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => itemToStickerDefinition(entry.pack, item));

    for (const sticker of stickers) {
      ugcById.set(sticker.id, sticker);
    }

    installedPacks.push({
      id: `ugc-pack-${entry.pack.id}`,
      name: entry.pack.name,
      emoji: entry.pack.emoji ?? "📦",
      sortOrder: 100 + installedPacks.length,
      stickers,
    });
  }

  libraryRevision += 1;
}

export function clearUgcLibrary(): void {
  ugcById.clear();
  installedPacks.length = 0;
  libraryRevision += 1;
}

export function getUgcStickerById(id: string): StickerDefinition | undefined {
  return ugcById.get(id);
}

export function getInstalledUgcPacks(): StickerPack[] {
  return installedPacks.slice();
}

export function flattenInstalledUgcStickers(): StickerDefinition[] {
  return installedPacks.flatMap((pack) => flattenPackStickers(pack));
}
