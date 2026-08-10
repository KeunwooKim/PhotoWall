import { jsonWithPublicCache } from "@/lib/api-cache-headers";
import { fetchActiveHouseBanners } from "@/lib/house-banners-server";
import type { HouseBannerPlacement } from "@/types/house-banner";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placementParam = searchParams.get("placement");
  const placement: HouseBannerPlacement =
    placementParam === "home" ||
    placementParam === "settings" ||
    placementParam === "walls"
      ? placementParam
      : "home";

  const isPremium = searchParams.get("plan") === "premium";

  const banners = await fetchActiveHouseBanners(placement, { isPremium });
  return jsonWithPublicCache(banners);
}
