"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getListedPhotoFrames,
  type PhotoFrameDefinition,
} from "@/lib/photo-frames";
import {
  getPhotoCornerStickers,
  getStickerPreviewSrc,
  loadStickerPack,
  type StickerDefinition,
} from "@/lib/stickers";
import type { PhotoDecoSlot } from "@/types/wall-scene-v2";

const SLOT_LABEL: Record<PhotoDecoSlot, string> = {
  tl: "왼쪽 위",
  tr: "오른쪽 위",
  br: "오른쪽 아래",
  bl: "왼쪽 아래",
};

function FrameSwatch({ frame }: { frame: PhotoFrameDefinition }) {
  const fill = frame.matteFill ?? "#ddd";
  const inset = frame.inset;
  return (
    <span
      className="relative block h-10 w-8 overflow-hidden rounded-sm"
      style={{ background: fill }}
      aria-hidden
    >
      <span
        className="absolute bg-[#9aa3ad]"
        style={{
          top: `${inset.top * 100}%`,
          right: `${inset.right * 100}%`,
          bottom: `${inset.bottom * 100}%`,
          left: `${inset.left * 100}%`,
        }}
      />
    </span>
  );
}

interface PhotoDecorPickersProps {
  onApplyFrame: (frameId: string) => void;
  onApplyCorner: (stickerId: string, slot: PhotoDecoSlot) => void;
  activeFrameId?: string | null;
}

export default function PhotoDecorPickers({
  onApplyFrame,
  onApplyCorner,
  activeFrameId,
}: PhotoDecorPickersProps) {
  const frames = useMemo(() => getListedPhotoFrames(), []);
  const [cornerEpoch, setCornerEpoch] = useState(0);
  const [slot, setSlot] = useState<PhotoDecoSlot>("tl");
  const corners = useMemo(() => getPhotoCornerStickers(), [cornerEpoch]);

  useEffect(() => {
    void loadStickerPack("basic").then(() => setCornerEpoch((n) => n + 1));
  }, []);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium text-muted">프레임</h3>
        <p className="text-[10px] text-muted">사진을 선택한 뒤 골라 주세요</p>
        <div className="grid grid-cols-4 gap-1.5">
          {frames.map((frame) => {
            const active = activeFrameId === frame.id;
            return (
              <button
                key={frame.id}
                type="button"
                title={frame.name}
                onClick={() => onApplyFrame(frame.id)}
                className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] transition active:scale-95 ${
                  active
                    ? "bg-foreground/10 font-medium text-foreground"
                    : "bg-foreground/4 text-foreground/80 hover:bg-foreground/8"
                }`}
              >
                <FrameSwatch frame={frame} />
                {frame.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium text-muted">테두리 장식</h3>
        <div className="grid grid-cols-2 gap-1">
          {(["tl", "tr", "bl", "br"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSlot(id)}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                slot === id
                  ? "bg-foreground text-background"
                  : "bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground"
              }`}
            >
              {SLOT_LABEL[id]}
            </button>
          ))}
        </div>
        <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto">
          {corners.map((sticker: StickerDefinition) => (
            <button
              key={sticker.id}
              type="button"
              title={sticker.name}
              onClick={() => onApplyCorner(sticker.id, slot)}
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
      </section>
    </div>
  );
}
