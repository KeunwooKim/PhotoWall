"use client";

import Link from "next/link";
import PhotoWallMark from "@/components/brand/PhotoWallMark";
import { BRAND, BRAND_LOCKUP } from "@/lib/brand/assets";

type Variant = "lockup" | "mark";
type Tone = "auto" | "light" | "dark";

interface PhotoWallLogoProps {
  variant?: Variant;
  /** @deprecated Lockup is a raster from the V5 header; kept for call-site compat. */
  wordmarkClassName?: string;
  /** @deprecated Mark raster is already transparent; kept for call-site compat. */
  markFill?: string;
  height?: number;
  href?: string;
  className?: string;
  /** Force light/dark lockup asset; default follows `html.dark`. */
  tone?: Tone;
}

export default function PhotoWallLogo({
  variant = "lockup",
  height,
  href = "/",
  className = "",
  tone = "auto",
}: PhotoWallLogoProps) {
  const isLockup = variant === "lockup";
  const totalHeight = height ?? (isLockup ? BRAND_LOCKUP.height : 32);

  const content = isLockup ? (
    <span className={`relative inline-flex items-center ${className}`} style={{ height: totalHeight }}>
      {(tone === "auto" || tone === "light") && (
        // eslint-disable-next-line @next/next/no-img-element -- brand lockup raster from design concepts
        <img
          src={BRAND.lockupLight}
          srcSet={`${BRAND.lockupLight} 1x, ${BRAND.lockupLight2x} 2x`}
          alt=""
          draggable={false}
          decoding="async"
          height={totalHeight}
          className={`block h-full w-auto ${tone === "auto" ? "dark:hidden" : ""}`}
        />
      )}
      {(tone === "auto" || tone === "dark") && (
        // eslint-disable-next-line @next/next/no-img-element -- brand lockup raster from design concepts
        <img
          src={BRAND.lockupDark}
          srcSet={`${BRAND.lockupDark} 1x, ${BRAND.lockupDark2x} 2x`}
          alt=""
          draggable={false}
          decoding="async"
          height={totalHeight}
          className={`block h-full w-auto ${tone === "auto" ? "hidden dark:block" : ""}`}
        />
      )}
    </span>
  ) : (
    <PhotoWallMark size={totalHeight} className={className} />
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="PhotoWall 홈">
      {content}
    </Link>
  );
}
