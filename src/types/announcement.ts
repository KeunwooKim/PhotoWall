export type AnnouncementSeverity = "info" | "warning" | "critical";
export type AnnouncementTarget = "all" | "home" | "editor";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  target: AnnouncementTarget;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
}
