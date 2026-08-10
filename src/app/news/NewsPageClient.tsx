"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import type { BoardItem } from "@/types/board";
import { BoardAnnouncementCard, BoardEventCard } from "@/components/board/BoardFeed";
import { markBoardSeen } from "@/lib/board-seen";

type Tab = "all" | "announcement" | "event";

export default function NewsPageClient() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/board")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: BoardItem[] }) => {
        if (cancelled) return;
        const next = Array.isArray(data.items) ? data.items : [];
        setItems(next);
        markBoardSeen(next);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((item) => item.kind === tab);
  }, [items, tab]);

  return (
    <AppShell tone="hub">
      <div className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-16 pt-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-[12px] font-medium text-muted hover:text-foreground">
              ← 홈
            </Link>
            <h1 className="mt-1 text-xl font-bold text-foreground">공지·이벤트</h1>
          </div>
        </div>

        <div className="mb-5 flex gap-1.5">
          {(
            [
              { id: "all", label: "전체" },
              { id: "announcement", label: "공지" },
              { id: "event", label: "이벤트" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                tab === option.id
                  ? "bg-foreground text-background"
                  : "bg-foreground/[0.05] text-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">아직 게시물이 없어요</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item) =>
              item.kind === "announcement" ? (
                <div key={`a-${item.id}`} className="sm:col-span-2">
                  <BoardAnnouncementCard item={item} />
                </div>
              ) : (
                <BoardEventCard
                  key={`e-${item.id}`}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === item.id ? null : item.id))
                  }
                />
              ),
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
