"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getObjectDisplayDimensions,
  objectSupportsSizeEdit,
} from "@/lib/wall-scene/object-dimensions";
import { clearPhotoFrame } from "@/lib/photo-frames";
import { clearFourCutSkin } from "@/lib/four-cut";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

interface WallObjectInspectorProps {
  object: WallSceneObject;
  onStartCrop?: (id: string) => void;
  onStartColorEdit?: (id: string) => void;
  onUpscalePhoto?: (id: string) => void;
  upscaleBusy?: boolean;
  onClose?: () => void;
  /** sidebar = always expanded in properties column; floating = chip then expand */
  variant?: "floating" | "sidebar";
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        min={min}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full rounded-lg border border-foreground/10 bg-surface px-2 py-1.5 text-xs tabular-nums text-foreground outline-none focus:border-foreground/30"
      />
    </label>
  );
}

export default function WallObjectInspector({
  object,
  onStartCrop,
  onStartColorEdit,
  onUpscalePhoto,
  upscaleBusy = false,
  onClose,
  variant = "floating",
}: WallObjectInspectorProps) {
  const patchObject = useWallSceneStore((s) => s.patchObject);
  const recordHistory = useWallSceneStore((s) => s.recordHistory);
  const bumpRevision = useWallSceneStore((s) => s.bumpRevision);
  const [expanded, setExpanded] = useState(variant === "sidebar");

  // New selection starts collapsed so the canvas stays visible (floating only)
  useEffect(() => {
    setExpanded(variant === "sidebar");
  }, [object.id, variant]);

  const dims = getObjectDisplayDimensions(object);
  const canEditSize = objectSupportsSizeEdit(object);

  const applyPatch = useCallback(
    (patch: Record<string, number>) => {
      recordHistory();
      patchObject(object.id, patch);
      bumpRevision();
    },
    [bumpRevision, object.id, patchObject, recordHistory],
  );

  const applyPosition = useCallback(
    (x: number, y: number) => applyPatch({ x, y }),
    [applyPatch],
  );

  const applyRotation = useCallback(
    (rotation: number) => applyPatch({ rotation }),
    [applyPatch],
  );

  const applySize = useCallback(
    (width: number, height: number) => {
      const scaleX = object.scaleX ?? 1;
      const scaleY = object.scaleY ?? 1;
      if (object.type === "text") {
        applyPatch({
          width: Math.max(40, width) / scaleX,
          fontSize: Math.max(12, height / 1.4) / scaleY,
        });
        return;
      }
      if (object.type === "photo" || object.type === "sticker" || object.type === "tape") {
        applyPatch({
          width: Math.max(24, width) / scaleX,
          height: Math.max(24, height) / scaleY,
        });
      }
    },
    [applyPatch, object],
  );

  if (variant === "floating" && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto rounded-full bg-surface px-3.5 py-2 text-xs font-medium text-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm transition active:scale-[0.98]"
        aria-expanded={false}
      >
        속성
      </button>
    );
  }

  const panelClass =
    variant === "sidebar"
      ? "pointer-events-auto w-full space-y-2 text-foreground"
      : "pointer-events-auto w-44 space-y-2 rounded-2xl bg-surface p-3 text-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm";

  return (
    <div className={panelClass} onPointerDown={(e) => e.stopPropagation()}>
      {variant === "floating" && (
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-medium text-muted">속성</p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-foreground"
              aria-label="속성 최소화"
              title="최소화"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-foreground"
                aria-label="속성 닫기"
                title="닫기"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumField label="X" value={object.x} onChange={(x) => applyPosition(x, object.y)} />
        <NumField label="Y" value={object.y} onChange={(y) => applyPosition(object.x, y)} />
        {dims && canEditSize && (
          <>
            <NumField
              label="W"
              value={dims.width}
              min={24}
              onChange={(width) => applySize(width, dims.height)}
            />
            <NumField
              label="H"
              value={dims.height}
              min={24}
              onChange={(height) => applySize(dims.width, height)}
            />
          </>
        )}
        <div className="col-span-2">
          <NumField
            label="회전 (°)"
            value={object.rotation}
            step={1}
            onChange={applyRotation}
          />
        </div>
      </div>

      {object.type === "photo" &&
        (onStartCrop ||
          onStartColorEdit ||
          onUpscalePhoto ||
          object.frameId ||
          object.fourCut?.skinId) && (
          <div className="flex flex-col gap-1.5">
            {onStartCrop && (
              <button
                type="button"
                onClick={() => onStartCrop(object.id)}
                className="w-full rounded-xl bg-foreground px-3 py-2 text-xs font-medium text-background transition active:scale-[0.98]"
              >
                자르기
              </button>
            )}
            {onStartColorEdit && (
              <button
                type="button"
                onClick={() => onStartColorEdit(object.id)}
                className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground transition hover:bg-foreground/5 active:scale-[0.98]"
              >
                색 보정
              </button>
            )}
            {onUpscalePhoto && (
              <button
                type="button"
                disabled={upscaleBusy}
                onClick={() => onUpscalePhoto(object.id)}
                className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground transition hover:bg-foreground/5 active:scale-[0.98] disabled:opacity-40"
              >
                {upscaleBusy ? "업스케일 중…" : "화질 업스케일"}
              </button>
            )}
            {object.frameId ? (
              <button
                type="button"
                onClick={() => clearPhotoFrame(object.id)}
                className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground transition hover:bg-foreground/5 active:scale-[0.98]"
              >
                프레임 제거
              </button>
            ) : null}
            {object.fourCut?.skinId ? (
              <button
                type="button"
                onClick={() => {
                  void clearFourCutSkin(object.id);
                }}
                className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground transition hover:bg-foreground/5 active:scale-[0.98]"
              >
                원본
              </button>
            ) : null}
          </div>
        )}
      {object.type === "photo" && (
        <p className="text-[10px] text-muted">더블탭으로도 자를 수 있어요</p>
      )}
    </div>
  );
}
