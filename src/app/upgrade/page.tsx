"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import {
  PLAN_UI_NAME,
  WALL_QUOTAS,
  type UserPlan,
} from "@/lib/wall-quotas";
import type { Profile } from "@/types/profile";

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export default function UpgradePage() {
  const { user, isLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const plan: UserPlan = profile?.plan === "premium" ? "premium" : "free";
  const isPlus = plan === "premium";

  const requestUpgrade = async () => {
    if (!user || submitting || isPlus) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "business",
          subject: "플러스 업그레이드 신청",
          body: `플러스(유료) 플랜 업그레이드를 신청합니다.\n친구 코드: ${profile?.friendCode ?? "-"}\n유저 ID: ${user.id}`,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "신청에 실패했어요");
      }
      setMessage("신청을 보냈어요. 확인 후 플러스로 올려 드릴게요.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "신청에 실패했어요");
    } finally {
      setSubmitting(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-8 pb-8 pt-1">
        <header className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted">요금제</p>
          <h1 className="text-2xl font-bold tracking-tight">{PLAN_UI_NAME.premium}</h1>
          <p className="text-sm leading-relaxed text-muted">
            벽·사진·오브젝트 한도를 넓혀 더 자유롭게 꾸며 보세요. 결제 연동 전에는 신청 후
            관리자가 부여합니다.
          </p>
        </header>

        {!user && !isLoading ? (
          <div className="space-y-3 rounded-2xl bg-foreground/[0.03] px-4 py-5">
            <p className="text-sm text-muted">로그인 후 업그레이드를 신청할 수 있어요</p>
            <AuthButton />
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-foreground/[0.03] px-4 py-4">
              <p className="text-xs text-muted">현재 플랜</p>
              <p className="mt-1 text-lg font-semibold">{PLAN_UI_NAME[plan]}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["free", "premium"] as const).map((key) => {
                const q = WALL_QUOTAS[key];
                const active = plan === key;
                return (
                  <div
                    key={key}
                    className={`rounded-2xl border px-4 py-4 ${
                      active
                        ? "border-foreground/25 bg-foreground/[0.04]"
                        : "border-foreground/8 bg-surface"
                    }`}
                  >
                    <p className="text-sm font-semibold">{PLAN_UI_NAME[key]}</p>
                    <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted">
                      <li>공동 벽 {q.maxOwnedSharedWalls}개</li>
                      <li>장면 오브젝트 {q.maxSceneObjects}개</li>
                      <li>장면 크기 {formatMb(q.maxSceneBytes)}</li>
                      <li>사진 업로드 {formatMb(q.maxPhotoBytes)}</li>
                    </ul>
                  </div>
                );
              })}
            </div>

            {isPlus ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-950">
                이미 {PLAN_UI_NAME.premium}예요. 한도가 자동으로 적용됩니다.
              </p>
            ) : (
              <button
                type="button"
                disabled={!user || submitting}
                onClick={() => void requestUpgrade()}
                className="w-full rounded-2xl bg-foreground px-4 py-3.5 text-sm font-semibold text-background transition active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? "신청 중…" : `${PLAN_UI_NAME.premium} 신청하기`}
              </button>
            )}
          </>
        )}

        <Link href="/settings" className="block text-center text-sm text-muted underline">
          설정으로
        </Link>
      </div>

      {message && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background shadow-lg">
          {message}
        </div>
      )}
    </AppShell>
  );
}
