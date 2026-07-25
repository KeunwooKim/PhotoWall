import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import { LEGAL_VERSION } from "@/lib/legal/meta";

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const todayStart = startOfTodayIso();
  const weekStart = daysAgoIso(7);

  const [
    profilesRes,
    wallsRes,
    sharedWallsRes,
    orphanWallsRes,
    likesRes,
    guestbookRes,
    openInquiriesRes,
    openAbuseRes,
    recentInquiriesRes,
    usersTodayRes,
    usersWeekRes,
    wallsTodayRes,
    wallsWeekRes,
    inquiriesTodayRes,
    inquiriesWeekRes,
    consentOkRes,
    consentMissingRes,
    consentStaleRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("walls").select("id", { count: "exact", head: true }),
    admin.from("walls").select("id", { count: "exact", head: true }).eq("is_shared", true),
    admin.from("walls").select("id", { count: "exact", head: true }).is("owner_id", null),
    admin.from("wall_likes").select("id", { count: "exact", head: true }),
    admin.from("wall_guestbook").select("id", { count: "exact", head: true }),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .eq("category", "abuse"),
    admin
      .from("inquiries")
      .select("id, category, subject, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
    admin.from("walls").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    admin.from("walls").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
    admin.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    admin.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("legal_version", LEGAL_VERSION)
      .not("legal_consented_at", "is", null),
    admin.from("profiles").select("id", { count: "exact", head: true }).is("legal_consented_at", null),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("legal_consented_at", "is", null)
      .neq("legal_version", LEGAL_VERSION),
  ]);

  return applyCookies(
    NextResponse.json({
      users: profilesRes.count ?? 0,
      walls: wallsRes.count ?? 0,
      sharedWalls: sharedWallsRes.count ?? 0,
      orphanWalls: orphanWallsRes.count ?? 0,
      likes: likesRes.count ?? 0,
      guestbook: guestbookRes.count ?? 0,
      openInquiries: openInquiriesRes.count ?? 0,
      openAbuseCount: openAbuseRes.count ?? 0,
      hasServiceRole: auth.ctx.hasServiceRole,
      today: {
        users: usersTodayRes.count ?? 0,
        walls: wallsTodayRes.count ?? 0,
        inquiries: inquiriesTodayRes.count ?? 0,
      },
      last7Days: {
        users: usersWeekRes.count ?? 0,
        walls: wallsWeekRes.count ?? 0,
        inquiries: inquiriesWeekRes.count ?? 0,
      },
      consent: {
        ok: consentOkRes.count ?? 0,
        missing: consentMissingRes.count ?? 0,
        stale: consentStaleRes.count ?? 0,
        version: LEGAL_VERSION,
      },
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
