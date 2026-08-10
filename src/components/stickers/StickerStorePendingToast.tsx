"use client";

import { useEffect } from "react";
import { STICKER_STORE_PENDING_TOAST_KEY } from "@/lib/stickers/store-gate";
import { useStickerStoreGate } from "@/hooks/useStickerStoreGate";

/** Shows a toast after redirect from a disabled /stickers URL. Mount on home. */
export default function StickerStorePendingToast() {
  const { notifyUnavailable, Toast } = useStickerStoreGate();

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STICKER_STORE_PENDING_TOAST_KEY)) return;
      sessionStorage.removeItem(STICKER_STORE_PENDING_TOAST_KEY);
      notifyUnavailable();
    } catch {
      // ignore
    }
  }, [notifyUnavailable]);

  return Toast;
}
