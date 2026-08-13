"use client";

import { useMemo } from "react";
import {
  getListedPhotoFrames,
  patternSwatchCss,
  type PhotoFrameDefinition,
} from "@/lib/photo-frames";
import { getListedPhotoDecos, type PhotoDecoDefinition } from "@/lib/photo-decos";

function FrameSwatch({ frame }: { frame: PhotoFrameDefinition }) {
  const inset = frame.inset;
  const background = frame.pattern ? patternSwatchCss(frame) : (frame.matteFill ?? "#ddd");
  return (
    <span
      className="relative block h-10 w-8 overflow-hidden rounded-sm ring-1 ring-foreground/10"
      style={{ background }}
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

function DecoSwatch({ deco }: { deco: PhotoDecoDefinition }) {
  const fill =
    deco.theme === "blue" ? "#7fd4e8" : deco.theme === "purple" ? "#d2b4f0" : "#f5a0c0";
  const accent =
    deco.theme === "blue" ? "#3aa0c8" : deco.theme === "purple" ? "#9b7ad4" : "#ee6d9a";
  return (
    <span
      className="relative block h-10 w-8 overflow-hidden rounded-sm bg-[#cfd6dd] ring-1 ring-foreground/10"
      aria-hidden
    >
      <span
        className="absolute inset-x-0 top-0 h-1.5 rounded-b-full"
        style={{ background: fill }}
      />
      <span
        className="absolute inset-y-0 left-0 w-1.5 rounded-r-full"
        style={{ background: accent }}
      />
      <span
        className="absolute inset-y-0 right-0 w-1.5 rounded-l-full"
        style={{ background: fill }}
      />
      <span
        className="absolute inset-x-0 bottom-0 h-1.5 rounded-t-full"
        style={{ background: accent }}
      />
    </span>
  );
}

interface PhotoDecorPickersProps {
  onApplyFrame: (frameId: string) => void;
  onApplyDeco: (decoId: string) => void;
  activeFrameId?: string | null;
  activeDecoId?: string | null;
}

export default function PhotoDecorPickers({
  onApplyFrame,
  onApplyDeco,
  activeFrameId,
  activeDecoId,
}: PhotoDecorPickersProps) {
  const frames = useMemo(() => getListedPhotoFrames(), []);
  const decos = useMemo(() => getListedPhotoDecos(), []);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium text-muted">프레임</h3>
        <p className="text-[10px] text-muted">폴라로이드 · 패턴. 사진을 선택한 뒤 골라 주세요</p>
        <div className="grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto">
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
        <p className="text-[10px] text-muted">리본·하트 세트. 프레임과 같이 붙일 수 있어요</p>
        <div className="grid grid-cols-3 gap-1.5">
          {decos.map((deco) => {
            const active = activeDecoId === deco.id;
            return (
              <button
                key={deco.id}
                type="button"
                title={deco.name}
                onClick={() => onApplyDeco(deco.id)}
                className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] transition active:scale-95 ${
                  active
                    ? "bg-foreground/10 font-medium text-foreground"
                    : "bg-foreground/4 text-foreground/80 hover:bg-foreground/8"
                }`}
              >
                <DecoSwatch deco={deco} />
                {deco.name}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
