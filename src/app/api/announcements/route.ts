import { jsonWithPublicCache } from "@/lib/api-cache-headers";
import { fetchActiveAnnouncements } from "@/lib/announcements-server";
import type { AnnouncementTarget } from "@/types/announcement";

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("target");
  const pageTarget: AnnouncementTarget =
    target === "home" || target === "editor" ? target : "home";

  const announcements = await fetchActiveAnnouncements(pageTarget);
  return jsonWithPublicCache(announcements);
}
