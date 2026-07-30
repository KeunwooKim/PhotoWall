"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getObjectDisplayDimensions,
  objectSupportsSizeEdit,
} from "@/lib/wall-scene/object-dimensions";
import { hasClipboardContent } from "@/lib/wall-scene/clipboard-objects";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";

type SubPanel = null | "order" | "align" | "position";

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
}

function titleFor(object: WallSceneObject | null, count: number): string {
  if (count > 1) return `선택 (${count})`;
  switch (object?.type) {
    case "photo":
      return "사진";
    case "sticker":
    case "emoji":
    case "svg":
      return "스티커";
    case "text":
      return "텍스트";
    case "tape":
      return "테이프";
    case "path":
      return "펜";
    default:
      return "속성";
  }
}

/** Mobile bottom sheet when canvas objects are selected (Miricanvas-style). */
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
}: EditorSelectionSheetProps) {
  const [sub, setSub] = useState<SubPanel>(null);
  const patchObject = useWallSceneStore((s) => s.patchObject);
  const recordHistory = useWallSceneStore((s) => s.recordHistory);
  const bumpRevision = useWallSceneStore((s) => s.bumpRevision);

  useEffect(() => {
    setSub(null);
  }, [object?.id, selectionCount]);

  const applyPatch = useCallback(
    (id: string, patch: Record<string, number>) => {
      recordHistory();
      patchObject(id, patch);
      bumpRevision();
    },
    [bumpRevision, patchObject, recordHistory],
  );

  if (selectionCount === 0) return null;

  const title = titleFor(object, selectionCount);
  const isPhoto = object?.type === "photo" && selectionCount === 1;
  const dims = object ? getObjectDisplayDimensions(object) : null;
  const canEditSize = object ? objectSupportsSizeEdit(object) : false;

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 z-40 md:hidden"
      style={{ bottom: "max(4.75rem, calc(env(safe-area-inset-bottom) + 3.75rem))" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mx-auto max-h-[min(52dvh,28rem)] w-full max-w-lg overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
            aria-label="닫기"
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
        </div>

        <div className="overflow-y-auto px-3 pb-3 pt-2">
          <div className="grid grid-cols-5 gap-1">
            <QuickAction
              label="복사"
              onClick={onCopy}
              icon={
                <path
                  d="M8 8h9v9H8V8zM5 5h9v2M5 5v9h2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  fill="none"
                />
              }
            />
            <QuickAction
              label="붙여넣기"
              onClick={() => {
                if (!hasClipboardContent()) {
                  onToast?.("먼저 복사해 주세요");
                  return;
                }
                onPaste();
              }}
              icon={
                <path
                  d="M8 4h6v2H8V4zm-2 2h10v12H6V6zm3 3h4M9 12h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              }
            />
            <QuickAction
              label="순서"
              onClick={() => setSub(sub === "order" ? null : "order")}
              active={sub === "order"}
              icon={
                <path
                  d="M6 7h10M6 11h10M6 15h7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              }
            />
            <QuickAction
              label="정렬"
              onClick={() => setSub(sub === "align" ? null : "align")}
              active={sub === "align"}
              icon={
                <path
                  d="M5 6h12M5 12h8M5 18h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              }
            />
            <QuickAction
              label="삭제"
              danger
              onClick={onDelete}
              icon={
                <path
                  d="M8 6h6M9 6V5h4v1m-5 2v8m3-8v8m3-8v8M7 8h8l-.5 9H7.5L7 8z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  fill="none"
                />
              }
            />
          </div>

          {sub === "order" && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-50 p-2">
              <Chip label="앞으로" onClick={onBringForward} />
              <Chip label="뒤로" onClick={onSendBackward} />
              <Chip label="맨 앞" onClick={onBringToFront} />
              <Chip label="맨 뒤" onClick={onSendToBack} />
              <Chip label="복제" onClick={onDuplicate} className="col-span-2" />
            </div>
          )}

          {sub === "align" && (
            <div className="mt-2 space-y-1.5 rounded-xl bg-neutral-50 p-2">
              <div className="grid grid-cols-3 gap-1.5">
                <Chip label="왼쪽" onClick={onAlignLeft} disabled={!canAlign} />
                <Chip label="가로중앙" onClick={onAlignCenterH} disabled={!canAlign} />
                <Chip label="오른쪽" onClick={onAlignRight} disabled={!canAlign} />
                <Chip label="위" onClick={onAlignTop} disabled={!canAlign} />
                <Chip label="세로중앙" onClick={onAlignMiddle} disabled={!canAlign} />
                <Chip label="아래" onClick={onAlignBottom} disabled={!canAlign} />
              </div>
              <Chip label="벽 가운데" onClick={onCenterOnWall} className="w-full" />
              {!canAlign && (
                <p className="px-1 text-[10px] text-neutral-400">
                  두 개 이상 선택하면 서로 맞출 수 있어요
                </p>
              )}
            </div>
          )}

          <div className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-100">
            <ListRow
              label="위치 이동"
              onClick={() => setSub(sub === "position" ? null : "position")}
              active={sub === "position"}
            />
            {sub === "position" && object && selectionCount === 1 && (
              <div className="space-y-2 bg-neutral-50 px-3 py-2.5">
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
                            applyPatch(object.id, {
                              width: Math.max(40, width) / scaleX,
                            });
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
              </div>
            )}
            {sub === "position" && selectionCount > 1 && (
              <div className="bg-neutral-50 px-3 py-2.5">
                {onNudge ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <span />
                    <Chip label="↑" onClick={() => onNudge(0, -4)} />
                    <span />
                    <Chip label="←" onClick={() => onNudge(-4, 0)} />
                    <Chip label="↓" onClick={() => onNudge(0, 4)} />
                    <Chip label="→" onClick={() => onNudge(4, 0)} />
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">캔버스에서 드래그해 이동하세요</p>
                )}
              </div>
            )}

            <ListRow
              label="여러 요소 선택"
              onClick={() =>
                onToast?.("다른 요소를 길게 누르거나, 키보드에서 Shift를 누른 채 탭하세요")
              }
            />
            {onSelectAll && (
              <ListRow label="전체 선택" onClick={onSelectAll} />
            )}

            {isPhoto && onStartCrop && (
              <ListRow label="자르기" onClick={() => onStartCrop(object.id)} />
            )}
            {isPhoto && onStartColorEdit && (
              <ListRow label="색 보정" onClick={() => onStartColorEdit(object.id)} />
            )}
            {isPhoto && onUpscalePhoto && (
              <ListRow
                label={upscaleBusy ? "업스케일 중…" : "화질 업스케일"}
                disabled={upscaleBusy}
                onClick={() => onUpscalePhoto(object.id)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
  icon,
  active,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition ${
        active
          ? "bg-neutral-900 text-white"
          : danger
            ? "text-red-600 hover:bg-red-50"
            : "text-neutral-800 hover:bg-neutral-100"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden>
        {icon}
      </svg>
      <span className="text-[10px] font-medium">{label}</span>
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
      className={`rounded-lg bg-white px-2 py-2 text-[11px] font-medium text-neutral-800 ring-1 ring-neutral-200 transition hover:bg-neutral-100 disabled:opacity-40 ${className}`}
    >
      {label}
    </button>
  );
}

function ListRow({
  label,
  onClick,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between px-3 py-3 text-left text-[13px] font-medium transition disabled:opacity-40 ${
        active ? "bg-neutral-50 text-neutral-900" : "text-neutral-800 hover:bg-neutral-50"
      }`}
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
