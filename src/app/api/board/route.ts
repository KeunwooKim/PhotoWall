import { NextResponse } from "next/server";
import { fetchActiveAnnouncements } from "@/lib/announcements-server";
import { fetchActiveEventPosts } from "@/lib/event-posts-server";
import type { BoardItem } from "@/types/board";

export async function GET() {
  const [announcements, events] = await Promise.all([
    fetchActiveAnnouncements("home"),
    fetchActiveEventPosts(),
  ]);

  const items: BoardItem[] = [
    ...announcements.map(
      (item): BoardItem => ({
        kind: "announcement",
        id: item.id,
        title: item.title,
        message: item.message,
        severity: item.severity,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        createdAt: item.createdAt,
      }),
    ),
    ...events.map(
      (item): BoardItem => ({
        kind: "event",
        id: item.id,
        title: item.title,
        body: item.body,
        imageUrl: item.imageUrl,
        href: item.href,
        ctaLabel: item.ctaLabel,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        createdAt: item.createdAt,
      }),
    ),
  ];

  items.sort((a, b) => {
    const aScore = scoreItem(a);
    const bScore = scoreItem(b);
    if (aScore !== bScore) return bScore - aScore;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  return NextResponse.json({ items });
}

function scoreItem(item: BoardItem): number {
  const now = Date.now();
  if (item.kind === "event") {
    const started = !item.startsAt || new Date(item.startsAt).getTime() <= now;
    const notEnded = !item.endsAt || new Date(item.endsAt).getTime() > now;
    if (started && notEnded) return 3;
    return 1;
  }
  return 2;
}
