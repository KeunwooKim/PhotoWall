export const EVENT_POSTS_BUCKET = "event-posts";

export interface EventPost {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  href: string | null;
  ctaLabel: string;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicEventPost {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  href: string | null;
  ctaLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}
