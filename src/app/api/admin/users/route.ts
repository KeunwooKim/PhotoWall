import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const filter = request.nextUrl.searchParams.get("filter");

  if (filter === "orphan-walls") {
    const { data, error } = await admin
      .from("walls")
      .select("id, theme_id, created_at, updated_at")
      .is("owner_id", null)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return applyCookies(NextResponse.json({ error: "Failed to load" }, { status: 500 }));
    }

    return applyCookies(NextResponse.json({ orphanWalls: data ?? [] }));
  }

  let query = admin
    .from("profiles")
    .select("id, display_name, friend_code, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,friend_code.ilike.%${q}%`);
  }

  const { data: profiles, error: profilesError } = await query;

  if (profilesError) {
    return applyCookies(
      NextResponse.json(
        { error: profilesError.message || "Failed to load users" },
        { status: 500 },
      ),
    );
  }

  const users = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { count } = await admin
        .from("walls")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", profile.id);

      return {
        id: profile.id,
        displayName: profile.display_name,
        friendCode: profile.friend_code,
        createdAt: profile.created_at,
        wallCount: count ?? 0,
      };
    }),
  );

  return applyCookies(NextResponse.json({ users }));
}
