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
  legalConsentedAt: string | null;
  legalVersion: string | null;
  plan: UserPlan;
  planExpiresAt?: string | null;
}

interface OrphanWall {
  id: string;
  theme_id: string;
  created_at: string;
  updated_at: string;
}

const GRANT_OPTIONS: { days: number | null; label: string }[] = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
  { days: 365, label: "1년" },
  { days: null, label: "무기한" },
];

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orphanWalls, setOrphanWalls] = useState<OrphanWall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await authFetch(`/api/admin/users?${params}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error ?? "불러오기 실패");
      }
      setUsers((data as { users?: AdminUser[] }).users ?? []);
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : "유저 목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadOrphans = useCallback(async () => {
    const res = await authFetch("/api/admin/users?filter=orphan-walls");
    if (res.ok) {
      const data = await res.json();
      setOrphanWalls(data.orphanWalls ?? []);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadOrphans();
  }, [loadUsers, loadOrphans]);

  const toggleRestrict = async (user: AdminUser) => {
    const nextRestricted = !user.restrictedAt;
    if (
      nextRestricted &&
      !confirm(`${user.displayName} 계정의 공유·응원·방명록을 제한할까요?`)
    ) {
      return;
    }

    setActingId(user.id);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restricted: nextRestricted,
          reason: nextRestricted ? "관리자 제한" : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as { restrictedAt: string | null };
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, restrictedAt: updated.restrictedAt } : u,
        ),
      );
      setMessage(nextRestricted ? "계정을 제한했어요" : "제한을 해제했어요");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("처리에 실패했어요");
    } finally {
      setActingId(null);
    }
  };

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
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as {
        plan: UserPlan;
        planExpiresAt: string | null;
      };
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                plan: updated.plan,
                planExpiresAt: updated.planExpiresAt,
              }
            : u,
        ),
      );
      const until = updated.planExpiresAt
        ? `${new Date(updated.planExpiresAt).toLocaleDateString("ko-KR")}까지`
        : "무기한";
      setMessage(`${PLAN_UI_NAME[updated.plan]} 부여 · ${until}`);
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("플랜 변경에 실패했어요");
    } finally {
      setActingId(null);
    }
  };

  const revokePlan = async (user: AdminUser) => {
    if (
      !confirm(
        `${user.displayName}을(를) ${PLAN_UI_NAME.free}(으)로 내릴까요?`,
      )
    ) {
      return;
    }
    setActingId(user.id);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as {
        plan: UserPlan;
        planExpiresAt: string | null;
      };
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                plan: updated.plan,
                planExpiresAt: updated.planExpiresAt,
              }
            : u,
        ),
      );
      setMessage(`${PLAN_UI_NAME[updated.plan]}로 변경했어요`);
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("플랜 변경에 실패했어요");
    } finally {
      setActingId(null);
    }
  };

  const wipeUser = async (user: AdminUser) => {
    if (
      !confirm(
        `${user.displayName}의 벽·사진·소셜 데이터를 삭제하고 계정을 제한할까요? (로그인은 유지)`,
      )
    ) {
      return;
    }
    setActingId(user.id);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}/wipe`, {
        method: "POST",
        headers: { "X-Confirm-Wipe": "WIPE" },
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, restrictedAt: new Date().toISOString(), wallCount: 0 }
            : u,
        ),
      );
      setMessage("콘텐츠를 삭제하고 제한했어요");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("삭제에 실패했어요");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">유저</h2>
        <p className="text-sm text-muted">
          가입자 검색 · 계정 제한 ·{" "}
          <Link href="/admin/plans" className="text-accent-dark underline">
            플랜 부여
          </Link>
          · 레거시 벽
        </p>
      </section>

      <div className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="닉네임 또는 친구 코드"
          className="flex-1 rounded-xl border border-foreground/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent-dark"
        />
        <button
          type="button"
          onClick={() => void loadUsers()}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background"
        >
          검색
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
        {error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="p-4 text-sm text-muted">불러오는 중...</p>
        ) : users.length === 0 ? (
          <p className="p-4 text-sm text-muted">유저가 없어요</p>
        ) : (
          <ul className="divide-y divide-foreground/8">
            {users.map((user) => (
              <li key={user.id} className="space-y-2 px-4 py-3">
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
                      {PLAN_UI_NAME[user.plan ?? "free"]}
                    </span>
                    {user.plan === "premium" && (
                      <span className="text-[10px] text-muted">
                        {user.planExpiresAt
                          ? `${new Date(user.planExpiresAt).toLocaleDateString("ko-KR")}까지`
                          : "무기한"}
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
                    {user.legalConsentedAt
                      ? ` · 약관 ${user.legalVersion ?? "동의"}`
                      : " · 약관 미동의"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium"
                  >
                    상세
                  </Link>
                  {user.plan === "premium" && (
                    <button
                      type="button"
                      disabled={actingId === user.id}
                      onClick={() => void revokePlan(user)}
                      className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {actingId === user.id ? "처리 중…" : "기본으로"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actingId === user.id}
                    onClick={() => void toggleRestrict(user)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      user.restrictedAt
                        ? "bg-foreground/5 text-foreground"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {actingId === user.id
                      ? "처리 중…"
                      : user.restrictedAt
                        ? "제한 해제"
                        : "제한"}
                  </button>
                  <button
                    type="button"
                    disabled={actingId === user.id}
                    onClick={() => void wipeUser(user)}
                    className="rounded-full bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-800 disabled:opacity-50"
                  >
                    콘텐츠 삭제
                  </button>
                  <span className="font-mono text-[11px] text-muted">{user.id.slice(0, 8)}…</span>
                </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted">
                    {PLAN_UI_NAME.premium}:
                  </span>
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">owner 없는 레거시 벽</h3>
        {orphanWalls.length === 0 ? (
          <p className="rounded-2xl border border-foreground/8 bg-surface p-4 text-sm text-muted">
            레거시 벽이 없어요
          </p>
        ) : (
          <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
            {orphanWalls.map((wall) => (
              <li key={wall.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-sm">{wall.id.slice(0, 8)}…</p>
                  <p className="text-xs text-muted">
                    {new Date(wall.updated_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <Link
                  href={`/admin/walls?q=${wall.id}`}
                  className="text-xs font-medium text-accent-dark underline"
                >
                  관리
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background">
          {message}
        </p>
      )}
    </div>
  );
}
