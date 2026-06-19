"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import FriendsPanel from "@/components/social/FriendsPanel";
import SharedWallsPanel from "@/components/social/SharedWallsPanel";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import type { Profile } from "@/types/profile";

export default function ProfilePage() {
  const { user, isLoading, isConfigured } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isSharedOpen, setIsSharedOpen] = useState(false);

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

  if (!isConfigured) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Supabase 설정 후 이용할 수 있어요.</p>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted">불러오는 중...</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <p className="text-4xl">👤</p>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">내 정보</h1>
            <p className="text-sm text-muted">로그인하면 프로필과 친구 기능을 쓸 수 있어요</p>
          </div>
          <AuthButton />
        </div>
      </AppShell>
    );
  }

  const displayName =
    profile?.displayName ??
    (user.user_metadata?.full_name as string) ??
    user.email?.split("@")[0] ??
    "친구";
  const avatarUrl = profile?.avatarUrl ?? (user.user_metadata?.avatar_url as string) ?? null;

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col items-center gap-4 pt-2 text-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full object-cover ring-2 ring-accent/30"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent-dark">
              {displayName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>
        </section>

        {profile?.friendCode && (
          <section className="rounded-2xl border border-foreground/8 bg-surface p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">내 친구 코드</h2>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-background px-3 py-2.5 text-center text-sm font-mono tracking-widest">
                {profile.friendCode}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-medium text-background"
              >
                복사
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">친구에게 코드를 공유하면 서로 연결돼요</p>
          </section>
        )}

        <section className="grid gap-2">
          <MenuLink href="/wall/edit" emoji="🖼️" title="내 벽 꾸미기" desc="개인 포토월 편집" />
          <MenuButton
            emoji="👯"
            title="공동 벽"
            desc="친구와 함께 모으는 인생네컷"
            onClick={() => setIsSharedOpen(true)}
          />
          <MenuButton
            emoji="💌"
            title="친구 목록"
            desc="친구 추가 · 벽 방문"
            onClick={() => setIsFriendsOpen(true)}
          />
          <MenuLink href="/settings" emoji="⚙️" title="설정" desc="테마 · 환경 설정" />
        </section>

        <div className="flex justify-center pt-2">
          <AuthButton />
        </div>
      </div>

      <FriendsPanel isOpen={isFriendsOpen} onClose={() => setIsFriendsOpen(false)} />
      <SharedWallsPanel isOpen={isSharedOpen} onClose={() => setIsSharedOpen(false)} />

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
  emoji,
  title,
  desc,
}: {
  href: string;
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-foreground/8 bg-surface p-4 transition hover:border-foreground/15 active:scale-[0.99]"
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
    </Link>
  );
}

function MenuButton({
  emoji,
  title,
  desc,
  onClick,
}: {
  emoji: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-foreground/8 bg-surface p-4 text-left transition hover:border-foreground/15 active:scale-[0.99]"
    >
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
    </button>
  );
}
