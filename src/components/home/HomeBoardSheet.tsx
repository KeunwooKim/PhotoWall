"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardItem } from "@/types/board";
import { BoardFeed, BoardSeeAllLink } from "@/components/board/BoardFeed";
import { markBoardSeen } from "@/lib/board-seen";

type Tab = "all" | "announcement" | "event";

interface HomeBoardSheetProps {
  open: boolean;
  onClose: () => void;
  items: BoardItem[];
}

export default function HomeBoardSheet({ open, onClose, items }: HomeBoardSheetProps) {
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (!open) return;
    markBoardSeen(items);
  }, [open, items]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((item) => item.kind === tab);
  }, [items, tab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal aria-label="공지·이벤트">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-hidden rounded-t-3xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <h2 className="text-base font-bold text-foreground">공지·이벤트</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-foreground/[0.06] px-3 py-1.5 text-xs font-medium text-muted"
          >
            닫기
          </button>
        </div>

        <div className="flex gap-1.5 border-b border-foreground/8 px-4 py-2.5">
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
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === option.id
                  ? "bg-foreground text-background"
                  : "bg-foreground/[0.05] text-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="max-h-[calc(78dvh-7.5rem)] space-y-3 overflow-y-auto px-4 py-4">
          <BoardFeed items={filtered} emptyLabel="아직 게시물이 없어요" compact />
          <BoardSeeAllLink onClick={onClose} />
        </div>
      </div>
    </div>
  );
}
