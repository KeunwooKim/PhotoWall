import { NextResponse, type NextRequest } from "next/server";
import { mapHouseBanner } from "@/lib/house-banners-server";
import { adminDbErrorResponse, requireAdminRoute } from "@/lib/admin/require-admin-route";
import type { HouseBannerAudience, HouseBannerPlacement } from "@/types/house-banner";

const PLACEMENTS: HouseBannerPlacement[] = ["all", "home", "settings", "walls"];
const AUDIENCES: HouseBannerAudience[] = ["free", "all"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  let body: {
    title?: string;
    message?: string;
    imageUrl?: string | null;
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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.message !== undefined) patch.message = body.message.trim();
  if (body.imageUrl !== undefined) patch.image_url = body.imageUrl?.trim() || null;
  if (body.href !== undefined) patch.href = body.href?.trim() || null;
  if (body.ctaLabel !== undefined) patch.cta_label = body.ctaLabel.trim() || "자세히";
  if (body.placement !== undefined && PLACEMENTS.includes(body.placement)) {
    patch.placement = body.placement;
  }
  if (body.audience !== undefined && AUDIENCES.includes(body.audience)) {
    patch.audience = body.audience;
  }
  if (body.active !== undefined) patch.active = body.active;
  if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
  if (body.startsAt !== undefined) patch.starts_at = body.startsAt;
  if (body.endsAt !== undefined) patch.ends_at = body.endsAt;

  const { data, error } = await admin
    .from("house_banners")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "광고 배너 수정 실패");
  }

  return applyCookies(NextResponse.json(mapHouseBanner(data)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { error } = await admin.from("house_banners").delete().eq("id", id);

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "광고 배너 삭제 실패");
  }

  return applyCookies(NextResponse.json({ ok: true }));
}
