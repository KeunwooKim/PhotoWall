"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import FriendsPanel from "@/components/social/FriendsPanel";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import type { Profile } from "@/types/profile";
import { PLAN_UI_NAME } from "@/lib/wall-quotas";

export default function ProfilePage() {
  const { user, isLoading, isConfigured, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    authFetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Profile | null) => setProfile(data))
      .catch(() => {});
  }, [user]);

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

  if (!isConfigured) {
    return (
      <AppShell>
        <p className="py-12 text-center text-sm text-muted">Supabase 설정 후 이용할 수 있어요.</p>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <p className="py-12 text-center text-sm text-muted">불러오는 중...</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <h1 className="text-2xl font-bold tracking-tight">내 정보</h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted">
            로그인하면 프로필, 친구, 공동 벽을 관리할 수 있어요.
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

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="relative -mx-5 -mt-6 overflow-hidden px-5 pb-8 pt-8">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40"
            style={{ backgroundImage: "url('/wallpapers/linen-cream.png')" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 to-[var(--background)] dark:from-black/40 dark:to-[var(--background)]"
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-4 text-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-24 w-24 rounded-full object-cover shadow-md ring-2 ring-white/80"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground text-2xl font-semibold text-background shadow-md">
                {initial}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                {isPlus ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-900 ring-1 ring-amber-200/80">
                    {PLAN_UI_NAME.premium}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted">{user.email}</p>
              {!isPlus && profile ? (
                <Link
                  href="/upgrade"
                  className="inline-block text-xs font-medium text-muted underline underline-offset-2"
                >
                  {PLAN_UI_NAME.premium}로 업그레이드
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {profile?.friendCode && (
          <section className="space-y-2">
            <h2 className="text-xs font-medium tracking-wide text-muted">친구 코드</h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-foreground/[0.04] px-4 py-3 text-center font-mono text-sm tracking-[0.2em]">
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
            <p className="text-xs text-muted">코드를 공유하면 친구와 연결돼요</p>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl bg-foreground/[0.03]">
          <MenuLink href="/walls" title="벽 꾸미기" desc="내 벽 · 공동 벽" />
          <MenuButton
            title="친구"
            desc="추가 · 벽 방문"
            onClick={() => setIsFriendsOpen(true)}
            last
          />
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

      <FriendsPanel isOpen={isFriendsOpen} onClose={() => setIsFriendsOpen(false)} />

      {message && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg">
          {message}
        </div>
      )}
    </AppShell>
  );
}

function MenuLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 border-b border-foreground/6 px-4 py-4 transition active:bg-foreground/[0.04]"
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{desc}</p>
      </div>
      <Chevron />
    </Link>
  );
}

function MenuButton({
  title,
  desc,
  onClick,
  last = false,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition active:bg-foreground/[0.04] ${
        last ? "" : "border-b border-foreground/6"
      }`}
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{desc}</p>
      </div>
      <Chevron />
    </button>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
