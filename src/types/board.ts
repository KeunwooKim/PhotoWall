import type { AnnouncementSeverity } from "@/types/announcement";

export type BoardItem =
  | {
      kind: "announcement";
      id: string;
      title: string;
      message: string;
      severity: AnnouncementSeverity;
      startsAt: string | null;
      endsAt: string | null;
      createdAt: string;
    }
  | {
      kind: "event";
      id: string;
      title: string;
      body: string;
      imageUrl: string | null;
      href: string | null;
      ctaLabel: string;
      startsAt: string | null;
      endsAt: string | null;
      createdAt: string;
    };
