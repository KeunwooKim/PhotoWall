import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { canEditWall } from "@/lib/supabase/wall-role";
import { WALL_PHOTOS_BUCKET } from "@/lib/storage/wall-photos";
import { wallPreviewStoragePath } from "@/lib/storage/wall-preview";

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

  const path = wallPreviewStoragePath(user.id, wallId);
  const { error: uploadError } = await supabase.storage
    .from(WALL_PHOTOS_BUCKET)
    .upload(path, file, {
      contentType: "image/jpeg",
      upsert: true,
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

  return applyCookies(NextResponse.json({ previewPath: path }));
}
