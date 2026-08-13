export type StickerKind = "svg" | "emoji" | "image";

export interface StickerDefinition {
  id: string;
  name: string;
  kind: StickerKind;
  /** Public path, emoji char, or image URL */
  src: string;
  defaultSize?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  tags?: string[];
  premium?: boolean;
  /** When set, picker 테두리 tab binds this sticker to a photo corner. */
  attach?: "photo-corner";
}

export interface StickerCategory {
  id: string;
  name: string;
  stickers: StickerDefinition[];
}

export interface StickerAttribution {
  /** Display name (e.g. blog author) */
  label: string;
  /** Source URL */
  href: string;
  note?: string;
}

export interface StickerPack {
  id: string;
  name: string;
  emoji?: string;
  sortOrder: number;
  /** MM-DD seasonal window (optional) */
  availableFrom?: string;
  availableTo?: string;
  /** Flat list — used when pack has no categories */
  stickers: StickerDefinition[];
  /** Optional sub-categories (e.g. 무한도전 themes) */
  categories?: StickerCategory[];
  /** Third-party source credit (shown in picker) */
  attribution?: StickerAttribution;
}

/** All stickers in a pack (flat + categories). */
export function flattenPackStickers(pack: StickerPack): StickerDefinition[] {
  if (!pack.categories?.length) return pack.stickers;
  return [
    ...pack.stickers,
    ...pack.categories.flatMap((category) => category.stickers),
  ];
}
