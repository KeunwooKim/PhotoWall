import { NextResponse, type NextRequest } from "next/server";
import { fetchAllEventPosts, mapEventPost } from "@/lib/event-posts-server";
import { adminDbErrorResponse, requireAdminRoute } from "@/lib/admin/require-admin-route";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const posts = await fetchAllEventPosts(admin);
  return applyCookies(NextResponse.json(posts));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;

  let body: {
    title?: string;
    body?: string;
    imageUrl?: string | null;
    href?: string | null;
    ctaLabel?: string;
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

  if (!body.title?.trim() && !body.body?.trim()) {
    return applyCookies(
      NextResponse.json({ error: "title or body required" }, { status: 400 }),
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("event_posts")
    .insert({
      title: body.title?.trim() ?? "",
      body: body.body?.trim() ?? "",
      image_url: body.imageUrl?.trim() || null,
      href: body.href?.trim() || null,
      cta_label: body.ctaLabel?.trim() || "자세히",
      active: body.active ?? true,
      sort_order: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      starts_at: body.startsAt ?? null,
      ends_at: body.endsAt ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "이벤트 등록 실패");
  }

  return applyCookies(NextResponse.json(mapEventPost(data)));
}
