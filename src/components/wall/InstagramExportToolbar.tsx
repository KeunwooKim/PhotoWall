"use client";

import {
  INSTAGRAM_EXPORT_PRESETS,
  type InstagramExportPresetId,
} from "@/lib/wall-scene/instagram-export";

interface InstagramExportToolbarProps {
  presetId: InstagramExportPresetId;
  phase: "pick" | "adjust";
  isExporting?: boolean;
  canExport?: boolean;
  onPresetChange: (id: InstagramExportPresetId) => void;
  onAutoSuggest: () => void;
  onCancel: () => void;
  onExport: () => void;
}

const idleBtn =
  "rounded-xl bg-foreground/10 px-4 py-2 text-xs font-medium text-foreground transition hover:bg-foreground/15";
const primaryBtn =
  "rounded-xl bg-foreground px-4 py-2 text-xs font-medium text-background transition active:scale-[0.98] disabled:opacity-50";

export default function InstagramExportToolbar({
  presetId,
  phase,
  isExporting = false,
  canExport = false,
  onPresetChange,
  onAutoSuggest,
  onCancel,
  onExport,
}: InstagramExportToolbarProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-2 px-3"
      style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface p-3 text-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm">
        <p className="w-full text-center text-[11px] font-medium text-muted">
          {phase === "pick" ? "인스타 내보내기 · 영역 선택" : "인스타 내보내기 · 크롭 조정"}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {INSTAGRAM_EXPORT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPresetChange(preset.id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                presetId === preset.id
                  ? "bg-foreground text-background"
                  : "bg-foreground/10 text-foreground hover:bg-foreground/15"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2 pt-1">
          <button type="button" className={idleBtn} onClick={onAutoSuggest}>
            자동 추천
          </button>
          <button type="button" className={idleBtn} onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className={primaryBtn}
            disabled={!canExport || isExporting}
            onClick={onExport}
          >
            {isExporting ? "저장 중…" : "저장 / 공유"}
          </button>
        </div>
      </div>
    </div>
  );
}
