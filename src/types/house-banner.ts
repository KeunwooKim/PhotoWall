export type HouseBannerPlacement = "all" | "home" | "settings" | "walls";
export type HouseBannerAudience = "free" | "all";

/** Native banner creative size (width × height). */
export const HOUSE_BANNER_WIDTH = 2000;
export const HOUSE_BANNER_HEIGHT = 360;
export const HOUSE_BANNER_ASPECT_RATIO = `${HOUSE_BANNER_WIDTH} / ${HOUSE_BANNER_HEIGHT}`;

export const HOUSE_BANNERS_BUCKET = "house-banners";

export interface HouseBanner {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  href: string | null;
  ctaLabel: string;
  placement: HouseBannerPlacement;
  audience: HouseBannerAudience;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicHouseBanner {
  id: string;
  title: string;
  imageUrl: string;
  href: string | null;
}
