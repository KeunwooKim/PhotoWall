"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";
import {
  BUSINESS_STAGE_LABELS,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type BusinessStage,
  type Inquiry,
  type InquiryStatus,
} from "@/types/inquiry";

type CategoryFilter = "all" | "abuse" | "business" | "other";

function InquiriesContent() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const initialCategory = (searchParams.get("category") as CategoryFilter | null) ?? "all";
  const initialStatus = searchParams.get("status") ?? "all";

  const [statusFilter, setStatusFilter] = useState(
    ["all", "open", "in_progress", "resolved"].includes(initialStatus) ? initialStatus : "all",
  );
  const categoryFilterInit =
    initialCategory === "abuse" || initialCategory === "other" || initialCategory === "business"
      ? initialCategory
      : "all";
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(categoryFilterInit);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [adminReply, setAdminReply] = useState("");
  const [businessStage, setBusinessStage] = useState<BusinessStage | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hidingWall, setHidingWall] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const qs = params.toString();
      const res = await authFetch(`/api/admin/inquiries${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Inquiry[];
      setInquiries(data);
    } catch {
      setMessage("목록을 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/admin/inquiries/${id}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Inquiry;
      setSelected(data);
      setAdminNote(data.adminNote ?? "");
      setAdminReply(data.adminReply ?? "");
      setBusinessStage(data.businessStage ?? "");
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
    setAdminReply(inquiry.adminReply ?? "");
    setBusinessStage(inquiry.businessStage ?? "");
    const params = new URLSearchParams();
    params.set("id", inquiry.id);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    window.history.replaceState(null, "", `/admin/inquiries?${params}`);
  };

  const handleCategoryChange = (next: CategoryFilter) => {
    setCategoryFilter(next);
    const params = new URLSearchParams();
    if (selectedId) params.set("id", selectedId);
    if (next !== "all") params.set("category", next);
    const qs = params.toString();
    window.history.replaceState(null, "", `/admin/inquiries${qs ? `?${qs}` : ""}`);
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
          adminReply,
          businessStage:
            selected.category === "business"
              ? businessStage || null
              : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Inquiry;
      setSelected(updated);
      setAdminReply(updated.adminReply ?? "");
      setBusinessStage(updated.businessStage ?? "");
      setInquiries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setMessage("저장됐어요");
      setTimeout(() => setMessage(null), 1500);
    } catch {
      setMessage("저장에 실패했어요");
    } finally {
      setSaving(false);
    }
  };

  const handleHideWall = async (resolveToo = false) => {
    if (!selected?.relatedWallId) return;
    setHidingWall(true);
    try {
      const hideRes = await authFetch(`/api/admin/walls/${selected.relatedWallId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: true }),
      });
      if (!hideRes.ok) throw new Error();

      if (resolveToo) {
        const note =
          adminNote.trim() ||
          `벽 숨김 처리 (${new Date().toLocaleString("ko-KR")})`;
        const res = await authFetch(`/api/admin/inquiries/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "resolved",
            adminNote: note,
            adminReply,
          }),
        });
        if (!res.ok) throw new Error();
        const updated = (await res.json()) as Inquiry;
        setSelected(updated);
        setAdminNote(updated.adminNote ?? note);
        setInquiries((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setMessage("벽을 숨기고 신고를 완료 처리했어요");
      } else {
        setMessage("벽을 숨겼어요");
      }
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("벽 숨김에 실패했어요");
    } finally {
      setHidingWall(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">문의·신고</h2>
        <p className="text-sm text-muted">유저 문의와 신고를 처리해요</p>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "전체"],
            ["abuse", "신고"],
            ["business", "제휴"],
            ["other", "문의"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => handleCategoryChange(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              categoryFilter === value
                ? "bg-foreground text-background"
                : "bg-foreground/5 text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
            {s === "all" ? "상태 전체" : INQUIRY_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
          {loading ? (
            <p className="p-4 text-sm text-muted">불러오는 중...</p>
          ) : inquiries.length === 0 ? (
            <p className="p-4 text-sm text-muted">항목이 없어요</p>
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
                      {item.category === "business" && item.businessStage
                        ? ` · ${BUSINESS_STAGE_LABELS[item.businessStage]}`
                        : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
          {!selected ? (
            <p className="text-sm text-muted">왼쪽에서 항목을 선택하세요</p>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span>관련 벽: </span>
                    <Link
                      href={`/wall/${selected.relatedWallId}`}
                      className="font-medium text-accent-dark underline"
                      target="_blank"
                    >
                      {selected.relatedWallId.slice(0, 8)}…
                    </Link>
                    <Link
                      href={`/admin/walls?q=${selected.relatedWallId}`}
                      className="font-medium text-accent-dark underline"
                    >
                      관리
                    </Link>
                    <button
                      type="button"
                      disabled={hidingWall}
                      onClick={() => void handleHideWall(false)}
                      className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 disabled:opacity-50"
                    >
                      {hidingWall ? "숨기는 중…" : "벽 숨김"}
                    </button>
                    {selected.category === "abuse" && selected.status !== "resolved" && (
                      <button
                        type="button"
                        disabled={hidingWall}
                        onClick={() => void handleHideWall(true)}
                        className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
                      >
                        숨기고 완료
                      </button>
                    )}
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

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted">유저 회신 (앱 알림)</label>
                <textarea
                  value={adminReply}
                  onChange={(e) => setAdminReply(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-accent-dark"
                  placeholder="유저에게 보낼 답변"
                />
                {selected.adminRepliedAt ? (
                  <p className="text-[11px] text-muted">
                    최근 회신: {new Date(selected.adminRepliedAt).toLocaleString("ko-KR")}
                  </p>
                ) : null}
              </div>

              {selected.category === "business" ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted">제휴 파이프라인</label>
                  <select
                    value={businessStage}
                    onChange={(e) =>
                      setBusinessStage((e.target.value || "") as BusinessStage | "")
                    }
                    className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm"
                  >
                    <option value="">미지정</option>
                    {(Object.keys(BUSINESS_STAGE_LABELS) as BusinessStage[]).map((s) => (
                      <option key={s} value={s}>
                        {BUSINESS_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

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
                  저장·회신
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
