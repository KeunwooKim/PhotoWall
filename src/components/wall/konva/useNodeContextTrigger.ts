"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";
import { useWallContextMenuRequest } from "./wall-context-menu-context";

const LONG_PRESS_MS = 480;
const MOVE_CANCEL_PX = 10;

function clientPoint(event: MouseEvent | TouchEvent | PointerEvent) {
  if ("clientX" in event) {
    return { x: event.clientX, y: event.clientY };
  }
  const touch = event.touches[0] ?? event.changedTouches[0];
  return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
}

/** 길게 누르기는 터치 전용 — PC는 우클릭으로 메뉴 */
function isTouchLike(event: MouseEvent | TouchEvent | PointerEvent): boolean {
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) return true;
  if ("pointerType" in event && event.pointerType === "touch") return true;
  return false;
}

type KonvaInputEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>;

export function useNodeContextTrigger(objectId: string, enabled: boolean) {
  const onContextMenuRequest = useWallContextMenuRequest();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelLongPress = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  const openMenu = useCallback(
    (clientX: number, clientY: number) => {
      onContextMenuRequest?.(clientX, clientY, objectId);
    },
    [objectId, onContextMenuRequest],
  );

  const handlePointerDown = useCallback(
    (event: KonvaInputEvent) => {
      if (!enabled || !onContextMenuRequest) return;

      longPressRef.current = false;
      clearTimer();
      startRef.current = null;

      if (!isTouchLike(event.evt)) return;

      const { x: clientX, y: clientY } = clientPoint(event.evt);
      startRef.current = { x: clientX, y: clientY };

      timerRef.current = setTimeout(() => {
        longPressRef.current = true;
        openMenu(clientX, clientY);
      }, LONG_PRESS_MS);
    },
    [clearTimer, enabled, onContextMenuRequest, openMenu],
  );

  const handlePointerMove = useCallback(
    (event: KonvaInputEvent) => {
      const start = startRef.current;
      if (!start) return;

      const { x, y } = clientPoint(event.evt);
      const dx = x - start.x;
      const dy = y - start.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const handlePointerUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handleContextMenu = useCallback(
    (event: KonvaInputEvent) => {
      if (!enabled || !onContextMenuRequest) return;
      event.evt.preventDefault();
      cancelLongPress();
      const { x, y } = clientPoint(event.evt);
      openMenu(x, y);
    },
    [cancelLongPress, enabled, onContextMenuRequest, openMenu],
  );

  const didLongPress = useCallback(() => longPressRef.current, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleContextMenu,
    cancelLongPress,
    didLongPress,
  };
}
