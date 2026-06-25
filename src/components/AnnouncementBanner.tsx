"use client";

import { useEffect, useState } from "react";
import type { AnnouncementTarget, PublicAnnouncement } from "@/types/announcement";

const DISMISS_KEY = "photowall_dismissed_announcements";

function getDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function dismissId(id: string) {
  const dismissed = getDismissedIds();
  dismissed.add(id);
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
}

const SEVERITY_STYLES = {
  info: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100",
  critical:
    "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100",
} as const;

interface AnnouncementBannerProps {
  target: AnnouncementTarget;
  compact?: boolean;
}

export default function AnnouncementBanner({ target, compact = false }: AnnouncementBannerProps) {
  const [items, setItems] = useState<PublicAnnouncement[]>([]);

  useEffect(() => {
    fetch(`/api/announcements?target=${target}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PublicAnnouncement[]) => {
        const dismissed = getDismissedIds();
        setItems(data.filter((item) => !dismissed.has(item.id)));
      })
      .catch(() => {});
  }, [target]);

  if (items.length === 0) return null;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`relative rounded-xl border px-3 py-2 ${compact ? "text-xs" : "text-sm"} ${SEVERITY_STYLES[item.severity]}`}
          role="status"
        >
          <button
            type="button"
            onClick={() => {
              dismissId(item.id);
              setItems((prev) => prev.filter((a) => a.id !== item.id));
            }}
            className="absolute right-2 top-2 rounded-full p-1 text-current/60 hover:bg-black/5 hover:text-current"
            aria-label="닫기"
          >
            ✕
          </button>
          {item.title ? (
            <p className={`pr-6 font-semibold ${compact ? "text-xs" : "text-sm"}`}>{item.title}</p>
          ) : null}
          <p className={`pr-6 ${item.title ? "mt-0.5" : ""} ${compact ? "text-[11px] leading-snug" : "text-sm leading-relaxed"}`}>
            {item.message}
          </p>
        </div>
      ))}
    </div>
  );
}
