"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLOR_ADJUST_PRESETS,
  DEFAULT_COLOR_ADJUST,
  applyColorAdjustToCanvas,
  imageToCanvas,
  type ColorAdjustParams,
  type ColorAdjustPresetId,
} from "@/lib/photo-edit/color-adjust";
import { loadHtmlImage } from "@/lib/storage/load-html-image";

interface PhotoColorToolbarProps {
  photoSrc: string;
  resolvePhotoSrc: (src: string) => Promise<string>;
  params: ColorAdjustParams;
  onParamsChange: (params: ColorAdjustParams) => void;
  onApply: () => void;
  onCancel: () => void;
  busy?: boolean;
  errorMessage?: string | null;
}

function SliderRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex w-full items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-medium text-neutral-500">{label}</span>
      <input
        type="range"
        min={-100}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 accent-neutral-900 disabled:opacity-40"
      />
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-neutral-500">
        {value}
      </span>
    </label>
  );
}

export default function PhotoColorToolbar({
  photoSrc,
  resolvePhotoSrc,
  params,
  onParamsChange,
  onApply,
  onCancel,
  busy = false,
  errorMessage = null,
}: PhotoColorToolbarProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [activePreset, setActivePreset] = useState<ColorAdjustPresetId | null>("original");

  useEffect(() => {
    let cancelled = false;
    setPreviewReady(false);
    sourceCanvasRef.current = null;

    void (async () => {
      try {
        const displaySrc = await resolvePhotoSrc(photoSrc);
        const img = await loadHtmlImage(displaySrc);
        if (cancelled) return;
        // Preview at reduced size for snappy sliders
        const maxSide = 360;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const base = document.createElement("canvas");
        base.width = w;
        base.height = h;
        const bctx = base.getContext("2d");
        if (!bctx) return;
        bctx.drawImage(img, 0, 0, w, h);
        sourceCanvasRef.current = base;
        setPreviewReady(true);
      } catch {
        if (!cancelled) setPreviewReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photoSrc, resolvePhotoSrc]);

  useEffect(() => {
    const source = sourceCanvasRef.current;
    const preview = previewCanvasRef.current;
    if (!source || !preview || !previewReady) return;

    const working = imageToCanvas(source);
    applyColorAdjustToCanvas(working, params);
    preview.width = working.width;
    preview.height = working.height;
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.drawImage(working, 0, 0);
  }, [params, previewReady]);

  const patch = (key: keyof ColorAdjustParams, value: number) => {
    setActivePreset(null);
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-2 px-3"
      style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
    >
      <div
        className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-2xl bg-white p-3 text-neutral-800 shadow-lg ring-1 ring-black/10 backdrop-blur-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="text-center text-[11px] font-medium text-neutral-500">색 보정</p>

        <div className="relative mx-auto flex max-h-36 w-full items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
          <canvas
            ref={previewCanvasRef}
            className="max-h-36 max-w-full object-contain"
            aria-label="색 보정 미리보기"
          />
          {!previewReady && (
            <p className="absolute text-[11px] text-neutral-500">미리보기 준비 중…</p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {COLOR_ADJUST_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setActivePreset(preset.id);
                onParamsChange({ ...preset.params });
              }}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-40 ${
                activePreset === preset.id
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-900/8 text-neutral-800 hover:bg-neutral-900/12"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 px-0.5 pt-1">
          <SliderRow
            label="밝기"
            value={params.brightness}
            disabled={busy}
            onChange={(v) => patch("brightness", v)}
          />
          <SliderRow
            label="대비"
            value={params.contrast}
            disabled={busy}
            onChange={(v) => patch("contrast", v)}
          />
          <SliderRow
            label="채도"
            value={params.saturation}
            disabled={busy}
            onChange={(v) => patch("saturation", v)}
          />
          <SliderRow
            label="따뜻함"
            value={params.warmth}
            disabled={busy}
            onChange={(v) => patch("warmth", v)}
          />
        </div>

        {errorMessage && (
          <p className="text-center text-[11px] text-red-600">{errorMessage}</p>
        )}

        <div className="flex w-full flex-wrap justify-center gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setActivePreset("original");
              onParamsChange({ ...DEFAULT_COLOR_ADJUST });
            }}
            className="rounded-xl bg-neutral-900/8 px-4 py-2 text-xs font-medium text-neutral-800 transition hover:bg-neutral-900/12 disabled:opacity-40"
          >
            초기화
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl bg-neutral-900/8 px-4 py-2 text-xs font-medium text-neutral-800 transition hover:bg-neutral-900/12 disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onApply}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "적용 중…" : "적용"}
          </button>
        </div>
      </div>    </div>
  );
}
