"use client";

import { useEffect, useState } from "react";
import {
  TEXT_COLORS,
  TEXT_FONT_FAMILIES,
  TEXT_SIZE_PRESETS,
  updateTextObject,
} from "@/lib/wall-scene/add-text";
import type { WallSceneText } from "@/types/wall-scene-v2";

interface TextStyleBarProps {
  object: WallSceneText;
  onClose?: () => void;
}

/** Style panel for selected text — opens via double-click / long-press / place. */
export default function TextStyleBar({ object, onClose }: TextStyleBarProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [object.id]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-3"
      style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
    >
      {open ? (
        <div className="pointer-events-auto max-h-[38vh] w-full max-w-lg space-y-2 overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/8 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted">텍스트 스타일</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-foreground/6 px-2.5 py-1 text-[10px] font-medium text-muted transition hover:bg-foreground/10"
              >
                접기
              </button>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-background transition"
              >
                완료
              </button>
            </div>
          </div>

          <input
            value={object.text}
            onChange={(e) => updateTextObject(object.id, { text: e.target.value || " " })}
            className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
            placeholder="텍스트 입력"
            aria-label="텍스트 내용"
          />

          <p className="text-[11px] font-medium text-muted">글꼴</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {TEXT_FONT_FAMILIES.map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => updateTextObject(object.id, { fontFamily: font.value })}
                className={`rounded-xl px-2.5 py-2 text-left text-[12px] transition ${
                  object.fontFamily === font.value
                    ? "bg-foreground text-background"
                    : "bg-foreground/6 hover:bg-foreground/10"
                }`}
                style={{ fontFamily: font.value }}
              >
                <span className="block truncate text-[10px] opacity-70">{font.label}</span>
                <span className="block truncate">가나다 Abc</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] font-medium text-muted">크기</p>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_SIZE_PRESETS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => updateTextObject(object.id, { fontSize: size })}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                  object.fontSize === size
                    ? "bg-foreground text-background"
                    : "bg-foreground/6 hover:bg-foreground/10"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <p className="text-[11px] font-medium text-muted">색상</p>
          <div className="flex flex-wrap gap-2">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateTextObject(object.id, { fill: color })}
                className={`h-7 w-7 rounded-full ring-2 transition ${
                  object.fill === color ? "ring-foreground" : "ring-transparent"
                }`}
                style={{
                  background: color,
                  boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #ddd" : undefined,
                }}
                aria-label={`글자 색 ${color}`}
              />
            ))}
          </div>

          <p className="text-[11px] font-medium text-muted">스타일</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                updateTextObject(object.id, {
                  fontWeight: object.fontWeight === "bold" ? "normal" : "bold",
                })
              }
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                object.fontWeight === "bold"
                  ? "bg-foreground text-background"
                  : "bg-foreground/6 hover:bg-foreground/10"
              }`}
            >
              B
            </button>
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => updateTextObject(object.id, { textAlign: align })}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                  (object.textAlign ?? "left") === align
                    ? "bg-foreground text-background"
                    : "bg-foreground/6 hover:bg-foreground/10"
                }`}
              >
                {align === "left" ? "왼쪽" : align === "center" ? "가운데" : "오른쪽"}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-muted">
            선택 후 드래그로 이동 · 더블탭으로 다시 편집 · 길게 누르면 메뉴
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-muted shadow-md ring-1 ring-black/8 backdrop-blur-sm"
        >
          텍스트 설정
        </button>
      )}
    </div>
  );
}
