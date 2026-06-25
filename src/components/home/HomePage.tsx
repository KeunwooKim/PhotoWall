"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { user } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("auth_error")) return;
    window.history.replaceState({}, "", "/");
    setAuthError("Google 로그인에 실패했어요. Supabase·Google Cloud URL 설정을 확인해 주세요.");
  }, []);

  return (
    <AppShell>
      <div className="space-y-8">
        <AnnouncementBanner target="home" />
        {authError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
            {authError}
          </div>
        )}
        <section className="space-y-4 pt-2">
          <div className="inline-flex rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-dark">
            Z세대 감성 포토월
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            네컷사진,
            <br />
            <span className="text-accent-dark">디지털 벽</span>에 붙여요
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            오프라인 포토부스 감성 그대로. 사진을 끌어다 놓고, 테이프와 스티커로
            꾸민 뒤 친구와 공유해 보세요.
          </p>
        </section>

        <section className="grid gap-3">
          <Link
            href="/wall/edit"
            className="flex items-center justify-center rounded-2xl bg-foreground px-6 py-4 text-sm font-semibold text-background transition active:scale-[0.98]"
          >
            내 벽 꾸미기 시작
          </Link>
          {user ? (
            <Link
              href="/profile"
              className="flex items-center justify-center rounded-2xl border border-foreground/12 bg-surface px-6 py-4 text-sm font-medium transition hover:border-foreground/20 active:scale-[0.98]"
            >
              공동 벽 · 친구 관리
            </Link>
          ) : (
            <div className="flex justify-center">
              <AuthButton />
            </div>
          )}
        </section>

        <section className="grid gap-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-foreground/8 bg-surface p-4"
            >
              <p className="text-lg">{feature.emoji}</p>
              <h3 className="mt-2 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{feature.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

const FEATURES = [
  {
    emoji: "📸",
    title: "자유로운 벽꾸",
    desc: "드래그·회전·테이프·스티커·펜까지. 내 취향대로 벽면을 채워요.",
  },
  {
    emoji: "👯",
    title: "친구와 공동 벽",
    desc: "함께 찍은 네컷을 한 벽에 모아요. 친구 코드로 쉽게 연결.",
  },
  {
    emoji: "🔗",
    title: "링크로 공유",
    desc: "꾸민 벽을 링크로 보내고, 응원 댓글과 방명록도 받아요.",
  },
];
