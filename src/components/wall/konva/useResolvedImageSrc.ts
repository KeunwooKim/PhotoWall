"use client";

import { useEffect, useState } from "react";
import { getCachedPhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";

export function useResolvedImageSrc(
  src: string,
  resolvePhotoSrc?: (src: string) => Promise<string>,
): string | null {
  const [displaySrc, setDisplaySrc] = useState<string | null>(() => {
    if (!isWallPhotoRef(src)) return src;
    return getCachedPhotoDisplayUrl(src);
  });

  useEffect(() => {
    let cancelled = false;

    if (!isWallPhotoRef(src)) {
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
        if (isWallPhotoRef(next)) {
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
