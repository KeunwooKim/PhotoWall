"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getObjectDisplayDimensions,
  objectSupportsSizeEdit,
} from "@/lib/wall-scene/object-dimensions";
import { hasClipboardContent } from "@/lib/wall-scene/clipboard-objects";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

type Expand = null | "order" | "align" | "position" | "more";

interface EditorSelectionSheetProps {
  object: WallSceneObject | null;
  selectionCount: number;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onAlignLeft?: () => void;
  onAlignCenterH?: () => void;
  onAlignRight?: () => void;
  onAlignTop?: () => void;
  onAlignMiddle?: () => void;
  onAlignBottom?: () => void;
  onCenterOnWall?: () => void;
  canAlign?: boolean;
  onSelectAll?: () => void;
  onNudge?: (dx: number, dy: number) => void;
  onStartCrop?: (id: string) => void;
  onStartColorEdit?: (id: string) => void;
  onUpscalePhoto?: (id: string) => void;
  upscaleBusy?: boolean;
  onToast?: (message: string) => void;
  onBringOntoWall?: () => void;
}

/**
 * Single-tap selection chrome (Miricanvas-style):
 * floating quick actions + compact horizontal property bar.
 * Long-press still uses the context menu for the fuller action list.
 */
export default function EditorSelectionSheet({
  object,
  selectionCount,
  onClose,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onAlignLeft,
  onAlignCenterH,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onCenterOnWall,
  canAlign = false,
  onSelectAll,
  onNudge,
  onStartCrop,
  onStartColorEdit,
  onUpscalePhoto,
  upscaleBusy = false,
  onToast,
  onBringOntoWall,
}: EditorSelectionSheetProps) {
  const [expand, setExpand] = useState<Expand>(null);
  const patchObject = useWallSceneStore((s) => s.patchObject);
  const recordHistory = useWallSceneStore((s) => s.recordHistory);
  const bumpRevision = useWallSceneStore((s) => s.bumpRevision);
  const multiSelectMode = useWallSceneStore((s) => s.multiSelectMode);
  const setMultiSelectMode = useWallSceneStore((s) => s.setMultiSelectMode);

  useEffect(() => {
    setExpand(null);
  }, [object?.id, selectionCount]);

  const applyPatch = useCallback(
    (id: string, patch: Record<string, number>) => {
      recordHistory();
      patchObject(id, patch);
      bumpRevision();
    },
    [bumpRevision, patchObject, recordHistory],
  );

  const toggle = (next: Expand) => setExpand((cur) => (cur === next ? null : next));

  if (selectionCount === 0) return null;

  const isPhoto = object?.type === "photo" && selectionCount === 1;
  const dims = object ? getObjectDisplayDimensions(object) : null;
  const canEditSize = object ? objectSupportsSizeEdit(object) : false;

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 z-40 px-3 md:hidden"
      style={{ bottom: "max(4.75rem, calc(env(safe-area-inset-bottom) + 3.75rem))" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-stretch gap-2">
        {/* Floating quick actions (above selection in reference → sits above property bar) */}
        <div className="flex justify-center">
          <div className="flex items-center gap-0.5 rounded-xl bg-white px-1 py-1 shadow-lg ring-1 ring-black/10">
            {multiSelectMode && (
              <button
                type="button"
                onClick={() => setMultiSelectMode(false)}
                className="mx-0.5 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] font-medium text-white"
              >
                완료
              </button>
            )}
            <IconBtn label="복제" onClick={onDuplicate}>
              <path
                d="M9 9h8v8H9V9zm-3-3h8v2H8v6H6V6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="none"
              />
            </IconBtn>
            <IconBtn label="삭제" onClick={onDelete} danger>
              <path
                d="M8 6h6M9 6V5h4v1m-5 2v8m3-8v8m3-8v8M7 8h8l-.5 9H7.5L7 8z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="none"
              />
            </IconBtn>
            <IconBtn label="더보기" onClick={() => toggle("more")} active={expand === "more"}>
              <path
                d="M6 11.5h.01M11 11.5h.01M16 11.5h.01"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </IconBtn>
          </div>
        </div>

        {expand === "more" && (
          <div className="max-h-[40dvh] overflow-y-auto rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/10">
            <div className="grid grid-cols-4 gap-1">
              <Chip
                label="복사"
                onClick={() => {
                  onCopy();
                  setExpand(null);
                }}
              />
              <Chip
                label="붙여넣기"
                onClick={() => {
                  if (!hasClipboardContent()) {
                    onToast?.("먼저 복사해 주세요");
                    return;
                  }
                  onPaste();
                  setExpand(null);
                }}
              />
              <Chip label="순서" onClick={() => setExpand("order")} />
              <Chip label="정렬" onClick={() => setExpand("align")} />
            </div>
            <div className="mt-1.5 divide-y divide-neutral-100 rounded-xl border border-neutral-100">
              <ListRow label="위치 이동" onClick={() => setExpand("position")} />
              <ListRow
                label={multiSelectMode ? "여러 선택 완료" : "여러 요소 선택"}
                onClick={() => {
                  setMultiSelectMode(!multiSelectMode);
                  setExpand(null);
                }}
              />
              {onSelectAll && <ListRow label="전체 선택" onClick={onSelectAll} />}
              {onBringOntoWall && (
                <ListRow
                  label="벽으로 가져오기"
                  onClick={() => {
                    onBringOntoWall();
                    setExpand(null);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {expand === "order" && (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/10">
            <Chip label="앞으로" onClick={onBringForward} />
            <Chip label="뒤로" onClick={onSendBackward} />
            <Chip label="맨 앞" onClick={onBringToFront} />
            <Chip label="맨 뒤" onClick={onSendToBack} />
          </div>
        )}

        {expand === "align" && (
          <div className="space-y-1.5 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/10">
            <div className="grid grid-cols-3 gap-1.5">
              <Chip label="왼쪽" onClick={onAlignLeft} disabled={!canAlign} />
              <Chip label="가로중앙" onClick={onAlignCenterH} disabled={!canAlign} />
              <Chip label="오른쪽" onClick={onAlignRight} disabled={!canAlign} />
              <Chip label="위" onClick={onAlignTop} disabled={!canAlign} />
              <Chip label="세로중앙" onClick={onAlignMiddle} disabled={!canAlign} />
              <Chip label="아래" onClick={onAlignBottom} disabled={!canAlign} />
            </div>
            <Chip label="벽 가운데" onClick={onCenterOnWall} className="w-full" />
          </div>
        )}

        {expand === "position" && (
          <div className="space-y-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/10">
            {onNudge && (
              <div className="grid grid-cols-3 gap-1.5">
                <span />
                <Chip label="↑" onClick={() => onNudge(0, -4)} />
                <span />
                <Chip label="←" onClick={() => onNudge(-4, 0)} />
                <Chip label="↓" onClick={() => onNudge(0, 4)} />
                <Chip label="→" onClick={() => onNudge(4, 0)} />
              </div>
            )}
            {object && selectionCount === 1 && (
              <div className="grid grid-cols-2 gap-2">
                <NumField
                  label="X"
                  value={object.x}
                  onChange={(x) => applyPatch(object.id, { x })}
                />
                <NumField
                  label="Y"
                  value={object.y}
                  onChange={(y) => applyPatch(object.id, { y })}
                />
                {dims && canEditSize && (
                  <>
                    <NumField
                      label="W"
                      value={dims.width}
                      min={24}
                      onChange={(width) => {
                        const scaleX = object.scaleX ?? 1;
                        const scaleY = object.scaleY ?? 1;
                        if (object.type === "text") {
                          applyPatch(object.id, { width: Math.max(40, width) / scaleX });
                          return;
                        }
                        applyPatch(object.id, {
                          width: Math.max(24, width) / scaleX,
                          height: Math.max(24, dims.height) / scaleY,
                        });
                      }}
                    />
                    <NumField
                      label="H"
                      value={dims.height}
                      min={24}
                      onChange={(height) => {
                        const scaleX = object.scaleX ?? 1;
                        const scaleY = object.scaleY ?? 1;
                        if (object.type === "text") {
                          applyPatch(object.id, {
                            fontSize: Math.max(12, height / 1.4) / scaleY,
                          });
                          return;
                        }
                        applyPatch(object.id, {
                          width: Math.max(24, dims.width) / scaleX,
                          height: Math.max(24, height) / scaleY,
                        });
                      }}
                    />
                  </>
                )}
                <div className="col-span-2">
                  <NumField
                    label="회전 (°)"
                    value={object.rotation}
                    onChange={(rotation) => applyPatch(object.id, { rotation })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Horizontal property bar */}
        <div className="flex items-center gap-1 rounded-2xl bg-white py-1.5 pl-1.5 pr-1.5 shadow-lg ring-1 ring-black/10">
          <div className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {isPhoto && onStartCrop && (
              <PropChip
                label="자르기"
                onClick={() => onStartCrop(object.id)}
                icon={
                  <path
                    d="M6 3v13h13M3 6h13v13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                }
              />
            )}
            {isPhoto && onStartColorEdit && (
              <PropChip
                label="조정"
                onClick={() => onStartColorEdit(object.id)}
                icon={
                  <>
                    <path
                      d="M5 8h12M5 12h8M5 16h10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </>
                }
              />
            )}
            {isPhoto && onUpscalePhoto && (
              <PropChip
                label={upscaleBusy ? "처리중" : "화질"}
                disabled={upscaleBusy}
                onClick={() => onUpscalePhoto(object.id)}
                icon={
                  <path
                    d="M6 14l4-4 3 3 4-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                }
              />
            )}
            <PropChip
              label="순서"
              active={expand === "order"}
              onClick={() => toggle("order")}
              icon={
                <path
                  d="M6 7h10M6 11h10M6 15h7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              }
            />
            <PropChip
              label="정렬"
              active={expand === "align"}
              onClick={() => toggle("align")}
              icon={
                <path
                  d="M5 6h12M5 12h8M5 18h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              }
            />
            <PropChip
              label="위치"
              active={expand === "position"}
              onClick={() => toggle("position")}
              icon={
                <path
                  d="M11 4v14M4 11h14M7 7l4-3 4 3M7 15l4 3 4-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              }
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white transition active:scale-95"
            aria-label="선택 해제"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  danger,
  active,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
        active
          ? "bg-neutral-900 text-white"
          : danger
            ? "text-red-600 hover:bg-red-50"
            : "text-neutral-800 hover:bg-neutral-100"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function PropChip({
  label,
  onClick,
  icon,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition disabled:opacity-40 ${
        active ? "bg-neutral-900 text-white" : "text-neutral-800 hover:bg-neutral-100"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden>
        {icon}
      </svg>
      <span className="whitespace-nowrap text-[10px] font-medium">{label}</span>
    </button>
  );
}

function Chip({
  label,
  onClick,
  disabled,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`rounded-lg bg-neutral-50 px-2 py-2 text-[11px] font-medium text-neutral-800 ring-1 ring-neutral-200 transition hover:bg-neutral-100 disabled:opacity-40 ${className}`}
    >
      {label}
    </button>
  );
}

function ListRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-medium text-neutral-800 transition hover:bg-neutral-50"
    >
      {label}
      <span className="text-neutral-300">›</span>
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-neutral-500">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        min={min}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-neutral-400"
      />
    </label>
  );
}
