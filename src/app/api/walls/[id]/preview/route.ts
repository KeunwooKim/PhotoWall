import { NextResponse, type NextRequest } from "next/server";
import { restrictedResponse } from "@/lib/auth/account-restrict";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { canEditWall } from "@/lib/supabase/wall-role";
import { WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";
import { wallPreviewStoragePath } from "@/lib/storage/wall-preview";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getUserPlan } from "@/lib/auth/user-plan";
import { checkAccountStorage, photoUploadMessage } from "@/lib/wall-quotas";
import { getUserWallPhotoBytes } from "@/lib/storage/account-usage-server";

const MAX_PREVIEW_BYTES = 2.5 * 1024 * 1024;

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await restrictedResponse(supabase, user.id);
  if (blocked) return applyCookies(blocked);

  if (!(await checkRateLimitAsync(`wall-preview:${user.id}`, 60, 60 * 1000))) {
    return applyCookies(
      NextResponse.json({ error: "Too many uploads. Slow down." }, { status: 429 }),
    );
  }

  const allowed = await canEditWall(supabase, wallId, user.id);
  if (!allowed) {
    return applyCookies(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("preview");
  if (!file || typeof file === "string") {
    return applyCookies(
      NextResponse.json({ error: "preview file required" }, { status: 400 }),
    );
  }

  if (file.size <= 0 || file.size > MAX_PREVIEW_BYTES) {
    return applyCookies(
      NextResponse.json({ error: "invalid preview size" }, { status: 400 }),
    );
  }

  const plan = await getUserPlan(user.id, supabase);
  const usedBytes = await getUserWallPhotoBytes(user.id, supabase);
  const storageViolation = checkAccountStorage(usedBytes, file.size, plan);
  if (storageViolation) {
    return applyCookies(
      NextResponse.json(
        { error: storageViolation, message: photoUploadMessage(storageViolation, plan) },
        { status: 413 },
      ),
    );
  }

  // Versioned path so CDNs / browsers cannot keep serving a previous JPEG
  // after upsert to the same object key.
  const path = wallPreviewStoragePath(user.id, wallId, Date.now());

  const { data: existing } = await supabase
    .from("walls")
    .select("preview_path")
    .eq("id", wallId)
    .maybeSingle();
  const previousPath =
    typeof existing?.preview_path === "string" ? existing.preview_path : null;

  const { error: uploadError } = await supabase.storage
    .from(WALL_PHOTOS_BUCKET)
    .upload(path, file, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "60",
    });

  if (uploadError) {
    return applyCookies(
      NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 }),
    );
  }

  const { error: updateError } = await supabase
    .from("walls")
    .update({ preview_path: path, updated_at: new Date().toISOString() })
    .eq("id", wallId);

  if (updateError) {
    return applyCookies(
      NextResponse.json({ error: updateError.message || "Failed to save path" }, { status: 500 }),
    );
  }

  if (previousPath && previousPath !== path) {
    void supabase.storage.from(WALL_PHOTOS_BUCKET).remove([previousPath]);
  }

  return applyCookies(NextResponse.json({ previewPath: path }));
}
