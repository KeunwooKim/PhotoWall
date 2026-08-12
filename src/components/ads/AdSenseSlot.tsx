"use client";

import { useEffect, useRef } from "react";
import { getAdSenseClientId } from "@/lib/ads/adsense";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import type { AdPlan } from "@/lib/ads/resolve-ad-plan";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

interface AdSenseSlotProps {
  slot: string | null | undefined;
  /** Hidden for 플러스; `undefined` waits until plan is known. Default null = guest. */
  plan?: AdPlan;
  className?: string;
  format?: "auto" | "horizontal" | "rectangle";
}

export default function AdSenseSlot({
  slot,
  plan,
  className = "",
  format = "auto",
}: AdSenseSlotProps) {
  const { flags, loading } = useFeatureFlags();
  const clientId = getAdSenseClientId();
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  // Omitted plan (landing) and null (guest) may show; undefined waits; premium never.
  const planKnown = plan !== undefined;
  const show = Boolean(
    !loading &&
      flags.adsense &&
      clientId &&
      slot &&
      planKnown &&
      plan !== "premium",
  );

  useEffect(() => {
    if (!show || pushed.current || !insRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // blocked or script not ready
    }
  }, [show, slot]);

  if (!show) return null;

  return (
    <div className={className} role="complementary" aria-label="광고">
      <p className="mb-1.5 text-center text-[10px] font-medium tracking-wide text-muted">광고</p>
      <ins
        ref={insRef}
        className="adsbygoogle block min-h-[90px] overflow-hidden rounded-xl border border-foreground/8 bg-foreground/[0.02]"
        style={{ display: "block" }}
        data-ad-client={clientId!}
        data-ad-slot={slot!}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
