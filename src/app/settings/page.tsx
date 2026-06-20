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

const THEME_OPTIONS: { value: ThemeMode; label: string; desc: string }[] = [
  { value: "light", label: "라이트", desc: "밝은 화면" },
  { value: "dark", label: "다크", desc: "어두운 화면" },
  { value: "system", label: "시스템", desc: "기기 설정 따름" },
];

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { user, isLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="space-y-1">
          <h1 className="text-xl font-bold">설정</h1>
          <p className="text-sm text-muted">앱 환경을 맞춰 보세요</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">테마</h2>
          <div className="grid gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                  mode === option.value
                    ? "border-accent-dark bg-accent/10"
                    : "border-foreground/8 bg-surface hover:border-foreground/15"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="text-xs text-muted">{option.desc}</p>
                </div>
                {mode === option.value && (
                  <span className="text-sm text-accent-dark">✓</span>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">개인정보</h2>
          {!user && !isLoading && (
            <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
              <p className="text-sm text-muted">로그인하면 벽 방문 설정을 변경할 수 있어요</p>
              <div className="mt-3">
                <AuthButton />
              </div>
            </div>
          )}
          {user && (
            <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">친구 벽 방문 허용</p>
                  <p className="mt-1 text-xs text-muted">
                    켜야 친구가 내 개인 벽을 방문할 수 있어요. 기본값은 비공개예요.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile?.allowWallVisits ?? false}
                  disabled={!profile || isSavingPrivacy}
                  onClick={handleToggleWallVisits}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    profile?.allowWallVisits ? "bg-accent-dark" : "bg-foreground/15"
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      profile?.allowWallVisits ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">문의</h2>
          {!user && !isLoading && (
            <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
              <p className="text-sm text-muted">로그인하면 문의를 보낼 수 있어요</p>
            </div>
          )}
          {user && (
            <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
              <InquiryForm />
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">관리</h2>
            <Link
              href="/admin"
              className="flex items-center justify-between rounded-2xl border border-foreground/8 bg-surface p-4 transition hover:border-accent-dark/40"
            >
              <div>
                <p className="text-sm font-semibold">관리자 페이지</p>
                <p className="mt-1 text-xs text-muted">문의·벽·유저 관리</p>
              </div>
              <span className="text-sm text-accent-dark">→</span>
            </Link>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">계정</h2>
          <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
            <AuthButton />
          </div>
        </section>

        <section className="rounded-2xl border border-foreground/8 bg-surface p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">정보</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">버전</dt>
              <dd>0.1.0 MVP</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">에디터</dt>
              <dd>Fabric.js</dd>
            </div>
          </dl>
        </section>
      </div>

      {message && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg">
          {message}
        </div>
      )}
    </AppShell>
  );
}
