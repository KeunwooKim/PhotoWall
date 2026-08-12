import type { UserPlan } from "@/lib/wall-quotas";

/**
 * Plan used for ad / house-banner gating.
 * - `undefined` — auth or profile still loading (do not show ads yet)
 * - `null` — logged-out guest
 * - `free` | `premium` — known
 */
export type AdPlan = UserPlan | null | undefined;

export function resolveAdPlan(input: {
  user: boolean;
  authLoading?: boolean;
  profile: { plan?: string | null } | null;
}): AdPlan {
  if (input.authLoading) return undefined;
  if (!input.user) return null;
  if (!input.profile) return undefined;
  return input.profile.plan === "premium" ? "premium" : "free";
}
