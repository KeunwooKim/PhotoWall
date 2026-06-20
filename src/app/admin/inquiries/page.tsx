"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type Inquiry,
  type InquiryStatus,
} from "@/types/inquiry";

function InquiriesContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  const [statusFilter, setStatusFilter] = useState("all");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `/api/admin/inquiries${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`,
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Inquiry[];
      setInquiries(data);
    } catch {
      setMessage("목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/admin/inquiries/${id}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Inquiry;
      setSelected(data);
      setAdminNote(data.adminNote ?? "");
    } catch {
      setSelected(null);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const handleSelect = (inquiry: Inquiry) => {
    setSelected(inquiry);
    setAdminNote(inquiry.adminNote ?? "");
    window.history.replaceState(null, "", `/admin/inquiries?id=${inquiry.id}`);
  };

  const handleUpdate = async (status?: InquiryStatus) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/admin/inquiries/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: status ?? selected.status,
          adminNote,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Inquiry;
      setSelected(updated);
      setInquiries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setMessage("저장됐어요");
      setTimeout(() => setMessage(null), 1500);
    } catch {
      setMessage("저장에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">문의·신고</h2>
        <p className="text-sm text-muted">유저 문의와 신고를 처리해요</p>
      </section>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              statusFilter === s
                ? "bg-foreground text-background"
                : "bg-foreground/5 text-foreground"
            }`}
          >
            {s === "all" ? "전체" : INQUIRY_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
          {loading ? (
            <p className="p-4 text-sm text-muted">불러오는 중...</p>
          ) : inquiries.length === 0 ? (
            <p className="p-4 text-sm text-muted">문의가 없어요</p>
          ) : (
            <ul className="divide-y divide-foreground/8 max-h-[480px] overflow-y-auto">
              {inquiries.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-foreground/[0.03] ${
                      selected?.id === item.id ? "bg-accent/10" : ""
                    }`}
                  >
                    <p className="truncate text-sm font-medium">{item.subject}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {INQUIRY_CATEGORY_LABELS[item.category]} ·{" "}
                      {INQUIRY_STATUS_LABELS[item.status]}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
          {!selected ? (
            <p className="text-sm text-muted">왼쪽에서 문의를 선택하세요</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted">{INQUIRY_CATEGORY_LABELS[selected.category]}</p>
                <h3 className="mt-1 text-lg font-semibold">{selected.subject}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">{selected.body}</p>
              </div>

              <dl className="space-y-1 text-xs text-muted">
                <div>
                  <span>작성: </span>
                  {selected.email ?? selected.userId?.slice(0, 8) ?? "—"}
                </div>
                <div>
                  <span>일시: </span>
                  {new Date(selected.createdAt).toLocaleString("ko-KR")}
                </div>
                {selected.relatedWallId && (
                  <div>
                    <span>관련 벽: </span>
                    <Link
                      href={`/wall/${selected.relatedWallId}`}
                      className="font-medium text-accent-dark underline"
                      target="_blank"
                    >
                      {selected.relatedWallId.slice(0, 8)}…
                    </Link>
                  </div>
                )}
              </dl>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted">내부 메모</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-accent-dark"
                  placeholder="처리 내용 메모"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUpdate("in_progress")}
                  className="rounded-full bg-foreground/5 px-4 py-2 text-xs font-medium disabled:opacity-50"
                >
                  처리중
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUpdate("resolved")}
                  className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50"
                >
                  완료
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUpdate()}
                  className="rounded-full bg-accent/20 px-4 py-2 text-xs font-medium text-accent-dark disabled:opacity-50"
                >
                  메모 저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {message && (
        <p className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background">
          {message}
        </p>
      )}
    </div>
  );
}

export default function AdminInquiriesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중...</p>}>
      <InquiriesContent />
    </Suspense>
  );
}
