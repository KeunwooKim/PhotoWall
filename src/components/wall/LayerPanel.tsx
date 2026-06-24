"use client";

import { useMemo } from "react";
import { bringObjectForward, sendObjectBackward } from "@/lib/wall-scene/layer-order";
import { getObjectLabel } from "@/lib/wall-scene/object-labels";
import { isSelectableObject } from "@/lib/wall-scene/selectable-objects";
import { useWallSceneStore } from "@/stores/wall-scene-store";

interface LayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LayerPanel({ isOpen, onClose }: LayerPanelProps) {
  const objects = useWallSceneStore((s) => s.document.objects);
  const selectedIds = useWallSceneStore((s) => s.selectedIds);
  const setSelectedIds = useWallSceneStore((s) => s.setSelectedIds);

  const layers = useMemo(
    () =>
      [...objects]
        .filter(isSelectableObject)
        .sort((a, b) => b.zIndex - a.zIndex),
    [objects],
  );

  const selected = new Set(selectedIds);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="레이어"
        className={`fixed right-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-center justify-between border-b border-foreground/8 px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold">레이어</h2>
            <p className="mt-0.5 text-xs text-muted">앞에 있을수록 위에 보여요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-foreground/5"
            aria-label="레이어 닫기"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {layers.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted">레이어가 없어요</p>
          ) : (
            <ul className="space-y-1">
              {layers.map((object) => {
                const isSelected = selected.has(object.id);
                return (
                  <li
                    key={object.id}
                    className={`flex items-center gap-2 rounded-xl border px-2 py-2 transition ${
                      isSelected
                        ? "border-foreground/20 bg-foreground/6"
                        : "border-transparent hover:bg-foreground/4"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIds([object.id])}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-medium">{getObjectLabel(object)}</p>
                      <p className="truncate text-[10px] text-muted">
                        {object.groupId ? "그룹 · " : ""}
                        {object.type}
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconButton
                        label="앞으로"
                        onClick={() => bringObjectForward(object.id)}
                        disabled={object.zIndex >= layers[0]?.zIndex}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label="뒤로"
                        onClick={() => sendObjectBackward(object.id)}
                        disabled={object.zIndex <= layers[layers.length - 1]?.zIndex}
                      >
                        ↓
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition active:scale-95 ${
        disabled
          ? "cursor-not-allowed opacity-30"
          : "text-muted hover:bg-foreground/6 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
