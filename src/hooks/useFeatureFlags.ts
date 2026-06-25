"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/feature-flags";

export function useFeatureFlags() {
  const [flags, setFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/feature-flags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<FeatureFlagKey, boolean> | null) => {
        if (!cancelled && data) setFlags({ ...DEFAULT_FEATURE_FLAGS, ...data });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { flags, loading };
}
