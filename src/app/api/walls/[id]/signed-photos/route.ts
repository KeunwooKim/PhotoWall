import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/admin/service-client";
import { checkWallAccess } from "@/lib/supabase/wall-access";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { createWallPhotoSignedUrls } from "@/lib/storage/signed-urls-server";
import { allPathsOwnedByUser } from "@/lib/storage/wall-photos";

const MAX_PATHS = 64;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: wallId } = await params;
  const routeClient = createRouteClient(request);

  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  const body = (await request.json()) as { paths?: string[] };
  const paths = Array.isArray(body.paths) ? body.paths.slice(0, MAX_PATHS) : [];

  if (paths.length === 0) {
    return applyCookies(NextResponse.json({ signedUrls: {} }));
  }

  const access = await checkWallAccess(supabase, wallId, user?.id ?? null);
  const ownPathsOnly = !!user && allPathsOwnedByUser(paths, user.id);

  if (!access.allowed && !ownPathsOnly) {
    return applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const signedUrls = await createWallPhotoSignedUrls(paths, supabase, user?.id ?? null);

  if (Object.keys(signedUrls).length === 0 && !createAdminClient()) {
    return applyCookies(
      NextResponse.json(
        {
          error:
            "Signed URLs unavailable. Set SUPABASE_SERVICE_ROLE_KEY on the server, or sign in to view your own photos.",
        },
        { status: 503 },
      ),
    );
  }

  return applyCookies(NextResponse.json({ signedUrls }));
}
