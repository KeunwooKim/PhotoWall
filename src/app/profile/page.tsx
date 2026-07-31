"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import FriendsContent from "@/components/social/FriendsContent";
import FriendsPanel from "@/components/social/FriendsPanel";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import type { Friend, Profile } from "@/types/profile";
import type { SharedWall } from "@/types/shared-wall";
import { PLAN_UI_NAME } from "@/lib/wall-quotas";

export default function ProfilePage() {
  const { user, isLoading, isConfigured, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [sharedWallCount, setSharedWallCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  const [nameDraft, setNameDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  const [wallTitleDraft, setWallTitleDraft] = useState("");
  const [isEditingWallTitle, setIsEditingWallTitle] = useState(false);
  const [isSavingWallTitle, setIsSavingWallTitle] = useState(false);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  const loadProfileExtras = useCallback(async () => {
    const [friendsRes, wallsRes] = await Promise.all([
      authFetch("/api/friends"),
      authFetch("/api/shared-walls"),
    ]);
    if (friendsRes.ok) {
      const friends = (await friendsRes.json()) as Friend[];
      setFriendCount(friends.length);
    }
    if (wallsRes.ok) {
      const walls = (await wallsRes.json()) as SharedWall[];
      setSharedWallCount(walls.length);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setFriendCount(0);
      setSharedWallCount(0);
      return;
    }

    authFetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Profile | null) => {
        setProfile(data);
        if (data) {
          setNameDraft(data.displayName);
          setWallTitleDraft(data.wallTitle?.trim() || "내 벽");
        }
      })
      .catch(() => {});

    void loadProfileExtras();
  }, [user, loadProfileExtras]);

  const handleCopyCode = async () => {
    if (!profile?.friendCode) return;
    try {
      await navigator.clipboard.writeText(profile.friendCode);
      showMessage("친구 코드가 복사됐어요");
    } catch {
      showMessage("복사에 실패했어요");
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleToggleWallVisits = async () => {
    if (!profile || isSavingPrivacy) return;
    const next = !profile.allowWallVisits;
    setIsSavingPrivacy(true);
    try {
      const res = await authFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowWallVisits: next }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Profile;
      setProfile(updated);
      showMessage(next ? "친구가 내 벽을 방문할 수 있어요" : "벽 방문을 비공개로 설정했어요");
    } catch {
      showMessage("설정 저장에 실패했어요");
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || isSavingName) return;
    setIsSavingName(true);
    try {
      const res = await authFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Profile;
      setProfile(updated);
      setNameDraft(updated.displayName);
      setIsEditingName(false);
      showMessage("이름을 저장했어요");
    } catch {
      showMessage("이름 저장에 실패했어요");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveWallTitle = async () => {
    const trimmed = wallTitleDraft.trim();
    if (!trimmed || isSavingWallTitle || !profile?.wallId) return;
    setIsSavingWallTitle(true);
    try {
      const res = await authFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallTitle: trimmed }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Profile;
      setProfile(updated);
      setWallTitleDraft(updated.wallTitle?.trim() || "내 벽");
      setIsEditingWallTitle(false);
      showMessage("벽 이름을 저장했어요");
    } catch {
      showMessage("벽 이름 저장에 실패했어요");
    } finally {
      setIsSavingWallTitle(false);
    }
  };

  if (!isConfigured) {
    return (
      <AppShell tone="hub">
        <p className="py-12 text-center text-sm text-muted">Supabase 설정 후 이용할 수 있어요.</p>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell tone="hub">
        <p className="py-12 text-center text-sm text-muted">불러오는 중...</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell tone="hub">
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <h1 className="text-2xl font-bold tracking-tight">내 정보</h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted">
            로그인하면 프로필과 친구를 관리할 수 있어요.
          </p>
          <AuthButton />
        </div>
      </AppShell>
    );
  }

  const displayName =
    profile?.displayName ??
    (user.user_metadata?.full_name as string) ??
    user.email?.split("@")[0] ??
    "나";
  const avatarUrl = profile?.avatarUrl ?? (user.user_metadata?.avatar_url as string) ?? null;
  const initial = displayName.trim().charAt(0).toUpperCase() || "나";
  const isPlus = profile?.plan === "premium";
  const wallLabel = profile?.wallTitle?.trim() || "내 벽";

  return (
    <AppShell tone="hub">
      <div className="space-y-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10 lg:space-y-0 lg:items-start">
        {/* Left: identity */}
        <section className="relative -mx-5 -mt-6 overflow-hidden bg-surface px-5 pb-8 pt-8 lg:mx-0 lg:mt-0 lg:rounded-3xl lg:border lg:border-foreground/10 lg:px-6 lg:pb-8 lg:pt-8 lg:shadow-sm">
          <div className="relative flex flex-col items-center gap-4 text-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-24 w-24 rounded-full object-cover shadow-md ring-2 ring-background"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground text-2xl font-semibold text-background shadow-md">
                {initial}
              </div>
            )}
            <div className="w-full space-y-2">
              {isEditingName ? (
                <div className="flex flex-col items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={40}
                    className="w-full max-w-[220px] rounded-xl border border-foreground/15 bg-background px-3 py-2 text-center text-lg font-bold outline-none focus:border-foreground/40"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setNameDraft(displayName);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={!nameDraft.trim() || isSavingName}
                      onClick={() => void handleSaveName()}
                      className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                    >
                      {isSavingName ? "저장 중…" : "저장"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                  {isPlus ? (
                    <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-background">
                      {PLAN_UI_NAME.premium}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(displayName);
                      setIsEditingName(true);
                    }}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-foreground underline underline-offset-2"
                  >
                    수정
                  </button>
                </div>
              )}
              <p className="text-sm text-muted">{user.email}</p>
              {!isPlus && profile ? (
                <Link
                  href="/upgrade"
                  className="inline-block text-xs font-medium text-foreground underline underline-offset-2"
                >
                  {PLAN_UI_NAME.premium}로 업그레이드
                </Link>
              ) : null}
            </div>
          </div>

          {profile?.friendCode && (
            <div className="relative mt-6 space-y-2">
              <h2 className="text-xs font-medium tracking-wide text-muted">친구 코드</h2>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-xl bg-foreground/[0.06] px-4 py-3 text-center font-mono text-sm tracking-[0.2em]">
                  {profile.friendCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rounded-xl bg-foreground px-4 py-3 text-xs font-medium text-background transition active:scale-[0.98]"
                >
                  복사
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right: info + friends */}
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-foreground/10 bg-surface px-4 py-4">
              <p className="text-[11px] font-medium tracking-wide text-muted">요금제</p>
              <p className="mt-1 text-sm font-semibold">
                {PLAN_UI_NAME[isPlus ? "premium" : "free"]}
              </p>
              <Link
                href="/upgrade"
                className="mt-2 inline-block text-xs font-medium text-foreground underline underline-offset-2"
              >
                {isPlus ? "한도 보기" : "업그레이드"}
              </Link>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-surface px-4 py-4">
              <p className="text-[11px] font-medium tracking-wide text-muted">통계</p>
              <p className="mt-1 text-sm font-semibold">
                친구 {friendCount} · 공동 벽 {sharedWallCount}
              </p>
              <p className="mt-2 text-xs text-muted">참여 중인 공동 벽 기준</p>
            </div>
          </div>

          <section className="rounded-2xl border border-foreground/10 bg-surface px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">친구 벽 방문 허용</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  켜야 친구가 내 개인 벽을 볼 수 있어요.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profile?.allowWallVisits ?? false}
                disabled={!profile || isSavingPrivacy}
                onClick={() => void handleToggleWallVisits()}
                className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${
                  profile?.allowWallVisits ? "bg-foreground" : "bg-foreground/[0.06]"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-background shadow transition ring-1 ring-foreground/10 ${
                    profile?.allowWallVisits ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-foreground/10 bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">내 벽</p>
                <p className="mt-0.5 text-xs text-muted">이름과 방문 링크</p>
              </div>
              {profile?.wallId ? (
                <Link
                  href={`/wall/${profile.wallId}`}
                  className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                >
                  보기
                </Link>
              ) : (
                <span className="text-xs text-muted">아직 없어요</span>
              )}
            </div>

            {profile?.wallId && (
              isEditingWallTitle ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wallTitleDraft}
                    onChange={(e) => setWallTitleDraft(e.target.value)}
                    maxLength={40}
                    className="min-w-0 flex-1 rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingWallTitle(false);
                      setWallTitleDraft(wallLabel);
                    }}
                    className="rounded-lg px-2 text-xs text-muted"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={!wallTitleDraft.trim() || isSavingWallTitle}
                    onClick={() => void handleSaveWallTitle()}
                    className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50"
                  >
                    {isSavingWallTitle ? "…" : "저장"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-foreground/[0.05] px-3 py-2.5">
                  <p className="truncate text-sm font-medium">{wallLabel}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setWallTitleDraft(wallLabel);
                      setIsEditingWallTitle(true);
                    }}
                    className="shrink-0 text-xs font-medium text-foreground underline underline-offset-2"
                  >
                    이름 수정
                  </button>
                </div>
              )
            )}
          </section>

          {/* Mobile: open friends sheet */}
          <button
            type="button"
            onClick={() => setIsFriendsOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl border border-foreground/10 bg-surface px-4 py-4 text-left transition active:bg-foreground/[0.05] lg:hidden"
          >
            <div>
              <p className="text-sm font-semibold">친구</p>
              <p className="mt-0.5 text-xs text-muted">
                추가 · 벽 방문{friendCount > 0 ? ` · ${friendCount}명` : ""}
              </p>
            </div>
            <Chevron />
          </button>

          {/* Desktop: inline friends */}
          <section className="hidden rounded-2xl border border-foreground/10 bg-surface px-5 py-5 lg:block">
            <FriendsContent variant="inline" hideMyCode active />
          </section>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full py-2 text-sm text-muted transition hover:text-foreground disabled:opacity-50"
          >
            {isSigningOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>

      <FriendsPanel isOpen={isFriendsOpen} onClose={() => setIsFriendsOpen(false)} />

      {message && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg lg:bottom-8">
          {message}
        </div>
      )}
    </AppShell>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
