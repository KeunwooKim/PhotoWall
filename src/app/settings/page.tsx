"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import InquiryForm from "@/components/settings/InquiryForm";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import type { Profile } from "@/types/profile";
import type { ThemeMode } from "@/lib/settings-storage";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
  { value: "system", label: "시스템" },
];

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
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
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-1 pt-1">
          <h1 className="text-2xl font-bold tracking-tight">설정</h1>
          <p className="text-sm text-muted">화면과 프라이버시를 맞춰 보세요</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">테마</h2>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-foreground/[0.04] p-1">
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
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    profile?.allowWallVisits ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted">문의</h2>
          {!user && !isLoading ? (
            <p className="rounded-2xl bg-foreground/[0.03] px-4 py-4 text-sm text-muted">
              로그인하면 문의를 보낼 수 있어요
            </p>
          ) : (
            <div className="rounded-2xl bg-foreground/[0.03] px-4 py-4">
              <InquiryForm />
            </div>
          )}
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
                    className="flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {isDeleting ? "탈퇴 중..." : "영구 탈퇴"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

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
