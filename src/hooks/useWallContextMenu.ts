"use client";

import { useCallback, useEffect, useState } from "react";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export function useWallContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });

  const close = useCallback(() => setIsOpen(false), []);

  const openAt = useCallback((clientX: number, clientY: number) => {
    setPosition({ x: clientX, y: clientY });
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, isOpen]);

  return { isOpen, position, openAt, close };
}
