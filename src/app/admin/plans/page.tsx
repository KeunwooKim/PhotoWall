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
}

export default function AdminPlansPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    void search("");
  }, [search]);

  const setPlan = async (user: AdminUser, plan: UserPlan) => {
    if (user.plan === plan) return;
    const label = PLAN_UI_NAME[plan];
    if (
      !confirm(
        plan === "premium"
          ? `${user.displayName}을(를) ${label}로 업그레이드할까요?`
          : `${user.displayName}을(를) ${label}(으)로 내릴까요?`,
      )
    ) {
      return;
    }

    setActingId(user.id);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "변경 실패");
      }
      const updated = (await res.json()) as { plan: UserPlan };
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, plan: updated.plan } : u)),
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
          닉네임·친구 코드로 검색해 {PLAN_UI_NAME.premium}을 부여하거나 기본으로 내립니다. 결제 연동 전
          수동 부여용이에요.
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
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
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
                <div className="flex items-center gap-2">
                  {user.plan === "premium" ? (
                    <button
                      type="button"
                      disabled={actingId === user.id}
                      onClick={() => void setPlan(user, "free")}
                      className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {actingId === user.id ? "처리 중…" : "기본으로"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actingId === user.id}
                      onClick={() => void setPlan(user, "premium")}
                      className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
                    >
                      {actingId === user.id ? "처리 중…" : `${PLAN_UI_NAME.premium} 부여`}
                    </button>
                  )}
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(user.friendCode)}`}
                    className="text-[11px] text-muted underline"
                  >
                    유저 상세
                  </Link>
                </div>
              </li>
            ))}
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
