import type { UserPlan } from "@/lib/wall-quotas";
import type { ColorPaletteId } from "@/lib/color-palettes";
import type { ThemeMode } from "@/lib/settings-storage";

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  wallId: string | null;
  /** Personal wall title (`walls.title`); null if no wall or untitled */
  wallTitle: string | null;
  allowWallVisits: boolean;
  /** Billing plan — UI label uses PLAN_UI_NAME (플러스). */
  plan: UserPlan;
  /** App brightness preference — synced when logged in */
  themeMode: ThemeMode;
  /** App color palette — synced when logged in */
  colorPalette: ColorPaletteId;
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
