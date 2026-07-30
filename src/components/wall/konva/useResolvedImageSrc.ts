"use client";

import { useEffect, useState } from "react";
import { getCachedPhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";

function isResolvablePhotoRef(src: string): boolean {
  return isWallPhotoRef(src) || isGuestPhotoRef(src);
}

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

    void (async () => {
      try {
        const next = await resolvePhotoSrc(src);
        if (cancelled) return;
        if (isResolvablePhotoRef(next)) {
          setDisplaySrc(null);
          return;
        }
        setDisplaySrc(next);
      } catch {
        if (!cancelled) setDisplaySrc(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, resolvePhotoSrc]);

  return displaySrc;
}
