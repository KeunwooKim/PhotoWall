export interface WallActivityNotice {
  id: string;
  wallId: string;
  wallTitle: string;
  actorName: string;
  actorAvatarUrl: string | null;
  updatedAt: string;
  visibleAt: string;
}
