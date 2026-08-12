"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import HouseAdBanner from "@/components/HouseAdBanner";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import type { Profile } from "@/types/profile";
import type { ThemeMode } from "@/lib/settings-storage";
import { COLOR_PALETTES } from "@/lib/color-palettes";
import { PLAN_UI_NAME } from "@/lib/wall-quotas";
import { resolveAdPlan } from "@/lib/ads/resolve-ad-plan";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

export default function SettingsPage() {
  const { mode, setMode, palette, setPalette } = useTheme();
  const { user, isLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    authFetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Profile | null) => setProfile(data))
      .catch(() => {});

    authFetch("/api/admin/me")
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => setIsAdmin(!!data.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user]);

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
      setMessage(next ? "친구가 내 벽을 방문할 수 있어요" : "벽 방문을 비공개로 설정했어요");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("설정 저장에 실패했어요");
      setTimeout(() => setMessage(null), 2000);
    } finally {
      setIsSavingPrivacy(false);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || isDeleting) return;
    setIsDeleting(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/account", {
        method: "DELETE",
        headers: { "X-Confirm-Delete": "DELETE" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "탈퇴에 실패했어요");
      }
      await signOut();
      window.location.href = "/";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "탈퇴에 실패했어요");
      setTimeout(() => setMessage(null), 4000);
      setIsDeleting(false);
    }
  };

  return (
    <AppShell tone="hub">
      <div className="mx-auto w-full max-w-lg space-y-8 lg:max-w-3xl">
        <header className="space-y-1 pt-1">
          <h1 className="text-2xl font-bold tracking-tight">설정</h1>
          <p className="text-sm text-muted">화면과 프라이버시를 맞춰 보세요</p>
        </header>

        <HouseAdBanner
          placement="settings"
          plan={resolveAdPlan({
            user: !!user,
            authLoading: isLoading,
            profile,
          })}
        />

        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">밝기</h2>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-foreground/[0.05] p-1">
            {THEME_OPTIONS.map((option) => {
              const active = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-xl px-2 py-2.5 text-xs font-medium transition active:scale-[0.98] ${
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">색 조합</h2>
          <p className="text-xs text-muted">모노(흑백) + 파스텔 · 라이트/다크에 맞춰 적용돼요</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COLOR_PALETTES.map((item) => {
              const active = palette === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPalette(item.id)}
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                    active
                      ? "border-foreground/25 bg-foreground/[0.06] shadow-sm"
                      : "border-foreground/10 bg-surface hover:border-foreground/20"
                  }`}
                >
                  <span className="flex shrink-0 gap-1" aria-hidden>
                    {item.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-7 w-7 rounded-full ring-1 ring-foreground/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="block text-[11px] text-muted">{item.description}</span>
                  </span>
                  {active ? (
                    <span className="ml-auto shrink-0 text-[10px] font-medium text-accent-dark">선택</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-8 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
          <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">요금제</h2>
          {!user && !isLoading ? (
            <div className="space-y-3 rounded-2xl bg-foreground/[0.03] px-4 py-4">
              <p className="text-sm text-muted">로그인하면 플랜을 확인할 수 있어요</p>
              <AuthButton />
            </div>
          ) : (
            <Link
              href="/upgrade"
              className="flex items-center justify-between rounded-2xl bg-foreground/[0.03] px-4 py-4 transition active:bg-foreground/[0.05]"
            >
              <div>
                <p className="text-sm font-semibold">
                  {PLAN_UI_NAME[profile?.plan === "premium" ? "premium" : "free"]}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {profile?.plan === "premium"
                    ? "플러스 한도가 적용 중이에요"
                    : "플러스로 업그레이드 · 한도 확장"}
                </p>
              </div>
              <Chevron />
            </Link>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">프라이버시</h2>
          {!user && !isLoading ? (
            <div className="space-y-3 rounded-2xl bg-foreground/[0.03] px-4 py-4">
              <p className="text-sm text-muted">로그인하면 벽 방문 설정을 바꿀 수 있어요</p>
              <AuthButton />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-foreground/[0.03] px-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">친구 벽 방문 허용</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  켜야 친구가 내 개인 벽을 볼 수 있어요. 기본은 비공개예요.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profile?.allowWallVisits ?? false}
                disabled={!profile || isSavingPrivacy}
                onClick={handleToggleWallVisits}
                className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${
                  profile?.allowWallVisits ? "bg-foreground" : "bg-foreground/15"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-background shadow transition ring-1 ring-foreground/10 ${
                    profile?.allowWallVisits ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          )}
        </section>
          </div>

          <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">고객센터</h2>
          <Link
            href="/support"
            className="flex items-center justify-between rounded-2xl bg-foreground/[0.03] px-4 py-4 transition active:bg-foreground/[0.05]"
          >
            <div>
              <p className="text-sm font-semibold">고객센터</p>
              <p className="mt-0.5 text-xs text-muted">자주 묻는 질문 · 문의하기</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="text-muted">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </section>

        {isAdmin && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium tracking-wide text-muted">관리</h2>
            <Link
              href="/admin"
              className="flex items-center justify-between rounded-2xl bg-foreground/[0.03] px-4 py-4 transition active:bg-foreground/[0.05]"
            >
              <div>
                <p className="text-sm font-semibold">관리자</p>
                <p className="mt-0.5 text-xs text-muted">문의 · 벽 · 유저 · 운영</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="text-muted">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </section>
        )}

        {user && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium tracking-wide text-muted">계정</h2>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full rounded-2xl bg-foreground/[0.03] px-4 py-4 text-left text-sm font-medium transition hover:bg-foreground/[0.05] disabled:opacity-50"
            >
              {isSigningOut ? "로그아웃 중..." : "로그아웃"}
            </button>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setDeleteConfirmText("");
                }}
                className="w-full rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-4 text-left text-sm font-medium text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
              >
                회원 탈퇴
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-4 py-4">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">탈퇴하시겠어요?</p>
                <p className="text-xs leading-relaxed text-muted">
                  개인·공동 벽, 사진, 친구 관계가 삭제되며 복구할 수 없어요. 계속하려면 아래에{" "}
                  <span className="font-semibold text-foreground">DELETE</span>를 입력하세요.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/30"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                    }}
                    disabled={isDeleting}
                    className="flex-1 rounded-xl bg-foreground/8 px-3 py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount()}
                    disabled={isDeleting || deleteConfirmText !== "DELETE"}
                    className="flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-background disabled:opacity-40"
                  >
                    {isDeleting ? "탈퇴 중..." : "영구 탈퇴"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">소개</h2>
          <div className="overflow-hidden rounded-2xl bg-foreground/[0.03]">
            <Link
              href="/news"
              className="flex items-center justify-between border-b border-foreground/6 px-4 py-4 transition active:bg-foreground/[0.04]"
            >
              <div>
                <p className="text-sm font-semibold">공지·이벤트</p>
                <p className="mt-0.5 text-xs text-muted">운영 공지와 이벤트 전체 보기</p>
              </div>
              <Chevron />
            </Link>
            <Link
              href="/about"
              className="flex items-center justify-between px-4 py-4 transition active:bg-foreground/[0.04]"
            >
              <div>
                <p className="text-sm font-semibold">PhotoWall 소개</p>
                <p className="mt-0.5 text-xs text-muted">기능과 사용 방법을 알아보세요</p>
              </div>
              <Chevron />
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">약관</h2>
          <div className="overflow-hidden rounded-2xl bg-foreground/[0.03]">
            <Link
              href="/legal/terms"
              className="flex items-center justify-between border-b border-foreground/6 px-4 py-4 transition active:bg-foreground/[0.04]"
            >
              <p className="text-sm font-semibold">이용약관</p>
              <Chevron />
            </Link>
            <Link
              href="/legal/privacy"
              className="flex items-center justify-between px-4 py-4 transition active:bg-foreground/[0.04]"
            >
              <p className="text-sm font-semibold">개인정보처리방침</p>
              <Chevron />
            </Link>
          </div>
        </section>

        <p className="pb-2 text-center text-[11px] text-muted">PhotoWall · 0.1.0 · Konva</p>
      </div>

      {message && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg">
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
