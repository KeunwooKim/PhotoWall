import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  HouseBanner,
  HouseBannerAudience,
  HouseBannerPlacement,
  PublicHouseBanner,
} from "@/types/house-banner";
import { getSupabaseServer } from "@/lib/supabase/walls";
import { toPublicSupabaseUrl } from "@/lib/supabase/env";

function mapHouseBanner(row: {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  href: string | null;
  cta_label: string;
  placement: string;
  audience: string;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}): HouseBanner {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url ? toPublicSupabaseUrl(row.image_url) : null,
    href: row.href,
    ctaLabel: row.cta_label,
    placement: row.placement as HouseBannerPlacement,
    audience: row.audience as HouseBannerAudience,
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

function matchesPlacement(placement: string, page: HouseBannerPlacement): boolean {
  return placement === "all" || placement === page;
}

export async function fetchActiveHouseBanners(
  pagePlacement: HouseBannerPlacement,
  options: { isPremium?: boolean } = {},
  supabase: SupabaseClient | null = getSupabaseServer(),
): Promise<PublicHouseBanner[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("house_banners")
    .select(
      "id, title, image_url, href, placement, audience, starts_at, ends_at, sort_order, created_at",
    )
    .eq("active", true)
    .not("image_url", "is", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const isPremium = !!options.isPremium;

  return data
    .filter((row) => {
      if (!row.image_url?.trim()) return false;
      if (!isWithinSchedule(row) || !matchesPlacement(row.placement, pagePlacement)) return false;
      if (row.audience === "free" && isPremium) return false;
      return true;
    })
    .map((row) => ({
      id: row.id,
      title: row.title || "광고",
      imageUrl: toPublicSupabaseUrl(row.image_url!),
      href: row.href,
    }));
}

export async function fetchAllHouseBanners(
  supabase: SupabaseClient,
): Promise<HouseBanner[]> {
  const { data, error } = await supabase
    .from("house_banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapHouseBanner);
}

export { mapHouseBanner };
