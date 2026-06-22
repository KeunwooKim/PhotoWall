export type StickerKind = "svg" | "emoji" | "image";

export interface StickerDefinition {
  id: string;
  name: string;
  kind: StickerKind;
  /** Public path, emoji char, or image URL */
  src: string;
  defaultSize?: number;
  tags?: string[];
  premium?: boolean;
}

export interface StickerPack {
  id: string;
  name: string;
  emoji?: string;
  sortOrder: number;
  /** MM-DD seasonal window (optional) */
  availableFrom?: string;
  availableTo?: string;
  stickers: StickerDefinition[];
}
