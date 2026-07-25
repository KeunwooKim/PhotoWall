export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  wallId: string | null;
  allowWallVisits: boolean;
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
