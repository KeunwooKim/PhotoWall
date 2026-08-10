"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";

type AdminPack = {
  id: string;
  name: string;
  description: string;
  emoji: string | null;
  status: string;
  sticker_count: number;
  creator_id: string;
  coverUrl: string | null;
  reject_reason: string | null;
  created_at: string;
};

export default function AdminStickerPacksPage() {
  const [status, setStatus] = useState("pending");
  const [packs, setPacks] = useState<AdminPack[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`/api/admin/sticker-packs?status=${status}`);
    if (!res.ok) {
      setMessage("목록을 불러오지 못했어요");
      return;
    }
    const data = (await res.json()) as { packs: AdminPack[] };
    setPacks(data.packs ?? []);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, action: "approve" | "reject" | "take_down") => {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt("거절 사유", "심사 기준에 맞지 않아요") ?? undefined;
      if (reason === undefined) return;
    }
    setBusyId(id);
    setMessage(null);
    try {
      const res = await authFetch(`/api/admin/sticker-packs/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "실패");
      }
      await load();
      setMessage(action === "approve" ? "승인했어요" : action === "reject" ? "거절했어요" : "비공개 처리");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "오류");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">스티커팩 심사</h2>
          <p className="text-sm text-muted">대기열 승인 / 거절 / 비공개</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-foreground/10 bg-surface px-3 py-2 text-sm"
        >
          <option value="pending">대기</option>
          <option value="published">공개</option>
          <option value="rejected">거절</option>
          <option value="taken_down">비공개</option>
          <option value="draft">초안</option>
        </select>
      </div>

      {message && <p className="text-sm text-muted">{message}</p>}

      {packs.length === 0 ? (
        <p className="text-sm text-muted">해당 상태의 팩이 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {packs.map((pack) => (
            <li
              key={pack.id}
              className="flex flex-wrap gap-4 rounded-2xl border border-foreground/10 bg-surface p-4"
            >
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-foreground/5">
                {pack.coverUrl ? (
                  <img src={pack.coverUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-2xl">{pack.emoji ?? "📦"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/stickers/${pack.id}`} className="font-semibold hover:underline">
                  {pack.name}
                </Link>
                <p className="mt-1 text-xs text-muted line-clamp-2">{pack.description}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {pack.sticker_count}장 · creator {pack.creator_id.slice(0, 8)}… ·{" "}
                  {new Date(pack.created_at).toLocaleString("ko-KR")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === pack.id}
                        onClick={() => void review(pack.id, "approve")}
                        className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        disabled={busyId === pack.id}
                        onClick={() => void review(pack.id, "reject")}
                        className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium ring-1 ring-foreground/10"
                      >
                        거절
                      </button>
                    </>
                  )}
                  {status === "published" && (
                    <button
                      type="button"
                      disabled={busyId === pack.id}
                      onClick={() => void review(pack.id, "take_down")}
                      className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium ring-1 ring-foreground/10"
                    >
                      비공개
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
