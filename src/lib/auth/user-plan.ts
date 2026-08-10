import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserPlan } from "@/lib/wall-quotas";

export function parseUserPlan(value: unknown): UserPlan {
  return value === "premium" ? "premium" : "free";
}

/** Effective plan: premium past plan_expires_at counts as free. */
export function resolveEffectivePlan(
  plan: unknown,
  expiresAt?: string | null,
): UserPlan {
  const base = parseUserPlan(plan);
  if (base !== "premium") return "free";
  if (!expiresAt) return "premium";
  const ends = Date.parse(expiresAt);
  if (!Number.isFinite(ends) || ends > Date.now()) return "premium";
  return "free";
}

export function isPlanExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  const ends = Date.parse(expiresAt);
  return Number.isFinite(ends) && ends <= Date.now();
}

/**
 * Resolve billing plan for wall quotas from `profiles.plan` (+ expiry).
 * Falls back to free if the column is missing or the row is absent.
 * Lazily clears expired premium when the caller has write access.
 */
export async function getUserPlan(
  userId: string,
  supabase?: SupabaseClient,
): Promise<UserPlan> {
  if (!supabase || !userId) return "free";

  const { data, error } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    // Older DBs without plan_expires_at — retry plan only.
    if (error?.message?.includes("plan_expires_at")) {
      const fallback = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", userId)
        .maybeSingle();
      if (fallback.error || !fallback.data) return "free";
      return parseUserPlan((fallback.data as { plan?: string | null }).plan);
    }
    return "free";
  }

  const row = data as { plan?: string | null; plan_expires_at?: string | null };
  const effective = resolveEffectivePlan(row.plan, row.plan_expires_at);

  if (
    parseUserPlan(row.plan) === "premium" &&
    effective === "free" &&
    row.plan_expires_at
  ) {
    void supabase
      .from("profiles")
      .update({
        plan: "free",
        plan_expires_at: null,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .then(() => undefined, () => undefined);
  }

  return effective;
}

/** ISO timestamp for now + N days (UTC). */
export function planExpiryAfterDays(days: number, from = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
