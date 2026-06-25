"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import type { Announcement, AnnouncementSeverity, AnnouncementTarget } from "@/types/announcement";

const SEVERITY_OPTIONS: { value: AnnouncementSeverity; label: string }[] = [
  { value: "info", label: "안내" },
  { value: "warning", label: "주의" },
  { value: "critical", label: "긴급" },
];

const TARGET_OPTIONS: { value: AnnouncementTarget; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "home", label: "홈" },
  { value: "editor", label: "에디터" },
];

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

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<AnnouncementSeverity>("info");
  const [target, setTarget] = useState<AnnouncementTarget>("all");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/announcements");
      if (!res.ok) throw new Error();
      setAnnouncements((await res.json()) as Announcement[]);
    } catch {
      setMessage("목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: body.trim(),
          severity,
          target,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
        }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setBody("");
      setStartsAt("");
      setEndsAt("");
      setMessage("공지를 등록했어요");
      await load();
    } catch {
      setMessage("등록에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: Announcement) => {
    try {
      const res = await authFetch(`/api/admin/announcements/${item.id}`, {
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
    if (!window.confirm("이 공지를 삭제할까요?")) return;
    try {
      const res = await authFetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setMessage("삭제에 실패했어요");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">공지·점검 배너</h2>
        <p className="mt-1 text-sm text-muted">홈·에디터 상단에 표시되는 운영 공지입니다.</p>
      </div>

      {message && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-foreground/10 bg-surface p-4">
        <h3 className="text-sm font-semibold">새 공지</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (선택)"
          className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="공지 내용"
          rows={3}
          required
          className="w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm outline-none focus:border-foreground/25"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">
            심각도
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AnnouncementSeverity)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            표시 위치
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as AnnouncementTarget)}
              className="mt-1 w-full rounded-xl border border-foreground/10 px-3 py-2 text-sm"
            >
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
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
          disabled={saving || !body.trim()}
          className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? "등록 중..." : "공지 등록"}
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">등록된 공지</h3>
        {loading ? (
          <p className="text-sm text-muted">불러오는 중...</p>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-muted">등록된 공지가 없어요</p>
        ) : (
          <ul className="space-y-2">
            {announcements.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        item.active ? "bg-emerald-100 text-emerald-800" : "bg-foreground/10 text-muted"
                      }`}
                    >
                      {item.active ? "활성" : "비활성"}
                    </span>
                    <span className="text-[10px] uppercase text-muted">{item.severity}</span>
                    <span className="text-[10px] text-muted">· {item.target}</span>
                  </div>
                  {item.title ? <p className="mt-1 text-sm font-semibold">{item.title}</p> : null}
                  <p className="mt-1 text-sm text-muted">{item.message}</p>
                  {(item.startsAt || item.endsAt) && (
                    <p className="mt-2 text-[11px] text-muted">
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
