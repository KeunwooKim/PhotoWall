"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  STICKER_STORE_ENABLED,
  STICKER_STORE_PENDING_TOAST_KEY,
} from "@/lib/stickers/store-gate";

/** Redirect direct /stickers visits while the store is disabled. */
export default function StickerStoreRouteGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (STICKER_STORE_ENABLED) return;
    try {
      sessionStorage.setItem(STICKER_STORE_PENDING_TOAST_KEY, "1");
    } catch {
      // ignore
    }
    router.replace("/");
  }, [router]);

  if (!STICKER_STORE_ENABLED) return null;
  return <>{children}</>;
}
