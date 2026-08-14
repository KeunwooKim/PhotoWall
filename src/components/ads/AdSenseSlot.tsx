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
  slot?: string | null;
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
    !loading && flags.adsense && clientId && planKnown && plan !== "premium",
  );

  useEffect(() => {
    if (!show || !insRef.current) return;
    const el = insRef.current;

    const pushIfVisible = () => {
      if (pushed.current) return true;
      // Home mounts mobile+desktop copies; display:none units error if pushed.
      if (el.getBoundingClientRect().width < 2) return false;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch {
        // blocked or script not ready
      }
      return pushed.current;
    };

    if (pushIfVisible()) return;

    const ro = new ResizeObserver(() => {
      if (pushIfVisible()) ro.disconnect();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [show, slot]);

  if (!show) return null;

  return (
    <div
      className={`group w-full [&:has([data-ad-status=unfilled])]:hidden ${className}`}
      role="complementary"
      aria-label="광고"
    >
      <p className="mb-1.5 hidden text-center text-[10px] font-medium tracking-wide text-muted group-has-[[data-ad-status=filled]]:block">
        광고
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle block w-full data-[ad-status=filled]:min-h-[90px] data-[ad-status=filled]:overflow-hidden data-[ad-status=filled]:rounded-xl data-[ad-status=filled]:border data-[ad-status=filled]:border-foreground/8 data-[ad-status=filled]:bg-foreground/[0.02]"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slot || undefined}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
