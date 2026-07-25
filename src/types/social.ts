export interface WallInvite {
  id: string;
  wallId: string;
  code: string;
  createdAt: string;
}

export interface WallLikesSummary {
  count: number;
  likedByMe: boolean;
}
