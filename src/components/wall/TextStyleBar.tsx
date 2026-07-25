"use client";

import {
  TEXT_COLORS,
  TEXT_FONT_FAMILIES,
  TEXT_SIZE_PRESETS,
  updateTextObject,
} from "@/lib/wall-scene/add-text";
import type { WallSceneText } from "@/types/wall-scene-v2";

interface TextStyleBarProps {
  object: WallSceneText;
}

export default function TextStyleBar({ object }: TextStyleBarProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-3"
      style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
    >
      <div className="pointer-events-auto max-h-[42vh] w-full max-w-lg space-y-2 overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/8 backdrop-blur-sm">
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

        <p className="text-[10px] text-muted">기울이기는 모서리 핸들로 회전하세요</p>
      </div>
    </div>
  );
}
