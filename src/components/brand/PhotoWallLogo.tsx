"use client";

import Link from "next/link";
import PhotoWallMark from "@/components/brand/PhotoWallMark";
import { BRAND_LOCKUP } from "@/lib/brand/assets";

type Variant = "lockup" | "mark";

interface PhotoWallLogoProps {
  variant?: Variant;
  wordmarkClassName?: string;
  /** Inner mark fill when page uses a non-theme background. */
  markFill?: string;
  height?: number;
  href?: string;
  className?: string;
}

export default function PhotoWallLogo({
  variant = "lockup",
  wordmarkClassName = "text-foreground",
  markFill,
  height,
  href = "/",
  className = "",
}: PhotoWallLogoProps) {
  const isLockup = variant === "lockup";
  const totalHeight = height ?? (isLockup ? 36 : 32);

  const markSize = isLockup ? Math.round(totalHeight * (BRAND_LOCKUP.markSize / 36)) : totalHeight;
  const wordSize = isLockup ? Math.round(totalHeight * (BRAND_LOCKUP.wordSize / 36)) : 0;
  const gap = isLockup ? Math.round(totalHeight * (BRAND_LOCKUP.gap / 36)) : 0;

  const content = isLockup ? (
    <span className={`inline-flex items-center ${className}`} style={{ gap }}>
      <PhotoWallMark size={markSize} fill={markFill} />
      <span
        className={`font-semibold leading-none tracking-[-0.02em] ${wordmarkClassName}`}
        style={{ fontSize: wordSize }}
      >
        PhotoWall
      </span>
    </span>
  ) : (
    <PhotoWallMark size={markSize} fill={markFill} className={className} />
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center" aria-label="PhotoWall 홈">
      {content}
    </Link>
  );
}
