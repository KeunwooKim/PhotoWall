"use client";

import { useId } from "react";

interface PhotoWallMarkProps {
  size?: number;
  className?: string;
  /** Inner square fill — defaults to page background via CSS variable. */
  fill?: string;
}

/** V5 — 2×2 filled grid + gradient stroke (crisp, transparent canvas). */
export default function PhotoWallMark({
  size = 32,
  className = "",
  fill = "var(--background)",
}: PhotoWallMarkProps) {
  const gradId = `pw-mark-grad-${useId().replace(/:/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`block shrink-0 ${className}`}
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="20" x2="36" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF5B8D" />
          <stop offset="1" stopColor="#B8E0D2" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="14" height="14" rx="3.5" fill={fill} stroke={`url(#${gradId})`} strokeWidth="2.2" />
      <rect x="21" y="5" width="14" height="14" rx="3.5" fill={fill} stroke={`url(#${gradId})`} strokeWidth="2.2" />
      <rect x="5" y="21" width="14" height="14" rx="3.5" fill={fill} stroke={`url(#${gradId})`} strokeWidth="2.2" />
      <rect x="21" y="21" width="14" height="14" rx="3.5" fill={fill} stroke={`url(#${gradId})`} strokeWidth="2.2" />
    </svg>
  );
}
