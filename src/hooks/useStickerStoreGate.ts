"use client";

import { useCallback, type MouseEvent } from "react";
import {
  STICKER_STORE_ENABLED,
  STICKER_STORE_UNAVAILABLE_MESSAGE,
} from "@/lib/stickers/store-gate";
import { useAppToast } from "@/hooks/useAppToast";

export function useStickerStoreGate() {
  const { showToast, Toast } = useAppToast();

  const notifyUnavailable = useCallback(() => {
    showToast(STICKER_STORE_UNAVAILABLE_MESSAGE);
  }, [showToast]);

  const handleStoreClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (STICKER_STORE_ENABLED) return;
      event.preventDefault();
      notifyUnavailable();
    },
    [notifyUnavailable],
  );

  return {
    enabled: STICKER_STORE_ENABLED,
    handleStoreClick,
    notifyUnavailable,
    Toast,
  };
}
