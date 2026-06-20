"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";
import { INQUIRY_CATEGORY_LABELS, INQUIRY_STATUS_LABELS } from "@/types/inquiry";
import type { InquiryCategory, InquiryStatus } from "@/types/inquiry";

interface Stats {
  users: number;
  walls: number;
  sharedWalls: number;
  orphanWalls: number;
  likes: number;
  comments: number;
  guestbook: number;
  openInquiries: number;
  hasServiceRole?: boolean;
  recentInquiries: {
    id: string;
    category: InquiryCategory;
    subject: string;
    status: InquiryStatus;
    createdAt: string;
  }[];
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    authFetch("/api/admin/stats")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<Stats>;
      })
      .then(setStats)
      .catch(() => setError("통계를 불러오지 못했어요"));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!stats) {
    return <p className="text-sm text-muted">불러오는 중...</p>;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">대시보드</h2>
        <p className="text-sm text-muted">서비스 현황 요약</p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="가입자" value={stats.users} />
        <StatCard label="벽" value={stats.walls} />
        <StatCard label="공동 벽" value={stats.sharedWalls} />
        <StatCard label="owner 없는 벽" value={stats.orphanWalls} />
        <StatCard label="좋아요" value={stats.likes} />
        <StatCard label="댓글" value={stats.comments} />
        <StatCard label="방명록" value={stats.guestbook} />
        <StatCard label="미처리 문의" value={stats.openInquiries} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">최근 문의</h3>
          <Link href="/admin/inquiries" className="text-xs font-medium text-accent-dark">
            전체 보기
          </Link>
        </div>
        {stats.recentInquiries.length === 0 ? (
          <p className="rounded-2xl border border-foreground/8 bg-surface p-4 text-sm text-muted">
            문의가 없어요
          </p>
        ) : (
          <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
            {stats.recentInquiries.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/inquiries?id=${item.id}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-foreground/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.subject}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {INQUIRY_CATEGORY_LABELS[item.category]} ·{" "}
                      {new Date(item.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium">
                    {INQUIRY_STATUS_LABELS[item.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
