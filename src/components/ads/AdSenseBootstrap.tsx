"use client";

import Script from "next/script";
import { getAdSenseClientId } from "@/lib/ads/adsense";

/**
 * AdSense head script (ca-pub-…).
 * Loads whenever client ID is configured — required for site verification / Auto ads.
 * Individual ad units still respect the `adsense` feature flag via AdSenseSlot.
 */
export default function AdSenseBootstrap() {
  const clientId = getAdSenseClientId();
  if (!clientId) return null;

  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
