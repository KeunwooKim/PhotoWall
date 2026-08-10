"use client";

import Link from "next/link";
import type { BoardItem } from "@/types/board";

const SEVERITY_STYLES = {
  info: "border-sky-200/80 bg-sky-50 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-100",
  warning:
    "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100",
  critical:
    "border-rose-200/80 bg-rose-50 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100",
} as const;

function formatRange(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt && !endsAt) return null;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  if (startsAt) return `${fmt(startsAt)}~`;
  return `~${fmt(endsAt!)}`;
}

export function BoardAnnouncementCard({ item }: { item: Extract<BoardItem, { kind: "announcement" }> }) {
  return (
    <article
      className={`rounded-2xl border px-3.5 py-3 ${SEVERITY_STYLES[item.severity]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">공지</p>
      {item.title ? <h3 className="mt-1 text-sm font-semibold">{item.title}</h3> : null}
      <p className={`text-[13px] leading-relaxed ${item.title ? "mt-1" : "mt-0.5"}`}>
        {item.message}
      </p>
    </article>
  );
}

export function BoardEventCard({
  item,
  expanded = false,
  onToggle,
}: {
  item: Extract<BoardItem, { kind: "event" }>;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const range = formatRange(item.startsAt, item.endsAt);
  const body =
    expanded || !onToggle
      ? item.body
      : item.body.length > 120
        ? `${item.body.slice(0, 120)}…`
        : item.body;

  return (
    <article className="overflow-hidden rounded-2xl border border-foreground/10 bg-background">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />
      ) : null}
      <div className="space-y-2 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">이벤트</p>
          {range ? <p className="text-[10px] text-muted">{range}</p> : null}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{item.title || "이벤트"}</h3>
        {body ? (
          <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {body}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onToggle && item.body.length > 120 ? (
            <button
              type="button"
              onClick={onToggle}
              className="text-[12px] font-semibold text-foreground"
            >
              {expanded ? "접기" : "더 보기"}
            </button>
          ) : null}
          {item.href ? (
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
              className="rounded-full bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background"
            >
              {item.ctaLabel || "자세히"}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function BoardFeed({
  items,
  emptyLabel = "게시물이 없어요",
  compact = false,
}: {
  items: BoardItem[];
  emptyLabel?: string;
  compact?: boolean;
}) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      {items.map((item) =>
        item.kind === "announcement" ? (
          <BoardAnnouncementCard key={`a-${item.id}`} item={item} />
        ) : (
          <BoardEventCard key={`e-${item.id}`} item={item} />
        ),
      )}
    </div>
  );
}

export function BoardSeeAllLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/news"
      onClick={onClick}
      className="block rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-center text-[13px] font-semibold text-foreground"
    >
      전체 보기
    </Link>
  );
}
