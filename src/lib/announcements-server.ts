import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Announcement,
  AnnouncementSeverity,
  AnnouncementTarget,
  PublicAnnouncement,
} from "@/types/announcement";
import { getSupabaseServer } from "@/lib/supabase/walls";

function mapAnnouncement(row: {
  id: string;
  title: string;
  message: string;
  severity: string;
  target: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}): Announcement {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    severity: row.severity as AnnouncementSeverity,
    target: row.target as AnnouncementTarget,
    active: row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isWithinSchedule(
  row: { starts_at: string | null; ends_at: string | null },
  now = Date.now(),
): boolean {
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false;
  return true;
}

function matchesTarget(target: string, pageTarget: AnnouncementTarget): boolean {
  return target === "all" || target === pageTarget;
}

export async function fetchActiveAnnouncements(
  pageTarget: AnnouncementTarget,
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<PublicAnnouncement[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, message, severity, target, starts_at, ends_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row) => isWithinSchedule(row) && matchesTarget(row.target, pageTarget))
    .map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      severity: row.severity as AnnouncementSeverity,
    }));
}

export async function fetchAllAnnouncements(
  supabase: SupabaseClient,
): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapAnnouncement);
}

export { mapAnnouncement };
