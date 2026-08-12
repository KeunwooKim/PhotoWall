"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import AuthButton from "@/components/auth/AuthButton";
import InquiryForm from "@/components/settings/InquiryForm";
import SupportFaq from "@/components/support/SupportFaq";
import { useAuth } from "@/hooks/useAuth";

export type SupportTab = "faq" | "inquiry";

function parseTab(value: string | null): SupportTab {
  return value === "inquiry" ? "inquiry" : "faq";
}

const TABS: { id: SupportTab; label: string }[] = [
  { id: "faq", label: "자주 묻는 질문" },
  { id: "inquiry", label: "문의하기" },
];

export default function SupportPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const tab = parseTab(searchParams.get("tab"));

  const setTab = useCallback(
    (next: SupportTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "faq") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <AppShell tone="hub">
      <div className="mx-auto w-full max-w-lg space-y-8 pb-8 pt-1 lg:max-w-3xl">
        <header className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted">도움말</p>
          <h1 className="text-2xl font-bold tracking-tight">고객센터</h1>
          <p className="text-sm leading-relaxed text-muted">
            자주 묻는 질문을 먼저 확인해 보세요. 해결되지 않으면 문의를 남겨 주세요.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="고객센터"
          className="flex gap-6 border-b border-foreground/10"
        >
          {TABS.map((option) => {
            const active = tab === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(option.id)}
                className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {tab === "faq" ? (
          <SupportFaq onAskInquiry={() => setTab("inquiry")} />
        ) : (
          <section className="space-y-3">
            {!user && !isLoading ? (
              <div className="space-y-3 rounded-2xl bg-foreground/[0.03] px-4 py-5">
                <p className="text-sm text-muted">로그인하면 문의를 보낼 수 있어요</p>
                <AuthButton />
              </div>
            ) : (
              <div className="rounded-2xl bg-foreground/[0.03] px-4 py-4">
                <InquiryForm />
              </div>
            )}
          </section>
        )}

        <Link href="/settings" className="block text-center text-sm text-muted underline">
          설정으로
        </Link>
      </div>
    </AppShell>
  );
}
