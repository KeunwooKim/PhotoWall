"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";
import { useAuth } from "@/hooks/useAuth";

interface ReportWallButtonProps {
  wallId: string;
}

export default function ReportWallButton({ wallId }: ReportWallButtonProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;

    setSubmitting(true);
    try {
      const res = await authFetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "abuse",
          subject: `벽 신고 (${wallId.slice(0, 8)})`,
          body: body.trim() || "부적절한 콘텐츠 신고",
          relatedWallId: wallId,
        }),
      });

      if (!res.ok) throw new Error();
      setMessage("신고가 접수됐어요");
      setBody("");
      setTimeout(() => {
        setMessage(null);
        setIsOpen(false);
      }, 1500);
    } catch {
      setMessage("신고에 실패했어요");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full bg-white/90 px-3 py-2 text-[11px] text-muted shadow-sm ring-1 ring-black/6 backdrop-blur-sm"
      >
        신고
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3 className="text-base font-semibold">벽 신고</h3>
            <p className="mt-1 text-xs text-muted">신고 사유를 적어 주세요</p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="어떤 문제인지 알려주세요"
                className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-xl bg-foreground/5 py-2.5 text-sm font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-foreground py-2.5 text-sm font-medium text-background disabled:opacity-50"
                >
                  {submitting ? "전송 중..." : "신고하기"}
                </button>
              </div>
            </form>
            {message && <p className="mt-3 text-center text-xs text-muted">{message}</p>}
          </div>
        </div>
      )}
    </>
  );
}
