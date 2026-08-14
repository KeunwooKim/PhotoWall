"use client";

import Link from "next/link";
import PhotoWallMark from "@/components/brand/PhotoWallMark";
import { BRAND, BRAND_LOCKUP } from "@/lib/brand/assets";
import { useResolvedColorScheme } from "@/providers/ThemeProvider";

type Variant = "lockup" | "mark";
type Tone = "auto" | "light" | "dark";

interface PhotoWallLogoProps {
  variant?: Variant;
  /** @deprecated Lockup is a raster from design/logo-concepts; kept for call-site compat. */
  wordmarkClassName?: string;
  /** @deprecated Mark raster is already transparent; kept for call-site compat. */
  markFill?: string;
  height?: number;
  href?: string;
  className?: string;
  /** Force light/dark lockup asset; default follows the app theme. */
  tone?: Tone;
}

export default function PhotoWallLogo({
  variant = "lockup",
  height,
  href = "/",
  className = "",
  tone = "auto",
}: PhotoWallLogoProps) {
  const scheme = useResolvedColorScheme();
  const isLockup = variant === "lockup";
  const totalHeight = height ?? (isLockup ? BRAND_LOCKUP.height : 32);
  const activeTone = tone === "auto" ? scheme : tone;
  const lockupSrc = activeTone === "dark" ? BRAND.lockupDark : BRAND.lockupLight;
  const lockupSrc2x = activeTone === "dark" ? BRAND.lockupDark2x : BRAND.lockupLight2x;

  const content = isLockup ? (
    <span className={`relative inline-flex items-center ${className}`} style={{ height: totalHeight }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- brand lockup raster from design concepts */}
      <img
        src={lockupSrc}
        srcSet={`${lockupSrc} 1x, ${lockupSrc2x} 2x`}
        alt=""
        draggable={false}
        decoding="async"
        height={totalHeight}
        className="block h-full w-auto"
      />
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
