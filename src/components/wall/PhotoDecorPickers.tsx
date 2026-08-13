"use client";

import { useMemo } from "react";
import {
  getListedPhotoFrames,
  patternSwatchCss,
  type PhotoFrameDefinition,
} from "@/lib/photo-frames";
import {
  fourCutHoleFractions,
  getListedFourCutSkins,
  type FourCutLayout,
  type FourCutSkinDefinition,
} from "@/lib/four-cut";

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

function FourCutSwatch({ skin }: { skin: FourCutSkinDefinition }) {
  const holes = fourCutHoleFractions(skin.layout);
  const tall = skin.layout === "stack4";
  return (
    <span
      className={`relative block overflow-hidden rounded-sm ring-1 ring-foreground/10 ${
        tall ? "h-10 w-4" : "h-8 w-8"
      }`}
      style={{ background: skin.fill }}
      aria-hidden
    >
      {holes.map((hole, index) => (
        <span
          key={index}
          className="absolute bg-[#9aa3ad]"
          style={{
            left: `${hole.x * 100}%`,
            top: `${hole.y * 100}%`,
            width: `${hole.width * 100}%`,
            height: `${hole.height * 100}%`,
          }}
        />
      ))}
    </span>
  );
}

interface PhotoDecorPickersProps {
  onApplyFrame: (frameId: string) => void;
  activeFrameId?: string | null;
  fourCutLayout?: FourCutLayout | null;
  activeSkinId?: string | null;
  onApplyFourCutSkin?: (skinId: string | null) => void;
}

export default function PhotoDecorPickers({
  onApplyFrame,
  activeFrameId,
  fourCutLayout = null,
  activeSkinId = null,
  onApplyFourCutSkin,
}: PhotoDecorPickersProps) {
  const frames = useMemo(() => getListedPhotoFrames(), []);
  const skins = useMemo(
    () => (fourCutLayout ? getListedFourCutSkins(fourCutLayout) : []),
    [fourCutLayout],
  );

  return (
    <>
      {fourCutLayout && onApplyFourCutSkin ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted">네컷 테두리</h3>
          <p className="text-[10px] text-muted">안쪽 4장은 그대로 두고 외곽만 바꿔요</p>
          <div className="grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto">
            <button
              type="button"
              title="원본 테두리"
              onClick={() => onApplyFourCutSkin(null)}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] transition active:scale-95 ${
                !activeSkinId
                  ? "bg-foreground/10 font-medium text-foreground"
                  : "bg-foreground/4 text-foreground/80 hover:bg-foreground/8"
              }`}
            >
              <span className="flex h-10 w-8 items-center justify-center rounded-sm bg-foreground/10 text-[9px] text-muted">
                원본
              </span>
              원본 테두리
            </button>
            {skins.map((skin) => {
              const active = activeSkinId === skin.id;
              return (
                <button
                  key={skin.id}
                  type="button"
                  title={skin.name}
                  onClick={() => onApplyFourCutSkin(skin.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] transition active:scale-95 ${
                    active
                      ? "bg-foreground/10 font-medium text-foreground"
                      : "bg-foreground/4 text-foreground/80 hover:bg-foreground/8"
                  }`}
                >
                  <FourCutSwatch skin={skin} />
                  {skin.name.replace(" 스트립", "").replace(" 2×2", "")}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

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
    </>
  );
}
