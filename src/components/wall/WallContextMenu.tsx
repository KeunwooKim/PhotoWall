"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  WallContextMenuSection,
} from "@/lib/wall-scene/build-context-menu-sections";
import type { ContextMenuPosition } from "@/hooks/useWallContextMenu";

interface WallContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  sections: WallContextMenuSection[];
  onClose: () => void;
}

export default function WallContextMenu({
  isOpen,
  position,
  sections,
  onClose,
}: WallContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState(position);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const menu = menuRef.current;
    const margin = 8;
    const width = menu?.offsetWidth ?? 220;
    const height = menu?.offsetHeight ?? 320;

    setCoords({
      x: Math.max(margin, Math.min(position.x, window.innerWidth - width - margin)),
      y: Math.max(margin, Math.min(position.y, window.innerHeight - height - margin)),
    });
  }, [isOpen, position.x, position.y, sections]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || sections.length === 0) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="개체 메뉴"
      className="fixed z-[200] min-w-[200px] max-w-[min(88vw,260px)] overflow-y-auto rounded-xl border border-foreground/10 bg-surface py-1.5 shadow-xl"
      style={{
        left: coords.x,
        top: coords.y,
        maxHeight: "min(70dvh, 480px)",
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {sections.map((section, sectionIndex) => (
        <div key={section.title ?? sectionIndex}>
          {sectionIndex > 0 && (
            <div className="my-1 border-t border-foreground/8" role="separator" />
          )}
          {section.title && (
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {section.title}
            </p>
          )}
          <ul>
            {section.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={item.onClick}
                  className={`flex w-full px-3 py-2.5 text-left text-sm transition active:bg-foreground/6 ${
                    item.disabled
                      ? "cursor-not-allowed text-muted opacity-40"
                      : item.destructive
                        ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        : "text-foreground hover:bg-foreground/5"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
