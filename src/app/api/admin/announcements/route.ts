import { NextResponse, type NextRequest } from "next/server";
import { fetchAllAnnouncements, mapAnnouncement } from "@/lib/announcements-server";
import { adminDbErrorResponse, requireAdminRoute } from "@/lib/admin/require-admin-route";
import type { AnnouncementSeverity, AnnouncementTarget } from "@/types/announcement";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const announcements = await fetchAllAnnouncements(admin);
  return applyCookies(NextResponse.json(announcements));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;

  let body: {
    title?: string;
    message?: string;
    severity?: AnnouncementSeverity;
    target?: AnnouncementTarget;
    active?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  if (!body.message?.trim()) {
    return applyCookies(NextResponse.json({ error: "message required" }, { status: 400 }));
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("announcements")
    .insert({
      title: body.title?.trim() ?? "",
      message: body.message.trim(),
      severity: body.severity ?? "info",
      target: body.target ?? "all",
      active: body.active ?? true,
      starts_at: body.startsAt ?? null,
      ends_at: body.endsAt ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "공지 등록 실패");
  }

  return applyCookies(NextResponse.json(mapAnnouncement(data)));
}
