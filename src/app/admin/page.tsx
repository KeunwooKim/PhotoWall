"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth/api-fetch";
import { INQUIRY_CATEGORY_LABELS, INQUIRY_STATUS_LABELS } from "@/types/inquiry";
import type { InquiryCategory, InquiryStatus } from "@/types/inquiry";

interface PeriodStats {
  users: number;
  walls: number;
  inquiries: number;
}

interface ConsentStats {
  ok: number;
  missing: number;
  stale: number;
  version: string;
}

interface DaySeries {
  date: string;
  users: number;
  walls: number;
  inquiries: number;
  importOk: number;
  importFail: number;
  activeEditors: number;
}

interface TodoItem {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "danger" | "warn" | "neutral";
}

interface Stats {
  users: number;
  walls: number;
  sharedWalls: number;
  orphanWalls: number;
  likes: number;
  guestbook: number;
  openInquiries: number;
  openAbuseCount: number;
  premiumUsers?: number;
  openBusinessInquiries?: number;
  hasServiceRole?: boolean;
  rateLimitBackend?: "upstash" | "memory";
  importWeek?: { ok: number | null; fail: number | null; available: boolean };
  today: PeriodStats;
  last7Days: PeriodStats;
  dau?: {
    editorsToday: number;
    editorsWeek: number;
    loginToday: number | null;
    loginWeek: number | null;
  };
  series?: DaySeries[];
  todos?: TodoItem[];
  consent: ConsentStats;
  recentInquiries: {
    id: string;
    category: InquiryCategory;
    subject: string;
    status: InquiryStatus;
    createdAt: string;
  }[];
}

type ChartMetric = "users" | "walls" | "inquiries" | "activeEditors";

const CHART_METRICS: { key: ChartMetric; label: string }[] = [
  { key: "activeEditors", label: "활성 편집" },
  { key: "users", label: "가입" },
  { key: "walls", label: "새 벽" },
  { key: "inquiries", label: "문의" },
];

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function formatDayLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function WeekChart({
  series,
  metric,
}: {
  series: DaySeries[];
  metric: ChartMetric;
}) {
  const values = series.map((d) => d[metric]);
  const max = Math.max(1, ...values);

  return (
    <div className="flex h-36 items-end gap-2">
      {series.map((day, i) => {
        const v = values[i] ?? 0;
        const pct = Math.round((v / max) * 100);
        return (
          <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-muted">{v}</span>
            <div className="flex h-24 w-full items-end justify-center">
              <div
                className="w-full max-w-8 rounded-t-md bg-accent-dark/80"
                style={{ height: `${pct}%`, minHeight: v > 0 ? 4 : 0 }}
                title={`${day.date}: ${v}`}
              />
            </div>
            <span className="text-[10px] text-muted">{formatDayLabel(day.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

const TONE_CLASS: Record<TodoItem["tone"], string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  neutral: "border-foreground/10 bg-surface text-foreground",
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("activeEditors");
  const [discordConfigured, setDiscordConfigured] = useState<boolean | null>(null);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordMessage, setDiscordMessage] = useState<string | null>(null);

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
    authFetch("/api/admin/discord-test")
      .then(async (res) => (res.ok ? ((await res.json()) as { configured?: boolean }) : null))
      .then((data) => setDiscordConfigured(!!data?.configured))
      .catch(() => setDiscordConfigured(false));
  }, [loadStats]);

  const sendDiscordTest = async (sampleError = false) => {
    setDiscordBusy(true);
    setDiscordMessage(null);
    try {
      const res = await authFetch("/api/admin/discord-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleError ? { sampleError: true } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setDiscordMessage(body.error || "전송에 실패했어요");
        return;
      }
      setDiscordMessage(
        sampleError
          ? "Discord로 오류 알림 샘플을 보냈어요"
          : "Discord로 테스트 알림을 보냈어요",
      );
    } catch {
      setDiscordMessage("전송에 실패했어요");
    } finally {
      setDiscordBusy(false);
    }
  };

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!stats) {
    return <p className="text-sm text-muted">불러오는 중...</p>;
  }

  const series = stats.series ?? [];
  const todos = stats.todos ?? [];
  const dau = stats.dau;

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h2 className="text-xl font-bold">대시보드</h2>
        <p className="text-sm text-muted">매일 볼 지표 · 오늘 할 일</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">오늘 할 일</h3>
        {todos.length === 0 ? (
          <p className="rounded-2xl border border-foreground/8 bg-surface px-4 py-3 text-sm text-muted">
            처리할 항목이 없어요
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {todos.map((todo) => (
              <li key={todo.id}>
                <Link
                  href={todo.href}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition hover:opacity-90 ${TONE_CLASS[todo.tone]}`}
                >
                  <span className="text-sm font-medium">{todo.label}</span>
                  <span className="text-lg font-bold tabular-nums">{todo.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">활성 유저 (DAU)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="오늘 편집 활성" value={dau?.editorsToday ?? 0} />
          <StatCard label="7일 편집 활성" value={dau?.editorsWeek ?? 0} />
          <StatCard
            label="오늘 로그인"
            value={dau?.loginToday == null ? "—" : dau.loginToday}
          />
          <StatCard
            label="7일 로그인"
            value={dau?.loginWeek == null ? "—" : dau.loginWeek}
          />
        </div>
        {dau?.loginToday == null && (
          <p className="text-xs text-muted">
            로그인 DAU는 SUPABASE_SERVICE_ROLE_KEY가 있을 때 Auth last_sign_in 기준으로
            집계됩니다. 편집 활성은 벽을 수정한 유저 수입니다.
          </p>
        )}
      </section>

      {series.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-foreground/8 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">최근 7일</h3>
            <div className="flex flex-wrap gap-1">
              {CHART_METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setChartMetric(m.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    chartMetric === m.key
                      ? "bg-foreground text-background"
                      : "bg-foreground/5 text-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <WeekChart series={series} metric={chartMetric} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="오늘 가입" value={stats.today.users} />
            <StatCard label="오늘 새 벽" value={stats.today.walls} />
            <StatCard label="오늘 문의·신고" value={stats.today.inquiries} />
            <StatCard label="7일 가입" value={stats.last7Days.users} />
            <StatCard label="7일 새 벽" value={stats.last7Days.walls} />
            <StatCard label="7일 문의·신고" value={stats.last7Days.inquiries} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-foreground/8 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Discord 알림</h3>
            <p className="mt-0.5 text-xs text-muted">
              {discordConfigured == null
                ? "설정 확인 중…"
                : discordConfigured
                  ? "웹후크 연결됨 · 가입/신고/제한/제휴 + 앱 오류(한국어 요약)"
                  : "DISCORD_WEBHOOK_URL 미설정 (Vercel env 확인)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={discordBusy || discordConfigured === false}
              onClick={() => void sendDiscordTest(false)}
              className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
            >
              {discordBusy ? "보내는 중…" : "테스트 알림"}
            </button>
            <button
              type="button"
              disabled={discordBusy || discordConfigured === false}
              onClick={() => void sendDiscordTest(true)}
              className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
            >
              오류 샘플
            </button>
          </div>
        </div>
        {discordMessage && (
          <p className="mt-3 text-xs text-muted">{discordMessage}</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">인프라</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
            <p className="text-xs text-muted">Rate limit</p>
            <p className="mt-1 text-lg font-bold">
              {stats.rateLimitBackend === "upstash" ? "Upstash Redis" : "인메모리 (비권장)"}
            </p>
            {stats.rateLimitBackend !== "upstash" && (
              <p className="mt-1 text-xs text-amber-700">
                프로덕션에서는 UPSTASH_REDIS_REST_* 를 설정하세요
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
            <p className="text-xs text-muted">헬스체크</p>
            <p className="mt-1 font-mono text-sm">GET /api/health</p>
            <p className="mt-1 text-xs text-muted">PM2·업타임 모니터용</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">약관 동의 ({stats.consent.version})</h3>
          <Link href="/admin/users" className="text-xs font-medium text-accent-dark">
            유저 목록
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="동의 완료" value={stats.consent.ok} />
          <StatCard label="미동의" value={stats.consent.missing} />
          <StatCard label="구버전" value={stats.consent.stale} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="가입자" value={stats.users} />
        <StatCard label="벽" value={stats.walls} />
        <StatCard label="공동 벽" value={stats.sharedWalls} />
        <StatCard label="owner 없는 벽" value={stats.orphanWalls} />
        <StatCard label="좋아요" value={stats.likes} />
        <StatCard label="방명록" value={stats.guestbook} />
        <StatCard label="플러스 유저" value={stats.premiumUsers ?? 0} />
        <StatCard label="미처리 문의" value={stats.openInquiries} />
        <Link href="/admin/inquiries?category=abuse&status=open" className="block">
          <div className="rounded-2xl border border-foreground/8 bg-surface p-4 transition hover:border-foreground/20">
            <p className="text-xs text-muted">미처리 신고</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {(stats.openAbuseCount ?? 0).toLocaleString()}
            </p>
          </div>
        </Link>
        <Link href="/admin/inquiries?category=business" className="block">
          <div className="rounded-2xl border border-foreground/8 bg-surface p-4 transition hover:border-foreground/20">
            <p className="text-xs text-muted">제휴 파이프라인</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {(stats.openBusinessInquiries ?? 0).toLocaleString()}
            </p>
          </div>
        </Link>
        {stats.importWeek?.available ? (
          <>
            <StatCard label="QR 성공(7일)" value={stats.importWeek.ok ?? 0} />
            <StatCard label="QR 실패(7일)" value={stats.importWeek.fail ?? 0} />
          </>
        ) : (
          <div className="col-span-2 rounded-2xl border border-dashed border-foreground/15 bg-surface p-4">
            <p className="text-xs text-muted">QR import 집계</p>
            <p className="mt-1 text-sm text-muted">
              ops-hardening-migration.sql 실행 후 표시됩니다
            </p>
          </div>
        )}
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
