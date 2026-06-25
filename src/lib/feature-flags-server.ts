import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_LABELS,
  mergeFeatureFlags,
  type FeatureFlag,
  type FeatureFlagKey,
} from "@/lib/feature-flags";
import { getSupabaseServer } from "@/lib/supabase/walls";

export async function fetchFeatureFlags(
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<Record<FeatureFlagKey, boolean>> {
  if (!supabase) return { ...DEFAULT_FEATURE_FLAGS };

  const { data, error } = await supabase.from("feature_flags").select("key, enabled");
  if (error || !data) return { ...DEFAULT_FEATURE_FLAGS };

  return mergeFeatureFlags(data);
}

export async function isFeatureEnabled(
  key: FeatureFlagKey,
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<boolean> {
  const flags = await fetchFeatureFlags(supabase);
  return flags[key];
}

export async function fetchFeatureFlagRows(
  supabase: SupabaseClient,
): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled, label, description, updated_at")
    .order("key");

  if (error || !data) {
    return FEATURE_FLAG_KEYS.map((key) => ({
      key,
      enabled: DEFAULT_FEATURE_FLAGS[key],
      label: FEATURE_FLAG_LABELS[key].label,
      description: FEATURE_FLAG_LABELS[key].description,
      updatedAt: new Date(0).toISOString(),
    }));
  }

  const byKey = new Map(data.map((row) => [row.key, row]));

  return FEATURE_FLAG_KEYS.map((key) => {
    const row = byKey.get(key);
    if (!row) {
      return {
        key,
        enabled: DEFAULT_FEATURE_FLAGS[key],
        label: FEATURE_FLAG_LABELS[key].label,
        description: FEATURE_FLAG_LABELS[key].description,
        updatedAt: new Date(0).toISOString(),
      };
    }
    return {
      key,
      enabled: row.enabled,
      label: row.label || FEATURE_FLAG_LABELS[key].label,
      description: row.description || FEATURE_FLAG_LABELS[key].description,
      updatedAt: row.updated_at,
    };
  });
}

export function featureDisabledResponse(feature: string) {
  return {
    error: "feature_disabled",
    message: `${feature} 기능이 일시적으로 중단되었어요`,
  };
}
