"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { authFetch } from "@/lib/auth/api-fetch";
import { PLAN_UI_NAME, type UserPlan } from "@/lib/wall-quotas";
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type InquiryCategory,
  type InquiryStatus,
} from "@/types/inquiry";

interface UserDetail {
  id: string;
  displayName: string;
  friendCode: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  restrictedAt: string | null;
  restrictReason: string | null;
  legalConsentedAt: string | null;
  legalVersion: string | null;
  plan: UserPlan;
  planExpiresAt: string | null;
  planUpdatedAt: string | null;
  allowWallVisits: boolean;
}

interface UserWall {
  id: string;
  title: string | null;
  themeId: string;
  isShared: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MemberWall {
  wallId: string;
  role: string;
  joinedAt: string;
  title: string | null;
  isShared: boolean;
  isHidden: boolean;
  ownerId: string | null;
}

interface UserInquiry {
  id: string;
  category: InquiryCategory;
  subject: string;
  status: InquiryStatus;
  relatedWallId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const GRANT_OPTIONS: { days: number | null; label: string }[] = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
  { days: 365, label: "1년" },
  { days: null, label: "무기한" },
];

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [user, setUser] = useState<UserDetail | null>(null);
  const [walls, setWalls] = useState<UserWall[]>([]);
  const [memberWalls, setMemberWalls] = useState<MemberWall[]>([]);
  const [inquiries, setInquiries] = useState<UserInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/users/${id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error ?? "불러오기 실패");
      }
      const body = data as {
        user: UserDetail;
        walls: UserWall[];
        memberWalls: MemberWall[];
        inquiries: UserInquiry[];
      };
      setUser(body.user);
      setWalls(body.walls ?? []);
      setMemberWalls(body.memberWalls ?? []);
      setInquiries(body.inquiries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "유저를 불러오지 못했어요");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRestricted = async (restricted: boolean) => {
    if (!user) return;
    if (
      restricted &&
      !confirm(`${user.displayName} 계정의 공유·응원·방명록을 제한할까요?`)
    ) {
      return;
    }
    setActing(true);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restricted,
          reason: restricted ? "관리자 제한" : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as {
        restrictedAt: string | null;
        restrictReason: string | null;
      };
      setUser((prev) =>
        prev
          ? {
              ...prev,
              restrictedAt: updated.restrictedAt,
              restrictReason: updated.restrictReason,
            }
          : prev,
      );
      setMessage(restricted ? "계정을 제한했어요" : "제한을 해제했어요");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("처리에 실패했어요");
    } finally {
      setActing(false);
    }
  };

  const grantPlan = async (days: number | null) => {
    if (!user) return;
    const label =
      days == null
        ? `무기한 ${PLAN_UI_NAME.premium}`
        : `${days}일 ${PLAN_UI_NAME.premium}`;
    if (!confirm(`${user.displayName}에게 ${label}을(를) 부여할까요?`)) return;
    setActing(true);
    try {
      const body =
        days == null
          ? { plan: "premium" as const, planExpiresAt: null }
          : { plan: "premium" as const, planDurationDays: days };
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as {
        plan: UserPlan;
        planExpiresAt: string | null;
      };
      setUser((prev) =>
        prev
          ? {
              ...prev,
              plan: updated.plan,
              planExpiresAt: updated.planExpiresAt,
              planUpdatedAt: new Date().toISOString(),
            }
          : prev,
      );
      const until = updated.planExpiresAt
        ? `${new Date(updated.planExpiresAt).toLocaleDateString("ko-KR")}까지`
        : "무기한";
      setMessage(`${PLAN_UI_NAME[updated.plan]} 부여 · ${until}`);
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("플랜 변경에 실패했어요");
    } finally {
      setActing(false);
    }
  };

  const revokePlan = async () => {
    if (!user) return;
    if (!confirm(`${user.displayName}을(를) ${PLAN_UI_NAME.free}(으)로 내릴까요?`)) {
      return;
    }
    setActing(true);
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as {
        plan: UserPlan;
        planExpiresAt: string | null;
      };
      setUser((prev) =>
        prev
          ? {
              ...prev,
              plan: updated.plan,
              planExpiresAt: updated.planExpiresAt,
              planUpdatedAt: new Date().toISOString(),
            }
          : prev,
      );
      setMessage(`${PLAN_UI_NAME[updated.plan]}로 변경했어요`);
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("플랜 변경에 실패했어요");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted">불러오는 중...</p>;
  }
  if (error || !user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error ?? "유저가 없어요"}</p>
        <Link href="/admin/users" className="text-sm text-accent-dark underline">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Link href="/admin/users" className="text-xs text-muted underline">
          ← 유저 목록
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
              {user.displayName}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  user.plan === "premium"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-foreground/5 text-muted"
                }`}
              >
                {PLAN_UI_NAME[user.plan]}
              </span>
              {user.restrictedAt && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                  제한중
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted">
              @{user.friendCode} · 가입{" "}
              {new Date(user.createdAt).toLocaleString("ko-KR")}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">{user.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.plan === "premium" && (
              <button
                type="button"
                disabled={acting}
                onClick={() => void revokePlan()}
                className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                기본으로
              </button>
            )}
            <button
              type="button"
              disabled={acting}
              onClick={() => void setRestricted(!user.restrictedAt)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                user.restrictedAt
                  ? "bg-foreground/5"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {user.restrictedAt ? "제한 해제" : "계정 제한"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-foreground/8 bg-surface p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs text-muted">플랜</p>
          <p className="mt-1 text-sm font-medium">{PLAN_UI_NAME[user.plan]}</p>
          <p className="mt-0.5 text-xs text-muted">
            {user.plan === "premium"
              ? user.planExpiresAt
                ? `${new Date(user.planExpiresAt).toLocaleDateString("ko-KR")}까지`
                : "무기한"
              : "—"}
            {user.planUpdatedAt
              ? ` · 변경 ${new Date(user.planUpdatedAt).toLocaleDateString("ko-KR")}`
              : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {GRANT_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                disabled={acting}
                onClick={() => void grantPlan(opt.days)}
                className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900 disabled:opacity-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
          <p className="text-xs text-muted">제한</p>
          <p className="mt-1 text-sm font-medium">
            {user.restrictedAt ? "제한 중" : "정상"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {user.restrictedAt
              ? `${new Date(user.restrictedAt).toLocaleString("ko-KR")}${
                  user.restrictReason ? ` · ${user.restrictReason}` : ""
                }`
              : "이력 테이블 없음 · 현재 상태만 표시"}
          </p>
        </div>
        <div className="rounded-2xl border border-foreground/8 bg-surface p-4">
          <p className="text-xs text-muted">약관</p>
          <p className="mt-1 text-sm font-medium">
            {user.legalConsentedAt
              ? user.legalVersion ?? "동의"
              : "미동의"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {user.legalConsentedAt
              ? new Date(user.legalConsentedAt).toLocaleString("ko-KR")
              : "—"}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">소유 벽 ({walls.length})</h3>
        {walls.length === 0 ? (
          <p className="rounded-2xl border border-foreground/8 bg-surface p-4 text-sm text-muted">
            소유한 벽이 없어요
          </p>
        ) : (
          <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
            {walls.map((wall) => (
              <li
                key={wall.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {wall.title || "(제목 없음)"}
                    {wall.isShared && (
                      <span className="ml-2 text-[10px] text-muted">공동</span>
                    )}
                    {wall.isHidden && (
                      <span className="ml-2 text-[10px] text-red-700">숨김</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(wall.updatedAt).toLocaleString("ko-KR")} 수정
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <Link
                    href={`/wall/${wall.id}`}
                    target="_blank"
                    className="text-accent-dark underline"
                  >
                    열기
                  </Link>
                  <Link
                    href={`/admin/walls?q=${wall.id}`}
                    className="text-accent-dark underline"
                  >
                    관리
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {memberWalls.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">멤버 벽 ({memberWalls.length})</h3>
          <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
            {memberWalls.map((m) => (
              <li
                key={`${m.wallId}-${m.joinedAt}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.title || m.wallId.slice(0, 8)}
                    <span className="ml-2 text-[10px] text-muted">{m.role}</span>
                  </p>
                </div>
                <Link
                  href={`/admin/walls?q=${m.wallId}`}
                  className="text-xs text-accent-dark underline"
                >
                  관리
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">문의·신고 ({inquiries.length})</h3>
        {inquiries.length === 0 ? (
          <p className="rounded-2xl border border-foreground/8 bg-surface p-4 text-sm text-muted">
            문의·신고가 없어요
          </p>
        ) : (
          <ul className="divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/8 bg-surface">
            {inquiries.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/inquiries?id=${item.id}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-foreground/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.subject}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {INQUIRY_CATEGORY_LABELS[item.category] ?? item.category} ·{" "}
                      {new Date(item.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium">
                    {INQUIRY_STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background">
          {message}
        </p>
      )}
    </div>
  );
}
