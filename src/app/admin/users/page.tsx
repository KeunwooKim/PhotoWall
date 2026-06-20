"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";

interface AdminUser {
  id: string;
  displayName: string;
  friendCode: string;
  createdAt: string;
  wallCount: number;
}

interface OrphanWall {
  id: string;
  theme_id: string;
  created_at: string;
  updated_at: string;
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orphanWalls, setOrphanWalls] = useState<OrphanWall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">유저</h2>
        <p className="text-sm text-muted">가입자 검색 및 레거시 벽 확인</p>
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
              <li key={user.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted">
                    @{user.friendCode} · 벽 {user.wallCount}개 ·{" "}
                    {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-muted">{user.id.slice(0, 8)}…</span>
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
    </div>
  );
}
