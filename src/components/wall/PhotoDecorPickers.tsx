"use client";

import { useMemo } from "react";
import {
  getListedPhotoFrames,
  patternSwatchCss,
  type PhotoFrameDefinition,
} from "@/lib/photo-frames";

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

interface PhotoDecorPickersProps {
  onApplyFrame: (frameId: string) => void;
  activeFrameId?: string | null;
}

export default function PhotoDecorPickers({
  onApplyFrame,
  activeFrameId,
}: PhotoDecorPickersProps) {
  const frames = useMemo(() => getListedPhotoFrames(), []);

  return (
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
  );
}
