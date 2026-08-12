"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { getAdSenseClientId } from "@/lib/ads/adsense";
import { DEFAULT_FEATURE_FLAGS } from "@/lib/feature-flags";

/** Loads AdSense script when admin enables adsense and client ID is configured. */
export default function AdSenseBootstrap() {
  const clientId = getAdSenseClientId();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    fetch("/api/feature-flags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { adsense?: boolean } | null) => {
        if (cancelled) return;
        const on = data?.adsense ?? DEFAULT_FEATURE_FLAGS.adsense;
        setEnabled(on);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId || !enabled) return null;

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
