import { NextResponse, type NextRequest } from "next/server";
import { fetchAllHouseBanners, mapHouseBanner } from "@/lib/house-banners-server";
import { adminDbErrorResponse, requireAdminRoute } from "@/lib/admin/require-admin-route";
import type { HouseBannerAudience, HouseBannerPlacement } from "@/types/house-banner";

const PLACEMENTS: HouseBannerPlacement[] = ["all", "home", "settings", "walls"];
const AUDIENCES: HouseBannerAudience[] = ["free", "all"];

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const banners = await fetchAllHouseBanners(admin);
  return applyCookies(NextResponse.json(banners));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;

  let body: {
    title?: string;
    message?: string;
    imageUrl?: string;
    href?: string | null;
    ctaLabel?: string;
    placement?: HouseBannerPlacement;
    audience?: HouseBannerAudience;
    active?: boolean;
    sortOrder?: number;
    startsAt?: string | null;
    endsAt?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  if (!body.imageUrl?.trim()) {
    return applyCookies(NextResponse.json({ error: "imageUrl required" }, { status: 400 }));
  }

  const placement = body.placement && PLACEMENTS.includes(body.placement) ? body.placement : "all";
  const audience = body.audience && AUDIENCES.includes(body.audience) ? body.audience : "free";
  const href = body.href?.trim() || null;

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("house_banners")
    .insert({
      title: body.title?.trim() ?? "",
      message: body.message?.trim() ?? "",
      image_url: body.imageUrl.trim(),
      href,
      cta_label: body.ctaLabel?.trim() || "자세히",
      placement,
      audience,
      active: body.active ?? true,
      sort_order: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      starts_at: body.startsAt ?? null,
      ends_at: body.endsAt ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "광고 배너 등록 실패");
  }

  return applyCookies(NextResponse.json(mapHouseBanner(data)));
}
