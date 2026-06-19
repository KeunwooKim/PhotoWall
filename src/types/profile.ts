export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  wallId: string | null;
  allowWallVisits: boolean;
}

export interface Friend {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  wallId: string | null;
  wallVisitable: boolean;
}
