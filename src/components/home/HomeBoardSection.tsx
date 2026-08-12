"use client";

import Link from "next/link";
import { Jua } from "next/font/google";
import { BoardFeed } from "@/components/board/BoardFeed";
import type { BoardItem } from "@/types/board";

const displayFont = Jua({
  subsets: ["latin"],
  weight: "400",
});

const PREVIEW_LIMIT = 3;

interface HomeBoardSectionProps {
  items: BoardItem[];
  /** Desktop uses slightly larger section title */
  titleSize?: "mobile" | "desktop";
}

export default function HomeBoardSection({ items, titleSize = "mobile" }: HomeBoardSectionProps) {
  const preview = items.slice(0, PREVIEW_LIMIT);

  const titleClass =
    titleSize === "desktop"
      ? `${displayFont.className} text-xl text-foreground`
      : `${displayFont.className} text-lg text-foreground`;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={titleClass}>공지·이벤트</h2>
        <Link href="/news" className="text-[13px] font-semibold text-foreground">
          전체보기 →
        </Link>
      </div>
      {preview.length === 0 ? (
        <Link
          href="/news"
          className="block rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-4 text-sm text-muted transition active:bg-foreground/[0.05]"
        >
          아직 공지가 없어요. 전체 보기에서 이벤트를 확인해 보세요
        </Link>
      ) : (
        <BoardFeed items={preview} compact />
      )}
    </section>
  );
}
