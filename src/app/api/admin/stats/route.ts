import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import {
  countByDay,
  distinctOwnersByDay,
  mergeSeries,
  startOfLocalDay,
  toDayKey,
} from "@/lib/admin/dashboard-stats";
import { LEGAL_VERSION } from "@/lib/legal/meta";
import { getRateLimitBackend } from "@/lib/rate-limit";

function startOfTodayIso(): string {
  return startOfLocalDay().toISOString();
}

function daysAgoIso(days: number): string {
  const d = startOfLocalDay();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

async function countLoginDau(
  admin: {
    auth: {
      admin: {
        listUsers: (args: {
          page: number;
          perPage: number;
        }) => Promise<{
          data: { users: { id: string; last_sign_in_at?: string | null }[] };
          error: { message: string } | null;
        }>;
      };
    };
  },
  todayKey: string,
  weekStartIso: string,
): Promise<{ today: number | null; weekUnique: number | null }> {
  try {
    const todaySet = new Set<string>();
    const weekSet = new Set<string>();
    const weekStart = Date.parse(weekStartIso);
    let page = 1;
    const perPage = 200;
    const maxPages = 25; // cap ~5k users for dashboard latency

    while (page <= maxPages) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) return { today: null, weekUnique: null };
      const users = data.users ?? [];
      if (!users.length) break;
      for (const u of users) {
        if (!u.last_sign_in_at) continue;
        const t = Date.parse(u.last_sign_in_at);
        if (!Number.isFinite(t) || t < weekStart) continue;
        weekSet.add(u.id);
        if (toDayKey(new Date(t)) === todayKey) todaySet.add(u.id);
      }
      if (users.length < perPage) break;
      page += 1;
    }

    return { today: todaySet.size, weekUnique: weekSet.size };
  } catch {
    return { today: null, weekUnique: null };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  const todayStart = startOfTodayIso();
  const weekStart = daysAgoIso(7);
  const todayKey = toDayKey(startOfLocalDay());

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
    premiumRes,
    businessOpenRes,
    importOkWeekRes,
    importFailWeekRes,
    seriesProfilesRes,
    seriesWallsRes,
    seriesInquiriesRes,
    seriesImportsRes,
    activeWallsRes,
    hiddenWallsRes,
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
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "premium")
      .or(`plan_expires_at.is.null,plan_expires_at.gt.${new Date().toISOString()}`),
    admin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("category", "business")
      .in("status", ["open", "in_progress"]),
    admin
      .from("import_events")
      .select("id", { count: "exact", head: true })
      .eq("ok", true)
      .gte("created_at", weekStart),
    admin
      .from("import_events")
      .select("id", { count: "exact", head: true })
      .eq("ok", false)
      .gte("created_at", weekStart),
    admin.from("profiles").select("created_at").gte("created_at", weekStart).limit(5000),
    admin.from("walls").select("created_at").gte("created_at", weekStart).limit(5000),
    admin.from("inquiries").select("created_at").gte("created_at", weekStart).limit(5000),
    admin
      .from("import_events")
      .select("created_at, ok")
      .gte("created_at", weekStart)
      .limit(5000),
    admin
      .from("walls")
      .select("owner_id, updated_at")
      .not("owner_id", "is", null)
      .gte("updated_at", weekStart)
      .limit(5000),
    admin
      .from("walls")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", true),
  ]);

  const importOk = importOkWeekRes.error ? null : (importOkWeekRes.count ?? 0);
  const importFail = importFailWeekRes.error ? null : (importFailWeekRes.count ?? 0);

  const importOkRows =
    seriesImportsRes.data?.filter((r) => r.ok === true).map((r) => ({ created_at: r.created_at })) ??
    [];
  const importFailRows =
    seriesImportsRes.data
      ?.filter((r) => r.ok === false)
      .map((r) => ({ created_at: r.created_at })) ?? [];

  const activeByDay = distinctOwnersByDay(activeWallsRes.data);
  const series = mergeSeries({
    days: 7,
    users: countByDay(seriesProfilesRes.data),
    walls: countByDay(seriesWallsRes.data),
    inquiries: countByDay(seriesInquiriesRes.data),
    importOk: countByDay(importOkRows),
    importFail: countByDay(importFailRows),
    activeEditors: activeByDay,
  });

  const activeEditorsToday = activeByDay.get(todayKey)?.size ?? 0;
  const activeEditorsWeek = new Set<string>();
  for (const set of activeByDay.values()) {
    for (const id of set) activeEditorsWeek.add(id);
  }

  const loginDau = hasServiceRole
    ? await countLoginDau(admin, todayKey, weekStart)
    : { today: null, weekUnique: null };

  const openAbuse = openAbuseRes.count ?? 0;
  const openInquiries = openInquiriesRes.count ?? 0;
  const openBusiness = businessOpenRes.count ?? 0;
  const qrFailWeek = importFail ?? 0;

  const todos: {
    id: string;
    label: string;
    count: number;
    href: string;
    tone: "danger" | "warn" | "neutral";
  }[] = [];

  if (openAbuse > 0) {
    todos.push({
      id: "abuse",
      label: "미처리 신고",
      count: openAbuse,
      href: "/admin/inquiries?category=abuse&status=open",
      tone: "danger",
    });
  }
  if (openInquiries > 0) {
    todos.push({
      id: "inquiries",
      label: "미처리 문의",
      count: openInquiries,
      href: "/admin/inquiries?status=open",
      tone: "warn",
    });
  }
  if (openBusiness > 0) {
    todos.push({
      id: "business",
      label: "제휴 파이프라인",
      count: openBusiness,
      href: "/admin/inquiries?category=business",
      tone: "neutral",
    });
  }
  if (importFail !== null && qrFailWeek > 0) {
    todos.push({
      id: "qr-fail",
      label: "QR 실패 (7일)",
      count: qrFailWeek,
      href: "/admin/operations",
      tone: "warn",
    });
  }
  const hiddenCount = hiddenWallsRes.error ? 0 : (hiddenWallsRes.count ?? 0);
  if (hiddenCount > 0) {
    todos.push({
      id: "hidden-walls",
      label: "숨긴 벽 검토",
      count: hiddenCount,
      href: "/admin/walls?filter=hidden",
      tone: "neutral",
    });
  }

  return applyCookies(
    NextResponse.json({
      users: profilesRes.count ?? 0,
      walls: wallsRes.count ?? 0,
      sharedWalls: sharedWallsRes.count ?? 0,
      orphanWalls: orphanWallsRes.count ?? 0,
      likes: likesRes.count ?? 0,
      guestbook: guestbookRes.count ?? 0,
      openInquiries,
      openAbuseCount: openAbuse,
      premiumUsers: premiumRes.count ?? 0,
      openBusinessInquiries: openBusiness,
      hasServiceRole,
      rateLimitBackend: getRateLimitBackend(),
      importWeek: {
        ok: importOk,
        fail: importFail,
        available: importOk !== null && importFail !== null,
      },
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
      dau: {
        /** Distinct wall owners who updated a wall today */
        editorsToday: activeEditorsToday,
        editorsWeek: activeEditorsWeek.size,
        /** Auth last_sign_in_at (needs service role) */
        loginToday: loginDau.today,
        loginWeek: loginDau.weekUnique,
      },
      series,
      todos,
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
