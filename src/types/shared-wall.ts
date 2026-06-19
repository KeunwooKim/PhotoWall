export type WallMemberRole = "owner" | "editor" | "viewer";

export interface SharedWallMember {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: WallMemberRole;
}

export interface SharedWall {
  id: string;
  title: string;
  themeId: string;
  updatedAt: string;
  myRole: WallMemberRole;
  memberCount: number;
  members?: SharedWallMember[];
}

export interface WallMemberInvite {
  id: string;
  wallId: string;
  wallTitle: string;
  inviterName: string;
  inviterAvatarUrl: string | null;
  createdAt: string;
}
