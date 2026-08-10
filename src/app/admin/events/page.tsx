"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import type { EventPost } from "@/types/event-post";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function AdminEventsPage() {
  const [posts, setPosts] = useState<EventPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [ctaLabel, setCtaLabel] = useState("자세히");
  const [sortOrder, setSortOrder] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/events");
      if (!res.ok) throw new Error();
      setPosts((await res.json()) as EventPost[]);
    } catch {
      setMessage("목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = async (file: File | null) => {
    setImageUrl(null);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!file) return;

    try {
      setPreviewUrl(URL.createObjectURL(file));
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch("/api/admin/events/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "업로드 실패");
      }
      const data = (await res.json()) as { imageUrl: string };
      setImageUrl(data.imageUrl);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "이미지 업로드에 실패했어요");
      setPreviewUrl(null);
      setImageUrl(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) {
      setMessage("제목 또는 본문을 입력해 주세요");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          imageUrl,
          href: href.trim() || null,
          ctaLabel: ctaLabel.trim() || "자세히",
          sortOrder,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
        }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setBody("");
      setHref("");
      setCtaLabel("자세히");
      setStartsAt("");
      setEndsAt("");
      setImageUrl(null);
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setMessage("이벤트를 등록했어요");
      await load();
    } catch {
      setMessage("등록에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: EventPost) => {
    try {
      const res = await authFetch(`/api/admin/events/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setMessage("상태 변경에 실패했어요");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 이벤트를 삭제할까요?")) return;
    try {
      const res = await authFetch(`/api/admin/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setMessage("삭제에 실패했어요");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">이벤트 게시물</h2>
        <p className="mt-1 text-sm text-muted">
          기간·이미지·링크가 있는 캠페인 게시물입니다. 홈 시트와 /news에 표시됩니다.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="space-y-3 rounded-2xl border border-foreground/10 bg-surface p-4"
      >
        <h3 className="text-sm font-semibold">새 이벤트</h3>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="본문"
          rows={4}
          className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
        />

        <label className="block text-xs text-muted">
          커버 이미지 (선택)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </label>
        {(previewUrl || imageUrl) && (
          <div className="overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl || imageUrl || ""}
              alt="미리보기"
              className="max-h-48 w-full object-cover"
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">
            링크 (선택)
            <input
              type="text"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            CTA 문구
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            정렬 (작을수록 위)
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
          <div />
          <label className="block text-xs text-muted">
            시작 (선택)
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-muted">
            종료 (선택)
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? "등록 중..." : "이벤트 등록"}
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">등록된 이벤트</h3>
        {loading ? (
          <p className="text-sm text-muted">불러오는 중...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted">등록된 이벤트가 없어요</p>
        ) : (
          <ul className="space-y-2">
            {posts.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        item.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-foreground/10 text-muted"
                      }`}
                    >
                      {item.active ? "활성" : "비활성"}
                    </span>
                  </div>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title || "이벤트"}
                      className="max-h-40 w-full max-w-md rounded-lg object-cover"
                    />
                  ) : null}
                  <p className="text-sm font-semibold">{item.title || "(제목 없음)"}</p>
                  {item.body ? (
                    <p className="line-clamp-3 text-[12px] text-muted">{item.body}</p>
                  ) : null}
                  {item.href ? (
                    <p className="text-[11px] text-muted">
                      {item.ctaLabel} → {item.href}
                    </p>
                  ) : null}
                  {(item.startsAt || item.endsAt) && (
                    <p className="text-[11px] text-muted">
                      {item.startsAt ? `시작 ${toLocalInput(item.startsAt)}` : ""}
                      {item.startsAt && item.endsAt ? " · " : ""}
                      {item.endsAt ? `종료 ${toLocalInput(item.endsAt)}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(item)}
                    className="rounded-lg bg-foreground/5 px-3 py-1.5 text-xs font-medium hover:bg-foreground/10"
                  >
                    {item.active ? "끄기" : "켜기"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
