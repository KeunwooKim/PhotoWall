"use client";

import Link from "next/link";
import { Jua } from "next/font/google";
import CorkWallPreview from "@/components/home/CorkWallPreview";
import AuthButton from "@/components/auth/AuthButton";
import AppDesktopSidebar from "@/components/layout/AppDesktopSidebar";
import HouseAdBanner from "@/components/HouseAdBanner";
import { useStickerStoreGate } from "@/hooks/useStickerStoreGate";
import type { HomeNotice } from "@/components/home/HomeNotifications";
import type { Friend } from "@/types/profile";
import type { SharedWall } from "@/types/shared-wall";
import type { UserPlan } from "@/lib/wall-quotas";
import { authFetch } from "@/lib/auth/api-fetch";

const displayFont = Jua({
  subsets: ["latin"],
  weight: "400",
});

const TAPE_COLORS = ["#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373"];

export interface HomeDesktopProps {
  displayName: string;
  avatarUrl: string | null;
  friendCode: string | null;
  user: boolean;
  authLoading: boolean;
  plan?: UserPlan | null;
  recentPhotos: string[];
  wallThemeId?: string | null;
  wallId: string | null;
  sharedWalls: SharedWall[];
  friends: Friend[];
  notices: HomeNotice[];
  hasUnread: boolean;
  boardUnseen: boolean;
  onOpenNotif: () => void;
  onOpenBoard: () => void;
  onDismissActivity?: (id: string) => void;
  onDismissInbox?: (id: string) => void;
}

/** Desktop home — 3-column layout matching Mobile Home Screen Design mock. */
export default function HomeDesktop({
  displayName,
  avatarUrl,
  friendCode: _friendCode,
  user,
  authLoading,
  plan = null,
  recentPhotos,
  wallThemeId = null,
  wallId,
  sharedWalls,
  friends,
  notices,
  hasUnread,
  boardUnseen,
  onOpenNotif,
  onOpenBoard,
  onDismissActivity,
  onDismissInbox,
}: HomeDesktopProps) {
  const visitableFriends = friends.filter((f) => f.wallVisitable && f.wallId);
  const { handleStoreClick, Toast } = useStickerStoreGate();

  return (
    <div className="grid h-[100dvh] grid-cols-[240px_1fr_300px] overflow-hidden bg-background text-foreground">
      <AppDesktopSidebar wallsBadge={sharedWalls.length} />

      {/* ── MAIN ── */}
      <main className="flex h-[100dvh] flex-col gap-6 overflow-y-auto px-7 pb-14 pt-7 [scrollbar-width:none]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`${displayFont.className} text-[26px] tracking-tight`}>
              {user ? `안녕하세요, ${displayName}` : "안녕하세요"}
            </h1>
            <p className="mt-1 text-[13px] text-muted">오늘도 좋은 추억을 기록해봐요</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenBoard}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.06]"
              aria-label="공지·이벤트"
            >
              <MegaphoneIcon />
              {boardUnseen && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-[1.5px] border-background bg-foreground" />
              )}
            </button>
            <button
              type="button"
              onClick={onOpenNotif}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.06]"
              aria-label="알림"
            >
              <BellIcon />
              {hasUnread && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-[1.5px] border-background bg-foreground" />
              )}
            </button>
            <Link
              href={user ? "/profile" : "/"}
              className="flex h-10 w-10 overflow-hidden rounded-full border-2 border-foreground bg-foreground/[0.06]"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-foreground">
                  {displayName.charAt(0)}
                </span>
              )}
            </Link>
          </div>
        </div>

        {!user && !authLoading && (
          <div className="flex items-center justify-between rounded-[18px] border border-foreground/10 bg-surface px-5 py-4">
            <p className="text-sm text-muted">로그인하면 공동 벽·친구 방을 쓸 수 있어요</p>
            <AuthButton />
          </div>
        )}

        <HouseAdBanner placement="home" plan={plan} />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`${displayFont.className} text-xl`}>나만의 방</h2>
            <Link
              href="/wall/edit"
              className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background"
            >
              <SparkleIcon />
              편집하기
            </Link>
          </div>
          <Link href="/wall/edit" className="block overflow-hidden rounded-3xl">
            <CorkWallPreview photos={recentPhotos} themeId={wallThemeId} size="desktop" />
          </Link>
        </section>

        {user && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`${displayFont.className} text-xl`}>공동 벽</h2>
              <Link href="/walls" className="text-[13px] font-semibold text-foreground">
                전체보기 →
              </Link>
            </div>
            {sharedWalls.length === 0 ? (
              <Link
                href="/walls"
                className="block rounded-[18px] border border-foreground/10 bg-surface px-4 py-4 text-sm text-muted"
              >
                아직 공동 벽이 없어요. 만들어 보세요
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sharedWalls.slice(0, 4).map((wall) => (
                  <Link
                    key={wall.id}
                    href={`/shared/${wall.id}`}
                    className="rounded-[18px] border border-foreground/10 bg-surface px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5"
                  >
                    <p className="truncate text-sm font-semibold">{wall.title || "공동 벽"}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {wall.myRole === "owner" ? "방장" : "멤버"} · {wall.memberCount}명
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`${displayFont.className} text-xl`}>스티커 스토어</h2>
            <Link
              href="/stickers"
              onClick={handleStoreClick}
              className="text-[13px] font-semibold text-foreground"
            >
              전체보기 →
            </Link>
          </div>
          <Link
            href="/stickers"
            onClick={handleStoreClick}
            className="flex items-center justify-between gap-4 rounded-[18px] border border-foreground/10 bg-surface px-5 py-4 transition hover:-translate-y-0.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">무료 스티커 팩</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                공식·커뮤니티 팩을 설치하고, 내 팩도 올려 볼 수 있어요
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-background">
              둘러보기
            </span>
          </Link>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`${displayFont.className} text-xl`}>최근에 올린 사진</h2>
            <Link
              href="/wall/edit"
              className="flex items-center gap-1 text-[13px] font-semibold text-foreground"
            >
              전체보기 →
            </Link>
          </div>
          {!user || (!wallId && recentPhotos.length === 0) ? (
            <p className="rounded-[18px] bg-surface px-4 py-4 text-sm text-muted">
              벽에 사진을 붙이면 여기에 보여요
            </p>
          ) : recentPhotos.length === 0 ? (
            <p className="rounded-[18px] bg-surface px-4 py-4 text-sm text-muted">
              아직 올린 사진이 없어요
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {recentPhotos.map((src, i) => (
                <Link
                  key={`${src}-${i}`}
                  href="/wall/edit"
                  className="aspect-[3/4] overflow-hidden rounded-2xl bg-foreground/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition hover:scale-[1.03] hover:shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── RIGHT PANEL ── */}
      <aside className="flex h-[100dvh] flex-col gap-7 overflow-y-auto border-l border-foreground/10 bg-surface px-[18px] py-7 [scrollbar-width:none]">
        <div>
          <h3 className={`${displayFont.className} mb-3.5 text-base`}>알림</h3>
          {notices.length === 0 ? (
            <p className="rounded-[14px] bg-foreground/[0.04] px-3.5 py-3 text-[12px] text-muted">
              새 알림이 없어요
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {notices.slice(0, 5).map((notice) => {
                if (notice.kind === "invite") {
                  const inv = notice.invite;
                  return (
                    <Link
                      key={`inv-${inv.id}`}
                      href="/walls"
                      className="flex gap-2.5 rounded-[14px] border border-foreground/10 bg-foreground/[0.04] px-3 py-3"
                    >
                      {inv.inviterAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={inv.inviterAvatarUrl}
                          alt=""
                          className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-foreground/20 text-xs font-bold text-foreground">
                          {inv.inviterName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11.5px] leading-snug text-foreground">
                          <span className="font-semibold">{inv.inviterName}</span>님이{" "}
                          {inv.wallTitle}에 초대했어요
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted">공동 벽에서 확인</p>
                      </div>
                    </Link>
                  );
                }
                if (notice.kind === "wall_activity") {
                  const act = notice.activity;
                  return (
                    <Link
                      key={`act-${act.id}`}
                      href={`/shared/${act.wallId}`}
                      onClick={() => {
                        onDismissActivity?.(act.id);
                        void authFetch("/api/notifications/wall-activity", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ids: [act.id] }),
                        }).catch(() => {});
                      }}
                      className="flex gap-2.5 rounded-[14px] border border-foreground/10 bg-foreground/[0.04] px-3 py-3"
                    >
                      {act.actorAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={act.actorAvatarUrl}
                          alt=""
                          className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-foreground/20 text-xs font-bold text-foreground">
                          {act.actorName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11.5px] leading-snug text-foreground">
                          <span className="font-semibold">{act.actorName}</span>님이{" "}
                          {act.wallTitle}을(를) 업데이트했어요
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted">공동 벽 열기</p>
                      </div>
                    </Link>
                  );
                }
                if (notice.kind === "inbox") {
                  const item = notice.notice;
                  return (
                    <button
                      key={`inbox-${item.id}`}
                      type="button"
                      onClick={() => {
                        onDismissInbox?.(item.id);
                        void authFetch("/api/notifications/inbox", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ids: [item.id] }),
                        }).catch(() => {});
                      }}
                      className="rounded-[14px] border border-rose-200/50 bg-rose-50/40 px-3 py-3 text-left dark:border-rose-900/40 dark:bg-rose-950/20"
                    >
                      <p className="text-[11.5px] font-semibold">{item.title}</p>
                      <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-foreground/90">
                        {item.body}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">운영팀 답변</p>
                    </button>
                  );
                }
                const item = notice.item;
                return (
                  <div
                    key={`ann-${item.id}`}
                    className="rounded-[14px] border border-foreground/10 bg-foreground/[0.04] px-3 py-3"
                  >
                    <p className="text-[11.5px] font-semibold">{item.title}</p>
                    <p className="mt-1 text-[11px] leading-snug text-foreground/90">{item.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className={`${displayFont.className} text-base`}>친구들의 방</h3>
            <Link href="/profile" className="text-xs font-semibold text-foreground">
              더보기
            </Link>
          </div>
          {!user ? (
            <p className="text-[12px] text-muted">로그인 후 친구 벽을 볼 수 있어요</p>
          ) : visitableFriends.length === 0 ? (
            <Link href="/profile" className="block text-[12px] text-muted">
              친구를 추가해 보세요
            </Link>
          ) : (
            <div className="flex flex-col gap-3">
              {visitableFriends.slice(0, 4).map((friend, i) => (
                <DesktopFriendCard
                  key={friend.id}
                  friend={friend}
                  tape={TAPE_COLORS[i % TAPE_COLORS.length]}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className={`${displayFont.className} text-base`}>공동 벽 초대</h3>
            <Link href="/walls" className="text-xs font-semibold text-foreground">
              관리
            </Link>
          </div>
          {notices.filter((n) => n.kind === "invite").length === 0 ? (
            <p className="rounded-[14px] border border-[#F0C0BC]/30 bg-[#F0C0BC]/10 px-3 py-3 text-[12px] text-foreground/90">
              대기 중인 초대가 없어요
            </p>
          ) : (
            notices
              .filter((n): n is Extract<HomeNotice, { kind: "invite" }> => n.kind === "invite")
              .slice(0, 3)
              .map(({ invite }) => (
                <div
                  key={invite.id}
                  className="mb-2.5 rounded-[14px] border border-[#F0C0BC]/30 bg-[#F0C0BC]/10 px-3 py-3"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[12.5px] font-bold">{invite.inviterName}</span>
                    <span className="ml-auto text-[10px] text-muted">초대</span>
                  </div>
                  <p className="text-[12px] leading-snug text-foreground/90">
                    {invite.wallTitle} 공동 벽에 초대받았어요
                  </p>
                  <Link
                    href="/walls"
                    className="mt-2 inline-block text-[11px] font-medium text-foreground"
                  >
                    수락하러 가기
                  </Link>
                </div>
              ))
          )}
        </div>
      </aside>
      {Toast}
    </div>
  );
}

function DesktopFriendCard({ friend, tape }: { friend: Friend; tape: string }) {
  const initial = friend.displayName.trim().charAt(0) || "?";
  return (
    <Link
      href={`/wall/${friend.wallId}`}
      className="overflow-hidden rounded-[18px] border border-foreground/10 bg-background shadow-[0_3px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5"
    >
      <div className="relative h-[110px]" style={{ background: tape }}>
        {friend.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-semibold text-muted">
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
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {friend.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={friend.avatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover shadow ring-2 ring-background"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/20 text-xs font-bold text-foreground ring-2 ring-background">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold">{friend.displayName}</p>
          <p className="truncate text-[10.5px] text-muted">@{friend.friendCode}</p>
        </div>
      </div>
    </Link>
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
