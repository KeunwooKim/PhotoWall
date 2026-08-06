"use client";

import { useEffect, useState } from "react";
import { getCachedPhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";

function isResolvablePhotoRef(src: string): boolean {
  return isWallPhotoRef(src) || isGuestPhotoRef(src);
}

const RETRY_DELAYS_MS = [400, 1200, 2500];

export function useResolvedImageSrc(
  src: string,
  resolvePhotoSrc?: (src: string) => Promise<string>,
): string | null {
  const [displaySrc, setDisplaySrc] = useState<string | null>(() => {
    if (!isResolvablePhotoRef(src)) return src;
    return getCachedPhotoDisplayUrl(src);
  });

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    if (!isResolvablePhotoRef(src)) {
      setDisplaySrc(src);
      return;
    }

    const cached = getCachedPhotoDisplayUrl(src);
    if (cached) {
      setDisplaySrc(cached);
      return;
    }

    if (!resolvePhotoSrc) {
      setDisplaySrc(null);
      return;
    }

    const attempt = async (retryIndex: number) => {
      try {
        const next = await resolvePhotoSrc(src);
        if (cancelled) return;
        if (isResolvablePhotoRef(next)) {
          setDisplaySrc(null);
          const delay = RETRY_DELAYS_MS[retryIndex];
          if (delay != null) {
            retryTimer = setTimeout(() => {
              void attempt(retryIndex + 1);
            }, delay);
          }
          return;
        }
        setDisplaySrc(next);
      } catch {
        if (cancelled) return;
        setDisplaySrc(null);
        const delay = RETRY_DELAYS_MS[retryIndex];
        if (delay != null) {
          retryTimer = setTimeout(() => {
            void attempt(retryIndex + 1);
          }, delay);
        }
      }
    };

    void attempt(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [src, resolvePhotoSrc]);

  return displaySrc;
}
