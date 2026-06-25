"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/api-fetch";

const NAV = [
  { href: "/admin", label: "대시보드", exact: true },
  { href: "/admin/inquiries", label: "문의·신고" },
  { href: "/admin/walls", label: "벽 관리" },
  { href: "/admin/users", label: "유저" },
  { href: "/admin/announcements", label: "공지" },
  { href: "/admin/operations", label: "기능 설정" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hasServiceRole, setHasServiceRole] = useState(true);

  useEffect(() => {
    authFetch("/api/admin/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { hasServiceRole?: boolean } | null) => {
        setHasServiceRole(data?.hasServiceRole !== false);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-foreground/10 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">PhotoWall</p>
            <h1 className="text-lg font-bold">관리자</h1>
          </div>
          <Link
            href="/settings"
            className="rounded-full bg-foreground/5 px-4 py-2 text-xs font-medium text-foreground ring-1 ring-foreground/10 transition hover:bg-foreground/10"
          >
            설정으로
          </Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-foreground text-background"
                    : "bg-foreground/5 text-foreground hover:bg-foreground/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {!hasServiceRole && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          삭제·초기화가 안 되면 Supabase에서{" "}
          <code className="rounded bg-amber-100 px-1">admin-rls-migration.sql</code> 실행 후{" "}
          <code className="rounded bg-amber-100 px-1">
            insert into app_admins (user_id) values (&apos;본인-UUID&apos;);
          </code>
          를 실행하세요.
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
