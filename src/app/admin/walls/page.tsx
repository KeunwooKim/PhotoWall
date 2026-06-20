"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";

interface AdminWall {
  id: string;
  themeId: string;
  ownerId: string | null;
  title: string | null;
  isShared: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WallComment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

interface WallGuestbook {
  id: string;
  author_name: string;
  created_at: string;
}

export default function AdminWallsPage() {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [walls, setWalls] = useState<AdminWall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comments, setComments] = useState<WallComment[]>([]);
  const [guestbook, setGuestbook] = useState<WallGuestbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadWalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (query.trim()) params.set("q", query.trim());
      const res = await authFetch(`/api/admin/walls?${params}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error ?? "불러오기 실패");
      }
      setWalls(data as AdminWall[]);
    } catch (err) {
      setWalls([]);
      setMessage(err instanceof Error ? err.message : "벽 목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    try {
      const res = await authFetch(`/api/admin/walls/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(data.comments ?? []);
      setGuestbook(data.guestbook ?? []);
    } catch {
      setComments([]);
      setGuestbook([]);
    }
  }, []);

  useEffect(() => {
    void loadWalls();
  }, [loadWalls]);

  const patchWall = async (id: string, isHidden: boolean) => {
    try {
      const res = await authFetch(`/api/admin/walls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "처리에 실패했어요");
      setWalls((prev) => prev.map((w) => (w.id === id ? { ...w, isHidden } : w)));
      setMessage(isHidden ? "벽을 숨겼어요" : "벽을 다시 공개했어요");
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "처리에 실패했어요");
    }
  };

  const deleteWall = async (id: string) => {
    if (!confirm("벽을 완전히 삭제할까요? 되돌릴 수 없어요.")) return;
    try {
      const res = await authFetch(`/api/admin/walls/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "삭제에 실패했어요");
      setWalls((prev) => prev.filter((w) => w.id !== id));
      if (selectedId === id) setSelectedId(null);
      setMessage("벽을 삭제했어요");
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제에 실패했어요");
    }
  };

  const deleteComment = async (id: string) => {
    const res = await authFetch(`/api/admin/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const deleteGuestbook = async (id: string) => {
    const res = await authFetch(`/api/admin/guestbook/${id}`, { method: "DELETE" });
    if (res.ok) {
      setGuestbook((prev) => prev.filter((g) => g.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">벽 관리</h2>
        <p className="text-sm text-muted">벽 검색, 숨김, 삭제 및 소셜 콘텐츠 정리</p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="벽 ID 또는 제목 검색"
          className="flex-1 rounded-xl border border-foreground/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent-dark"
        />
        <button
          type="button"
          onClick={() => void loadWalls()}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background"
        >
          검색
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["all", "전체"],
          ["shared", "공동"],
          ["orphan", "owner 없음"],
          ["hidden", "숨김"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === value ? "bg-foreground text-background" : "bg-foreground/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
          {loading ? (
            <p className="p-4 text-sm text-muted">불러오는 중...</p>
          ) : walls.length === 0 ? (
            <p className="p-4 text-sm text-muted">벽이 없어요</p>
          ) : (
            <ul className="divide-y divide-foreground/8 max-h-[520px] overflow-y-auto">
              {walls.map((wall) => (
                <li key={wall.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void loadDetail(wall.id)}
                    className="w-full text-left"
                  >
                    <p className="truncate text-sm font-medium">
                      {wall.title || wall.id.slice(0, 8)}
                      {wall.isHidden && (
                        <span className="ml-2 text-xs text-red-600">숨김</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {wall.isShared ? "공동" : "개인"} · owner{" "}
                      {wall.ownerId?.slice(0, 8) ?? "없음"}
                    </p>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/wall/${wall.id}`}
                      target="_blank"
                      className="text-xs text-accent-dark underline"
                    >
                      보기
                    </Link>
                    <button
                      type="button"
                      onClick={() => void patchWall(wall.id, !wall.isHidden)}
                      className="text-xs text-muted underline"
                    >
                      {wall.isHidden ? "공개" : "숨김"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteWall(wall.id)}
                      className="text-xs text-red-600 underline"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
          {!selectedId ? (
            <p className="text-sm text-muted">벽을 선택하면 댓글·방명록을 볼 수 있어요</p>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">댓글</h3>
              {comments.length === 0 ? (
                <p className="text-xs text-muted">댓글 없음</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-xl bg-background p-3 text-sm">
                      <p className="font-medium">{c.author_name}</p>
                      <p className="mt-1">{c.body}</p>
                      <button
                        type="button"
                        onClick={() => void deleteComment(c.id)}
                        className="mt-2 text-xs text-red-600 underline"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="text-sm font-semibold">방명록</h3>
              {guestbook.length === 0 ? (
                <p className="text-xs text-muted">방명록 없음</p>
              ) : (
                <ul className="space-y-2">
                  {guestbook.map((g) => (
                    <li key={g.id} className="flex items-center justify-between rounded-xl bg-background p-3 text-sm">
                      <span>{g.author_name}</span>
                      <button
                        type="button"
                        onClick={() => void deleteGuestbook(g.id)}
                        className="text-xs text-red-600 underline"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {message && (
        <p className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-2xl bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}
