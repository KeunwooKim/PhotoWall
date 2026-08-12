"use client";

import { BRAND } from "@/lib/brand/assets";

interface PhotoWallMarkProps {
  size?: number;
  className?: string;
  /**
   * Kept for call-site compatibility (promo light/dark fills).
   * Raster mark is already transparent — unused.
   */
  fill?: string;
}

/** V5 mark — transparent webp from design/logo-concepts (see scripts/optimize-brand-assets.mjs). */
export default function PhotoWallMark({
  size = 32,
  className = "",
}: PhotoWallMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small brand mark; avoid next/image layout shift in headers
    <img
      src={BRAND.mark}
      srcSet={`${BRAND.mark} 1x, ${BRAND.mark2x} 2x`}
      width={size}
      height={size}
      alt=""
      draggable={false}
      decoding="async"
      className={`block shrink-0 ${className}`}
    />
  );
}
