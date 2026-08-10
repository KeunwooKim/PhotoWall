"use client";

import Script from "next/script";

/**
 * Optional Plausible analytics. Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN=photowall.kr
 * (and optionally NEXT_PUBLIC_PLAUSIBLE_SRC for self-hosted script URL).
 */
export default function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return null;

  const src =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SRC?.trim() || "https://plausible.io/js/script.js";

  return (
    <Script defer data-domain={domain} src={src} strategy="afterInteractive" />
  );
}
