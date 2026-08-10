"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";
import { PLAN_UI_NAME, type UserPlan } from "@/lib/wall-quotas";

interface AdminUser {
  id: string;
  displayName: string;
  friendCode: string;
  createdAt: string;
  wallCount: number;
  restrictedAt: string | null;
  plan: UserPlan;
  planExpiresAt?: string | null;
}

const GRANT_OPTIONS: { days: number | null; label: string }[] = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
  { days: 365, label: "1년" },
  { days: null, label: "무기한" },
];

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  if (t <= Date.now()) return "만료됨";
  return `${new Date(t).toLocaleDateString("ko-KR")}까지`;
}

export default function AdminPlansPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [initialQ, setInitialQ] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setQuery(q);
      setInitialQ(q);
    }
  }, []);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await authFetch(`/api/admin/users?${params}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error ?? "검색 실패");
      }
      setUsers((data as { users?: AdminUser[] }).users ?? []);
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : "유저를 찾지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void search(initialQ ?? "");
  }, [search, initialQ]);

  const grantPlan = async (user: AdminUser, days: number | null) => {
    const label =
      days == null
        ? `무기한 ${PLAN_UI_NAME.premium}`
        : `${days}일 ${PLAN_UI_NAME.premium}`;
    if (!confirm(`${user.displayName}에게 ${label}을(를) 부여할까요?`)) return;

    setActingId(user.id);
    try {
      const body =
        days == null
          ? { plan: "premium" as const, planExpiresAt: null }
          : { plan: "premium" as const, planDurationDays: days };
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "변경 실패");
      }
      const updated = (await res.json()) as {
        plan: UserPlan;
        planExpiresAt: string | null;
      };
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, plan: updated.plan, planExpiresAt: updated.planExpiresAt }
            : u,
        ),
      );
      const until = formatExpiry(updated.planExpiresAt);
      setMessage(
        until
          ? `${user.displayName} → ${PLAN_UI_NAME[updated.plan]} (${until})`
          : `${user.displayName} → ${PLAN_UI_NAME[updated.plan]} (무기한)`,
      );
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "플랜 변경에 실패했어요");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setActingId(null);
    }
  };

  const revokePlan = async (user: AdminUser) => {
    if (!confirm(`${user.displayName}을(를) ${PLAN_UI_NAME.free}(으)로 내릴까요?`)) {
      return;
    }

    setActingId(user.id);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "변경 실패");
      }
      const updated = (await res.json()) as {
        plan: UserPlan;
        planExpiresAt: string | null;
      };
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, plan: updated.plan, planExpiresAt: updated.planExpiresAt }
            : u,
        ),
      );
      setMessage(`${user.displayName} → ${PLAN_UI_NAME[updated.plan]}`);
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "플랜 변경에 실패했어요");
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">플랜</h2>
        <p className="text-sm text-muted">
          닉네임·친구 코드로 검색해 {PLAN_UI_NAME.premium}을 기간제 또는 무기한으로 부여합니다.
          만료되면 자동으로 기본 플랜으로 취급돼요.
        </p>
      </section>

      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="닉네임 또는 친구 코드"
          className="flex-1 rounded-xl border border-foreground/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent-dark"
        />
        <button
          type="submit"
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background"
        >
          검색
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
        {error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="p-4 text-sm text-muted">불러오는 중...</p>
        ) : !searched ? (
          <p className="p-4 text-sm text-muted">검색해 보세요</p>
        ) : users.length === 0 ? (
          <p className="p-4 text-sm text-muted">유저가 없어요</p>
        ) : (
          <ul className="divide-y divide-foreground/8">
            {users.map((user) => {
              const expiryLabel = formatExpiry(user.planExpiresAt);
              return (
                <li key={user.id} className="space-y-3 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {user.displayName}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            user.plan === "premium"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-foreground/5 text-muted"
                          }`}
                        >
                          {PLAN_UI_NAME[user.plan]}
                        </span>
                        {user.plan === "premium" && (
                          <span className="text-[10px] text-muted">
                            {expiryLabel ?? "무기한"}
                          </span>
                        )}
                        {user.restrictedAt && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            제한중
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        @{user.friendCode} · 벽 {user.wallCount}개 ·{" "}
                        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <Link
                      href={`/admin/users?q=${encodeURIComponent(user.friendCode)}`}
                      className="text-[11px] text-muted underline"
                    >
                      유저 상세
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {GRANT_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={actingId === user.id}
                        onClick={() => void grantPlan(user, opt.days)}
                        className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900 disabled:opacity-50"
                      >
                        {actingId === user.id ? "…" : opt.label}
                      </button>
                    ))}
                    {user.plan === "premium" && (
                      <button
                        type="button"
                        disabled={actingId === user.id}
                        onClick={() => void revokePlan(user)}
                        className="rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
                      >
                        기본으로
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {message && (
        <p className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background">
          {message}
        </p>
      )}
    </div>
  );
}
