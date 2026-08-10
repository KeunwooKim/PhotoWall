import { STICKER_PACKS } from "./catalog";
import { flattenPackStickers } from "./types";

export type FirstPartyStorePack = {
  id: string;
  kind: "official";
  name: string;
  description: string;
  sticker_count: number;
  download_count: number;
  coverUrl: string | null;
  previewSrcs: string[];
  published_at: string;
};

const DESCRIPTIONS: Record<string, string> = {
  basic: "하트, 별, 테이프 등 벽에 바로 붙이는 기본 데코 스티커.",
  cute: "다꾸 캐릭터와 귀여운 동물·스위트 스티커 모음.",
  season: "봄·여름·가을·겨울 시즌 감성 스티커.",
  life: "카페, 여행, 밤 분위기의 라이프 스티커.",
  party: "축하와 연애 테마를 담은 파티 스티커.",
  mudo: "무한도전 감성 스티커 (출처: candy_drop).",
};

/** First-party catalogs exposed as free store packs. */
export function getFirstPartyStorePacks(): FirstPartyStorePack[] {
  return STICKER_PACKS.map((pack) => {
    const stickers = flattenPackStickers(pack).filter((s) => s.kind === "image");
    const previewSrcs = stickers.slice(0, 6).map((s) => s.src);
    return {
      id: pack.id,
      kind: "official" as const,
      name: pack.name,
      description: DESCRIPTIONS[pack.id] ?? `${pack.name} 무료 스티커 팩`,
      sticker_count: stickers.length,
      download_count: 0,
      coverUrl: previewSrcs[0] ?? null,
      previewSrcs,
      published_at: "2026-01-01T00:00:00.000Z",
    };
  });
}

export function getFirstPartyStorePackById(id: string): FirstPartyStorePack | null {
  return getFirstPartyStorePacks().find((p) => p.id === id) ?? null;
}

export function getFirstPartyPackStickers(id: string) {
  const pack = STICKER_PACKS.find((p) => p.id === id);
  if (!pack) return [];
  return flattenPackStickers(pack).filter((s) => s.kind === "image");
}

export function isFirstPartyPackId(id: string): boolean {
  return STICKER_PACKS.some((p) => p.id === id);
}
