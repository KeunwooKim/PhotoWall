import type { StickerCategory, StickerDefinition, StickerPack } from "./types";
import { flattenPackStickers } from "./types";

function mergeCategories(
  id: string,
  name: string,
  groups: StickerCategory[],
): StickerCategory {
  return {
    id,
    name,
    stickers: groups.flatMap((group) => group.stickers),
  };
}

/** Pack shells — no generated catalog imports. */
export const STICKER_PACK_META: Omit<StickerPack, "categories" | "stickers">[] = [
  { id: "basic", name: "기본", sortOrder: 0 },
  { id: "cute", name: "귀여움", sortOrder: 1 },
  { id: "season", name: "시즌", sortOrder: 2 },
  { id: "life", name: "라이프", sortOrder: 3 },
  { id: "party", name: "파티", sortOrder: 4 },
  {
    id: "mudo",
    name: "무한도전",
    sortOrder: 20,
    attribution: {
      label: "candy_drop (네이버 블로그)",
      href: "https://m.blog.naver.com/PostList.naver?blogId=candy_drop&tab=1",
      note: "블로그에서 정리한 스티커를 사용했습니다.",
    },
  },
];

const stickerCache = new Map<string, StickerDefinition>();
const loadedPacks = new Set<string>();
const packCache = new Map<string, StickerPack>();
const inflight = new Map<string, Promise<StickerPack>>();

/** First id segment → picker pack that owns the sticker. */
const PREFIX_TO_PACK: Record<string, string> = {
  basic: "basic",
  daku: "cute",
  cute: "cute",
  spring: "season",
  summer: "season",
  autumn: "season",
  winter: "season",
  cafe: "life",
  travel: "life",
  night: "life",
  party: "party",
  love: "party",
  mudo: "mudo",
};

function cachePackStickers(pack: StickerPack): void {
  packCache.set(pack.id, pack);
  for (const sticker of flattenPackStickers(pack)) {
    stickerCache.set(sticker.id, sticker);
  }
}

async function loadPackCategories(packId: string): Promise<StickerCategory[]> {
  switch (packId) {
    case "basic": {
      const { BASIC_CATEGORIES } = await import("./basic-catalog.generated");
      return BASIC_CATEGORIES;
    }
    case "cute": {
      const [{ DAKU_CATEGORIES }, { CUTE_CATEGORIES }] = await Promise.all([
        import("./daku-catalog.generated"),
        import("./cute-catalog.generated"),
      ]);
      return [
        mergeCategories("chars", "캐릭터", [
          ...DAKU_CATEGORIES.filter((c) => c.id === "chars"),
          ...CUTE_CATEGORIES.filter((c) => c.id === "animals"),
        ]),
        mergeCategories("deco", "데코", [
          ...DAKU_CATEGORIES.filter((c) => c.id === "accents"),
          ...CUTE_CATEGORIES.filter((c) => c.id === "sweets"),
        ]),
      ];
    }
    case "season": {
      const [{ SPRING_CATEGORIES }, { SUMMER_CATEGORIES }, { AUTUMN_CATEGORIES }, { WINTER_CATEGORIES }] =
        await Promise.all([
          import("./spring-catalog.generated"),
          import("./summer-catalog.generated"),
          import("./autumn-catalog.generated"),
          import("./winter-catalog.generated"),
        ]);
      return [
        mergeCategories("spring", "봄", SPRING_CATEGORIES),
        mergeCategories("summer", "여름", SUMMER_CATEGORIES),
        mergeCategories("autumn", "가을", AUTUMN_CATEGORIES),
        mergeCategories("winter", "겨울", WINTER_CATEGORIES),
      ];
    }
    case "life": {
      const [{ CAFE_CATEGORIES }, { TRAVEL_CATEGORIES }, { NIGHT_CATEGORIES }] =
        await Promise.all([
          import("./cafe-catalog.generated"),
          import("./travel-catalog.generated"),
          import("./night-catalog.generated"),
        ]);
      return [
        mergeCategories("cafe", "카페", CAFE_CATEGORIES),
        mergeCategories("travel", "여행", TRAVEL_CATEGORIES),
        mergeCategories("night", "밤", NIGHT_CATEGORIES),
      ];
    }
    case "party": {
      const [{ PARTY_CATEGORIES }, { LOVE_CATEGORIES }] = await Promise.all([
        import("./party-catalog.generated"),
        import("./love-catalog.generated"),
      ]);
      return [
        mergeCategories("celeb", "축하", PARTY_CATEGORIES),
        mergeCategories("love", "연애", LOVE_CATEGORIES),
      ];
    }
    case "mudo": {
      const { MUDO_CATEGORIES } = await import("./mudo-catalog.generated");
      return MUDO_CATEGORIES;
    }
    default:
      return [];
  }
}

function shellForPackId(packId: string): StickerPack | undefined {
  const meta = STICKER_PACK_META.find((pack) => pack.id === packId);
  if (!meta) return undefined;
  return { ...meta, stickers: [], categories: [] };
}

/** Load one picker pack (dynamic import of generated catalogs). */
export async function loadStickerPack(packId: string): Promise<StickerPack | null> {
  const cached = packCache.get(packId);
  if (cached) return cached;

  const pending = inflight.get(packId);
  if (pending) return pending;

  const shell = shellForPackId(packId);
  if (!shell) return null;

  const promise = (async () => {
    const categories = await loadPackCategories(packId);
    const pack: StickerPack = { ...shell, categories, stickers: [] };
    loadedPacks.add(packId);
    cachePackStickers(pack);
    inflight.delete(packId);
    return pack;
  })();

  inflight.set(packId, promise);
  return promise;
}

/** Picker list — shells only until a tab is opened. */
export function getStickerPackShells(): StickerPack[] {
  return STICKER_PACK_META.map((meta) => ({ ...meta, stickers: [], categories: [] }));
}

export function getCachedStickerById(id: string): StickerDefinition | undefined {
  return stickerCache.get(id);
}

export function packIdForStickerId(id: string): string | null {
  const prefix = id.split(".")[0];
  return PREFIX_TO_PACK[prefix] ?? null;
}

/** Warm sticker defs for ids on a wall (async, fire-and-forget safe). */
export async function ensureStickersForIds(ids: string[]): Promise<void> {
  const packIds = new Set<string>();
  for (const id of ids) {
    if (stickerCache.has(id)) continue;
    const packId = packIdForStickerId(id);
    if (packId && !loadedPacks.has(packId)) packIds.add(packId);
  }
  await Promise.all([...packIds].map((packId) => loadStickerPack(packId)));
}

/** Default pack for first paint — basic only (~small chunk). */
export async function preloadDefaultStickerPack(): Promise<void> {
  await loadStickerPack("basic");
}

export function isStickerPackLoaded(packId: string): boolean {
  return loadedPacks.has(packId);
}

export function getLoadedStickerPack(packId: string): StickerPack | undefined {
  return packCache.get(packId);
}
