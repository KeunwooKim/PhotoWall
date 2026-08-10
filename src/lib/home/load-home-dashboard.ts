import type { SupabaseClient } from "@supabase/supabase-js";
import { extractRecentWallPhotoPaths } from "@/lib/home/recent-wall-photos";
import { ensureProfile, getFriends } from "@/lib/supabase/profiles";
import {
  getPendingWallInvites,
  getSharedWallsForUser,
} from "@/lib/supabase/shared-walls";
import { listInboxNotices } from "@/lib/supabase/user-inbox";
import { listVisibleWallActivityNotices } from "@/lib/supabase/wall-activity-notices";
import { fetchPersonalWallForOwner } from "@/lib/supabase/walls";
import { createWallPhotoSignedUrls } from "@/lib/storage/signed-urls-server";
import type { Friend, Profile } from "@/types/profile";
import type { SharedWall, WallMemberInvite } from "@/types/shared-wall";
import type { PublishedWall } from "@/types/wall";
import type { WallActivityNotice } from "@/types/wall-activity-notice";
import type { InboxNotice } from "@/lib/supabase/user-inbox";

export type HomeDashboardData = {
  profile: Profile | null;
  mine: PublishedWall | null;
  sharedWalls: SharedWall[];
  friends: Friend[];
  invites: WallMemberInvite[];
  wallActivities: WallActivityNotice[];
  inboxNotices: InboxNotice[];
  recentPhotoUrls: string[];
};

export async function loadHomeDashboard(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<HomeDashboardData> {
  const userId = user.id;
  const [profile, mine, sharedResult, friends, invites, wallActivities, inboxNotices] =
    await Promise.all([
      ensureProfile(supabase, user),
      fetchPersonalWallForOwner(userId, supabase),
      getSharedWallsForUser(supabase, userId),
      getFriends(supabase, userId),
      getPendingWallInvites(supabase, userId),
      listVisibleWallActivityNotices(supabase, userId),
      listInboxNotices(supabase, userId),
    ]);

  let recentPhotoUrls: string[] = [];
  if (mine?.id && mine.canvasJson) {
    const paths = extractRecentWallPhotoPaths(mine.canvasJson, 6);
    if (paths.length > 0) {
      const signed = await createWallPhotoSignedUrls(paths, supabase, userId);
      recentPhotoUrls = paths.map((p) => signed[p]).filter(Boolean) as string[];
    }
  }

  return {
    profile: profile ?? null,
    mine: mine ?? null,
    sharedWalls: sharedResult.walls ?? [],
    friends: friends ?? [],
    invites: invites ?? [],
    wallActivities: wallActivities ?? [],
    inboxNotices: inboxNotices ?? [],
    recentPhotoUrls,
  };
}
