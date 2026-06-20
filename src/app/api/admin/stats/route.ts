import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";

async function countAll(admin: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;

  const [
    profilesRes,
    wallsRes,
    sharedWallsRes,
    orphanWallsRes,
    likesRes,
    commentsRes,
    guestbookRes,
    openInquiriesRes,
    recentInquiriesRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("walls").select("id", { count: "exact", head: true }),
    admin.from("walls").select("id", { count: "exact", head: true }).eq("is_shared", true),
    admin.from("walls").select("id", { count: "exact", head: true }).is("owner_id", null),
    admin.from("wall_likes").select("id", { count: "exact", head: true }),
    admin.from("wall_comments").select("id", { count: "exact", head: true }),
    admin.from("wall_guestbook").select("id", { count: "exact", head: true }),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin
      .from("inquiries")
      .select("id, category, subject, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return applyCookies(
    NextResponse.json({
      users: profilesRes.count ?? 0,
      walls: wallsRes.count ?? 0,
      sharedWalls: sharedWallsRes.count ?? 0,
      orphanWalls: orphanWallsRes.count ?? 0,
      likes: likesRes.count ?? 0,
      comments: commentsRes.count ?? 0,
      guestbook: guestbookRes.count ?? 0,
      openInquiries: openInquiriesRes.count ?? 0,
      hasServiceRole: auth.ctx.hasServiceRole,
      recentInquiries: (recentInquiriesRes.data ?? []).map((row) => ({
        id: row.id,
        category: row.category,
        subject: row.subject,
        status: row.status,
        createdAt: row.created_at,
      })),
    }),
  );
}
