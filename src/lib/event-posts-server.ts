import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventPost, PublicEventPost } from "@/types/event-post";
import { getSupabaseServer } from "@/lib/supabase/walls";
import { toPublicSupabaseUrl } from "@/lib/supabase/env";

function mapEventPost(row: {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  href: string | null;
  cta_label: string;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}): EventPost {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url ? toPublicSupabaseUrl(row.image_url) : null,
    href: row.href,
    ctaLabel: row.cta_label,
    active: row.active,
    sortOrder: row.sort_order,
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

export async function fetchActiveEventPosts(
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<PublicEventPost[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("event_posts")
    .select(
      "id, title, body, image_url, href, cta_label, starts_at, ends_at, sort_order, created_at",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row) => isWithinSchedule(row))
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      imageUrl: row.image_url ? toPublicSupabaseUrl(row.image_url) : null,
      href: row.href,
      ctaLabel: row.cta_label || "자세히",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
    }));
}

export async function fetchAllEventPosts(
  supabase: SupabaseClient,
): Promise<EventPost[]> {
  const { data, error } = await supabase
    .from("event_posts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapEventPost);
}

export { mapEventPost };
