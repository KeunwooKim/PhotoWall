"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Jua } from "next/font/google";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import HouseAdBanner from "@/components/HouseAdBanner";
import AdSenseSlot from "@/components/ads/AdSenseSlot";
import HomeBoardSection from "@/components/home/HomeBoardSection";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import CorkWallPreview from "@/components/home/CorkWallPreview";
import PhotoWallLogo from "@/components/brand/PhotoWallLogo";
import HomeDesktop from "@/components/home/HomeDesktop";
import HomeBoardSheet from "@/components/home/HomeBoardSheet";
import HomeNotifications, { type HomeNotice } from "@/components/home/HomeNotifications";
import StickerStorePendingToast from "@/components/stickers/StickerStorePendingToast";
import { useStickerStoreGate } from "@/hooks/useStickerStoreGate";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import { countUnseenBoardItems } from "@/lib/board-seen";
import { getAdSenseSlotHome } from "@/lib/ads/adsense";
import { resolveAdPlan } from "@/lib/ads/resolve-ad-plan";
import type { BoardItem } from "@/types/board";
import type { Friend, Profile } from "@/types/profile";
import type { SharedWall, WallMemberInvite } from "@/types/shared-wall";
import type { PublicAnnouncement } from "@/types/announcement";
import type { PublishedWall } from "@/types/wall";
import type { WallActivityNotice } from "@/types/wall-activity-notice";
import type { InboxNotice } from "@/lib/supabase/user-inbox";

const displayFont = Jua({
  subsets: ["latin"],
  weight: "400",
});

const TAPE_COLORS = ["#F5C5C5", "#B5C9B1", "#D4BDE0", "#FAE4B0"];

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [wallId, setWallId] = useState<string | null>(null);
  const [wallThemeId, setWallThemeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sharedWalls, setSharedWalls] = useState<SharedWall[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<string[]>([]);
  const [invites, setInvites] = useState<WallMemberInvite[]>([]);
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [boardUnseen, setBoardUnseen] = useState(0);
  const [wallActivities, setWallActivities] = useState<WallActivityNotice[]>([]);
  const [inboxNotices, setInboxNotices] = useState<InboxNotice[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("auth_error")) return;
    window.history.replaceState({}, "", "/");
    setAuthError("Google 로그인에 실패했어요. Supabase·Google Cloud URL 설정을 확인해 주세요.");
  }, []);

  const loadHomeData = useCallback(async () => {
    if (!user) {
      setWallId(null);
      setWallThemeId(null);
      setProfile(null);
      setSharedWalls([]);
      setFriends([]);
      setRecentPhotos([]);
      setInvites([]);
      setWallActivities([]);
      setInboxNotices([]);
      return;
    }

    try {
      const res = await authFetch("/api/home");
      if (!res.ok) return;

      const data = (await res.json()) as {
        profile?: Profile | null;
        mine?: PublishedWall | null;
        sharedWalls?: SharedWall[];
        friends?: Friend[];
        invites?: WallMemberInvite[];
        wallActivities?: WallActivityNotice[];
        inboxNotices?: InboxNotice[];
        recentPhotoUrls?: string[];
      };

      if (data.profile) setProfile(data.profile);
      setSharedWalls(Array.isArray(data.sharedWalls) ? data.sharedWalls : []);
      setFriends(Array.isArray(data.friends) ? data.friends : []);
      setInvites(Array.isArray(data.invites) ? data.invites : []);
      setWallActivities(Array.isArray(data.wallActivities) ? data.wallActivities : []);
      setInboxNotices(Array.isArray(data.inboxNotices) ? data.inboxNotices : []);

      const mine = data.mine ?? null;
      if (!mine?.id) {
        setWallId(null);
        setWallThemeId(null);
        setRecentPhotos([]);
        return;
      }

      setWallId(mine.id);
      setWallThemeId(mine.themeId ?? null);
      setRecentPhotos(Array.isArray(data.recentPhotoUrls) ? data.recentPhotoUrls : []);
    } catch {
      // Keep decorative fallbacks
    }
  }, [user]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  useEffect(() => {
    fetch("/api/announcements?target=home")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PublicAnnouncement[]) => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/board")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: BoardItem[] }) => {
        const next = Array.isArray(data.items) ? data.items : [];
        setBoardItems(next);
        setBoardUnseen(countUnseenBoardItems(next));
      })
      .catch(() => {
        setBoardItems([]);
        setBoardUnseen(0);
      });
  }, []);

  const notices: HomeNotice[] = useMemo(() => {
    const inviteNotices: HomeNotice[] = invites.map((invite) => ({
      kind: "invite",
      invite,
    }));
    const activityNotices: HomeNotice[] = wallActivities.map((activity) => ({
      kind: "wall_activity",
      activity,
    }));
    const inbox: HomeNotice[] = inboxNotices.map((notice) => ({
      kind: "inbox",
      notice,
    }));
    const annNotices: HomeNotice[] = announcements.map((item) => ({
      kind: "announcement",
      item,
    }));
    return [...inbox, ...inviteNotices, ...activityNotices, ...annNotices];
  }, [invites, wallActivities, announcements, inboxNotices]);

  const dismissActivityLocal = useCallback((id: string) => {
    setWallActivities((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissInboxLocal = useCallback((id: string) => {
    setInboxNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const visitableFriends = friends.filter((f) => f.wallVisitable && f.wallId);
  const hasUnread = notices.length > 0;
  const adPlan = resolveAdPlan({
    user: !!user,
    authLoading,
    profile,
  });
  const displayName =
    profile?.displayName ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "친구";
  const avatarUrl =
    profile?.avatarUrl ?? (user?.user_metadata?.avatar_url as string | undefined) ?? null;

  const sharedSection = (
    <SharedWallsSection
      user={!!user}
      authLoading={authLoading}
      walls={sharedWalls}
    />
  );

  const friendsSection = (
    <FriendsSection user={!!user} friends={visitableFriends} />
  );

  const recentSection =
    user && (recentPhotos.length > 0 || wallId) ? (
      <RecentPhotosSection photos={recentPhotos} columns="mobile" />
    ) : null;

  return (
    <AppShell tone="home" hideHeader>
      <div className="-mx-5 min-h-full bg-background text-foreground lg:mx-0">
        {/* ── Mobile (< lg) ── */}
        <div className="lg:hidden">
          <header
            className="sticky top-0 z-40 flex items-center justify-between bg-background/92 px-[22px] pb-2.5 backdrop-blur-md"
            style={{ paddingTop: "max(0.35rem, env(safe-area-inset-top))" }}
          >
            <PhotoWallLogo variant="lockup" height={36} />
            <div className="flex items-center gap-1.5">
              <BoardButton
                hasUnseen={boardUnseen > 0}
                onClick={() => setBoardOpen(true)}
              />
              <NotifButton hasUnread={hasUnread} onClick={() => setNotifOpen(true)} />
            </div>
          </header>

          <div className="space-y-7 px-[18px] pb-28 pt-1">
            <AnnouncementBanner target="home" compact />
            <HomeBoardSection items={boardItems} />
            <AdSenseSlot slot={getAdSenseSlotHome()} plan={adPlan} />
            <HouseAdBanner placement="home" plan={adPlan} />
            {authError && <AuthErrorBanner message={authError} />}

            <section className="home-hero-enter">
              <SectionHeader title="나만의 벽" href="/wall/edit" action="편집하기" />
              <Link href="/wall/edit" className="block active:scale-[0.99]">
                <CorkWallPreview photos={recentPhotos} themeId={wallThemeId} size="mobile" />
              </Link>
            </section>

            <section className="home-hero-enter home-hero-enter-delay">{sharedSection}</section>
            <section className="home-hero-enter home-hero-enter-delay-2">
              <StickerStoreTeaser />
            </section>
            <section className="home-hero-enter home-hero-enter-delay-2">{friendsSection}</section>
            {recentSection && <section>{recentSection}</section>}
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center">
            <Link
              href="/wall/edit"
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-[14.5px] font-bold text-background shadow-md active:scale-[0.98]"
            >
              <SparkleIcon />
              벽 꾸미기
            </Link>
          </div>
        </div>

        {/* ── Desktop (lg+) — mock 3-column ── */}
        <div className="hidden lg:block">
          <HomeDesktop
            displayName={displayName}
            avatarUrl={avatarUrl}
            friendCode={profile?.friendCode ?? null}
            user={!!user}
            authLoading={authLoading}
            plan={adPlan}
            boardItems={boardItems}
            recentPhotos={recentPhotos}
            wallThemeId={wallThemeId}
            wallId={wallId}
            sharedWalls={sharedWalls}
            friends={friends}
            notices={notices}
            hasUnread={hasUnread}
            boardUnseen={boardUnseen > 0}
            onOpenNotif={() => setNotifOpen(true)}
            onOpenBoard={() => setBoardOpen(true)}
            onDismissActivity={dismissActivityLocal}
            onDismissInbox={dismissInboxLocal}
          />
        </div>

        <HomeNotifications
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          notices={notices}
          onDismissActivity={dismissActivityLocal}
          onDismissInbox={dismissInboxLocal}
        />
        <HomeBoardSheet
          open={boardOpen}
          onClose={() => {
            setBoardOpen(false);
            setBoardUnseen(0);
          }}
          items={boardItems}
        />
        <StickerStorePendingToast />
      </div>
    </AppShell>
  );
}

function SectionHeader({
  title,
  href,
  action,
}: {
  title: string;
  href: string;
  action: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className={`${displayFont.className} text-lg text-foreground`}>{title}</h2>
      <Link href={href} className="text-[13px] font-semibold text-foreground">
        {action}
      </Link>
    </div>
  );
}

function StickerStoreTeaser() {
  const { handleStoreClick, Toast } = useStickerStoreGate();

  return (
    <>
      {Toast}
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`${displayFont.className} text-lg text-foreground`}>스티커 스토어</h2>
        <Link
          href="/stickers"
          onClick={handleStoreClick}
          className="text-[13px] font-semibold text-foreground"
        >
          둘러보기
        </Link>
      </div>
      <Link
        href="/stickers"
        onClick={handleStoreClick}
        className="flex items-center justify-between gap-3 rounded-[18px] border border-foreground/10 bg-surface px-4 py-3.5 active:scale-[0.99]"
      >
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground">무료 스티커 팩</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
            공식·커뮤니티 팩을 설치해 벽에 붙여 보세요
          </p>
        </div>
        <PhotoWallLogo variant="mark" height={32} href="" />
      </Link>
    </>
  );
}

function SharedWallsSection({
  user,
  authLoading,
  walls,
}: {
  user: boolean;
  authLoading: boolean;
  walls: SharedWall[];
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`${displayFont.className} text-[17px] lg:text-xl`}>공동 벽</h2>
        <Link href="/walls" className="text-[12.5px] font-semibold text-foreground">
          전체보기
        </Link>
      </div>

      {!user && !authLoading ? (
        <div className="rounded-[18px] border border-foreground/10 bg-surface px-4 py-4">
          <p className="text-sm text-muted">로그인하면 친구와 공동 벽을 만들 수 있어요</p>
          <div className="mt-3">
            <AuthButton />
          </div>
        </div>
      ) : walls.length === 0 ? (
        <Link
          href="/walls"
          className="flex items-center justify-between rounded-[18px] border border-foreground/10 bg-surface px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
        >
          <div>
            <p className="text-sm font-semibold">공동 벽 만들기</p>
            <p className="mt-0.5 text-xs text-muted">친구와 함께 꾸미는 방</p>
          </div>
          <Chevron />
        </Link>
      ) : (
        <ul className="space-y-2.5">
          {walls.slice(0, 4).map((wall) => (
            <li key={wall.id}>
              <Link
                href={`/shared/${wall.id}`}
                className="flex items-center justify-between rounded-[18px] border border-foreground/10 bg-surface px-4 py-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{wall.title || "공동 벽"}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {wall.myRole === "owner" ? "방장" : "멤버"} · {wall.memberCount}명
                  </p>
                </div>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FriendsSection({ user, friends }: { user: boolean; friends: Friend[] }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`${displayFont.className} text-[17px] lg:text-xl`}>친구들의 방 구경하기</h2>
        <Link href="/profile" className="text-[12.5px] font-semibold text-foreground">
          더보기
        </Link>
      </div>

      {!user ? (
        <p className="rounded-[18px] bg-surface px-4 py-4 text-sm text-muted">
          로그인 후 친구 벽을 구경할 수 있어요
        </p>
      ) : friends.length === 0 ? (
        <Link
          href="/profile"
          className="block rounded-[18px] border border-foreground/10 bg-surface px-4 py-4 text-sm text-muted"
        >
          친구를 추가하고 서로의 벽을 열어보세요
        </Link>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] lg:grid lg:grid-cols-2 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {friends.map((friend, i) => (
            <FriendWallCard
              key={friend.id}
              friend={friend}
              tape={TAPE_COLORS[i % TAPE_COLORS.length]}
            />
          ))}
        </div>
      )}
    </>
  );
}

function RecentPhotosSection({
  photos,
  columns,
}: {
  photos: string[];
  columns: "mobile" | "desktop";
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`${displayFont.className} text-[17px] lg:text-xl`}>최근에 올린 사진</h2>
        <Link href="/wall/edit" className="text-[12.5px] font-semibold text-foreground">
          전체보기
        </Link>
      </div>
      {photos.length === 0 ? (
        <p className="rounded-[18px] bg-surface px-4 py-4 text-sm text-muted">
          벽에 사진을 붙이면 여기에 보여요
        </p>
      ) : (
        <div
          className={
            columns === "desktop"
              ? "grid grid-cols-4 gap-3"
              : "grid grid-cols-3 gap-2"
          }
        >
          {photos.map((src, i) => (
            <Link
              key={`${src}-${i}`}
              href="/wall/edit"
              className={`aspect-[3/4] overflow-hidden bg-foreground/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.07)] ${
                columns === "desktop" ? "rounded-2xl" : "rounded-[14px]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function FriendWallCard({
  friend,
  tape,
}: {
  friend: Friend;
  tape: string;
}) {
  const initial = friend.displayName.trim().charAt(0) || "?";
  return (
    <Link
      href={`/wall/${friend.wallId}`}
      className="w-[140px] shrink-0 overflow-hidden rounded-[18px] border border-foreground/10 bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.08)] lg:w-full"
    >
      <div className="relative h-[168px] lg:h-[140px]" style={{ background: tape }}>
        {friend.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={friend.avatarUrl}
            alt=""
            className="h-full w-full object-cover opacity-90"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-foreground/[0.06] text-3xl font-semibold text-muted">
            {initial}
          </div>
        )}
        <div
          className="absolute left-1/2 top-2 h-[11px] w-[34px] -translate-x-1/2 -rotate-3 rounded-sm opacity-85"
          style={{
            backgroundColor: tape,
            backgroundImage:
              "repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,0.25) 3px,rgba(255,255,255,0.25) 4px)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2.5">
        {friend.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={friend.avatarUrl}
            alt=""
            className="h-[30px] w-[30px] shrink-0 rounded-full object-cover shadow ring-2 ring-background"
          />
        ) : (
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-foreground/20 text-xs font-bold text-foreground ring-2 ring-background">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-bold">{friend.displayName}</p>
          <p className="truncate text-[9.5px] text-muted">@{friend.friendCode}</p>
        </div>
      </div>
    </Link>
  );
}

function BoardButton({ hasUnseen, onClick }: { hasUnseen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.06]"
      aria-label="공지·이벤트"
    >
      <MegaphoneIcon />
      {hasUnseen && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-[1.5px] border-background bg-foreground" />
      )}
    </button>
  );
}

function NotifButton({ hasUnread, onClick }: { hasUnread: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.06]"
      aria-label="알림"
    >
      <BellIcon />
      {hasUnread && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-[1.5px] border-background bg-foreground" />
      )}
    </button>
  );
}

function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
      {message}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 0112 0c0 7 3 7 3 7H3s3 0 3-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 11v2a1 1 0 001 1h2l6 4V6L6 10H4a1 1 0 00-1 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 8.5a4.5 4.5 0 010 7M18 6.5a8 8 0 010 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.2 5.2L18 9.5l-4.8 1.3L12 16l-1.2-5.2L6 9.5l4.8-1.3L12 3z"
        fill="currentColor"
      />
      <path d="M18 14l.6 2.4L21 17l-2.4.6L18 20l-.6-2.4L15 17l2.4-.6L18 14z" fill="currentColor" />
    </svg>
  );
}
