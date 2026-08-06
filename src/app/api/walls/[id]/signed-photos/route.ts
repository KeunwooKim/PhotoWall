import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/admin/service-client";
import { checkWallAccess } from "@/lib/supabase/wall-access";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { createWallPhotoSignedUrls } from "@/lib/storage/signed-urls-server";
import {
  allPathsOwnedByUser,
  collectWallPhotoPathsFromCanvas,
  isOwnWallPhotoPath,
} from "@/lib/storage/wall-photos";
import { fetchWallFromDb } from "@/lib/supabase/walls";
import { canEditWall, listWallCollaboratorUserIds } from "@/lib/supabase/wall-role";
import { checkRateLimitAsync, getRequestIp } from "@/lib/rate-limit";

const MAX_PATHS = 48;

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
  const ip = getRequestIp(request);

  if (!(await checkRateLimitAsync(`signed-photos:${user?.id ?? ip}:${wallId}`, 30, 60_000))) {
    return applyCookies(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
  }

  let paths: string[] = [];
  try {
    const body = (await request.json()) as { paths?: string[] };
    paths = Array.isArray(body?.paths) ? body.paths.slice(0, MAX_PATHS) : [];
  } catch {
    // Empty or non-JSON body — treat as no paths
  }

  if (paths.length === 0) {
    return applyCookies(NextResponse.json({ signedUrls: {} }));
  }

  const access = await checkWallAccess(supabase, wallId, user?.id ?? null);
  const ownPathsOnly = !!user && allPathsOwnedByUser(paths, user.id);

  if (!access.allowed && !ownPathsOnly) {
    return applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  let toSign = paths;

  if (access.allowed) {
    const wall = await fetchWallFromDb(wallId, supabase);
    if (!wall) {
      return applyCookies(NextResponse.json({ error: "Wall not found" }, { status: 404 }));
    }

    const onWall = new Set(collectWallPhotoPathsFromCanvas(wall.canvasJson));
    if (wall.previewPath) onWall.add(wall.previewPath);

    const maySignLiveUploads =
      !!user && (await canEditWall(supabase, wallId, user.id));

    // Editors receive photos over realtime before autosave writes them into
    // canvas_json. Allow signing collaborator-owned paths so peers can render.
    const collaboratorIds = maySignLiveUploads
      ? await listWallCollaboratorUserIds(supabase, wallId)
      : null;

    toSign = paths.filter((path) => {
      if (onWall.has(path)) return true;
      if (maySignLiveUploads && user && isOwnWallPhotoPath(path, user.id)) return true;
      const ownerId = path.split("/")[0];
      if (collaboratorIds?.has(ownerId)) return true;
      return false;
    });
  }

  if (toSign.length === 0) {
    return applyCookies(NextResponse.json({ signedUrls: {} }));
  }

  const signedUrls = await createWallPhotoSignedUrls(toSign, supabase, user?.id ?? null);

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
