"use client";

import { useCallback } from "react";
import {
  getObjectDisplayDimensions,
  objectSupportsSizeEdit,
} from "@/lib/wall-scene/object-dimensions";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

interface WallObjectInspectorProps {
  object: WallSceneObject;
  onStartCrop?: (id: string) => void;
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
        className="w-full rounded-lg border border-foreground/10 bg-background px-2 py-1.5 text-xs tabular-nums outline-none focus:border-foreground/30"
      />
    </label>
  );
}

export default function WallObjectInspector({ object, onStartCrop }: WallObjectInspectorProps) {
  const patchObject = useWallSceneStore((s) => s.patchObject);
  const recordHistory = useWallSceneStore((s) => s.recordHistory);
  const bumpRevision = useWallSceneStore((s) => s.bumpRevision);

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

  return (
    <div
      className="pointer-events-auto w-44 space-y-2 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/8 backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] font-medium text-muted">속성</p>
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
      {object.type === "photo" && onStartCrop && (
        <button
          type="button"
          onClick={() => onStartCrop(object.id)}
          className="w-full rounded-xl bg-foreground px-3 py-2 text-xs font-medium text-background transition active:scale-[0.98]"
        >
          자르기
        </button>
      )}
      <p className="text-[10px] text-muted">더블탭/더블클릭으로도 자를 수 있어요</p>
    </div>
  );
}
