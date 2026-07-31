import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserPlan } from "@/lib/wall-quotas";

export function parseUserPlan(value: unknown): UserPlan {
  return value === "premium" ? "premium" : "free";
}

/**
 * Resolve billing plan for wall quotas from `profiles.plan`.
 * Falls back to free if the column is missing or the row is absent.
 */
export async function getUserPlan(
  userId: string,
  supabase?: SupabaseClient,
): Promise<UserPlan> {
  if (!supabase || !userId) return "free";

  const { data, error } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return "free";
  return parseUserPlan((data as { plan?: string | null }).plan);
}
