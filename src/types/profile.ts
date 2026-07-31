import type { UserPlan } from "@/lib/wall-quotas";

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  wallId: string | null;
  allowWallVisits: boolean;
  /** Billing plan — UI label uses PLAN_UI_NAME (플러스). */
  plan: UserPlan;
  /** ISO timestamp when terms/privacy were accepted */
  legalConsentedAt: string | null;
  legalVersion: string | null;
}

export interface Friend {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  wallId: string | null;
  wallVisitable: boolean;
}
