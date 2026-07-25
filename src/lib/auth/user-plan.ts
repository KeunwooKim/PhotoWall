import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserPlan } from "@/lib/wall-quotas";

/**
 * Resolve billing plan for wall quotas.
 * Premium is stubbed until subscriptions ship — always free for now.
 */
export async function getUserPlan(
  _userId: string,
  _supabase?: SupabaseClient,
): Promise<UserPlan> {
  return "free";
}
