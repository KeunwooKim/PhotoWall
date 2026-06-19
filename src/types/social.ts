export interface WallComment {
  id: string;
  wallId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

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
