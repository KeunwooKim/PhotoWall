"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getStickerPacks, getStickerPreviewSrc, getInstalledUgcPacks, loadStickerPack, preloadDefaultStickerPack } from "@/lib/stickers";
import { useUgcStickerLibrary } from "@/hooks/useUgcStickerLibrary";
import { useAuth } from "@/hooks/useAuth";
import { useStickerStoreGate } from "@/hooks/useStickerStoreGate";

interface StickerPickerProps {
  onSelect: (stickerId: string) => void;
}

export default function StickerPicker({ onSelect }: StickerPickerProps) {
  const { user } = useAuth();
  const { handleStoreClick, Toast } = useStickerStoreGate();
  const { revision } = useUgcStickerLibrary();
  void revision;

  const [packEpoch, setPackEpoch] = useState(0);
  const packs = useMemo(() => getStickerPacks(), [revision, packEpoch]);
  const ugcPacks = useMemo(() => getInstalledUgcPacks(), [revision]);

  useEffect(() => {
    void preloadDefaultStickerPack().then(() => setPackEpoch((n) => n + 1));
  }, []);

  const [activePackId, setActivePackId] = useState(packs[0]?.id ?? "basic");
  const activePack = packs.find((pack) => pack.id === activePackId) ?? packs[0];

  useEffect(() => {
    if (!activePackId) return;
    void loadStickerPack(activePackId).then(() => setPackEpoch((n) => n + 1));
  }, [activePackId]);

  const categories = activePack?.categories ?? [];
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");

  useEffect(() => {
    if (!packs.some((p) => p.id === activePackId) && packs[0]) {
      setActivePackId(packs[0].id);
    }
  }, [packs, activePackId]);

  useEffect(() => {
    const nextCategories = activePack?.categories ?? [];
    setActiveCategoryId(nextCategories[0]?.id ?? "");
  }, [activePack?.id, activePack?.categories]);

  const visibleStickers = useMemo(() => {
    if (!activePack) return [];
    if (categories.length === 0) return activePack.stickers;
    const category =
      categories.find((entry) => entry.id === activeCategoryId) ?? categories[0];
    return category?.stickers ?? [];
  }, [activePack, activeCategoryId, categories]);

  if (!activePack) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">
          {user
            ? ugcPacks.length > 0
              ? `내 팩 ${ugcPacks.length}개`
              : "스토어에서 팩을 설치해 보세요"
            : "로그인하면 커뮤니티 팩을 쓸 수 있어요"}
        </p>
        <Link
          href="/stickers"
          onClick={handleStoreClick}
          className="shrink-0 text-[11px] font-medium text-foreground underline-offset-2 hover:underline"
        >
          스티커 스토어
        </Link>
      </div>
      {Toast}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {packs.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setActivePackId(pack.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pack.id === activePackId
                ? "bg-foreground text-background"
                : "bg-foreground/[0.06] text-foreground hover:bg-foreground/10"
            }`}
          >
            {pack.name}
          </button>
        ))}
      </div>

      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategoryId(category.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                category.id === activeCategoryId
                  ? "bg-foreground/90 text-background"
                  : "bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground"
              }`}
            >
              {category.name}
              <span className="ml-1 opacity-60">{category.stickers.length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-5">
        {visibleStickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            title={sticker.name}
            onClick={() => onSelect(sticker.id)}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground/4 p-1.5 transition hover:bg-foreground/8 active:scale-95"
          >
            {sticker.kind === "emoji" ? (
              <span className="text-xl">{sticker.src}</span>
            ) : (
              <img
                src={getStickerPreviewSrc(sticker)}
                alt={sticker.name}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

      {activePack.attribution && (
        <p className="text-[10px] leading-snug text-muted">
          출처:{" "}
          <a
            href={activePack.attribution.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {activePack.attribution.label}
          </a>
          {activePack.attribution.note ? ` · ${activePack.attribution.note}` : null}
        </p>
      )}
    </div>
  );
}
