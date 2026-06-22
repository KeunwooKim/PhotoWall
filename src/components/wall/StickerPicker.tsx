"use client";

import { useState } from "react";
import { getStickerPacks, getStickerPreviewSrc } from "@/lib/stickers";

interface StickerPickerProps {
  onSelect: (stickerId: string) => void;
}

export default function StickerPicker({ onSelect }: StickerPickerProps) {
  const packs = getStickerPacks();
  const [activePackId, setActivePackId] = useState(packs[0]?.id ?? "basic");
  const activePack = packs.find((pack) => pack.id === activePackId) ?? packs[0];

  if (!activePack) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {packs.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setActivePackId(pack.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pack.id === activePackId
                ? "bg-foreground text-background"
                : "bg-foreground/6 text-foreground hover:bg-foreground/10"
            }`}
          >
            {pack.emoji ? `${pack.emoji} ` : ""}
            {pack.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {activePack.stickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            title={sticker.name}
            onClick={() => onSelect(sticker.id)}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-foreground/4 p-1.5 transition hover:bg-foreground/8 active:scale-95"
          >
            {sticker.kind === "emoji" ? (
              <span className="text-xl">{sticker.src}</span>
            ) : (
              <img
                src={getStickerPreviewSrc(sticker)}
                alt={sticker.name}
                className="h-full w-full object-contain"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
