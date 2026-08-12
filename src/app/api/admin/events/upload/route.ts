import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute, serviceRoleRequiredResponse } from "@/lib/admin/require-admin-route";
import { toPublicSupabaseUrl } from "@/lib/supabase/env";
import { EVENT_POSTS_BUCKET } from "@/types/event-post";
import { extensionForImageMime, sniffImageMime } from "@/lib/storage/image-magic";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies, hasServiceRole } = auth.ctx;
  if (!hasServiceRole) {
    return serviceRoleRequiredResponse(applyCookies);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return applyCookies(NextResponse.json({ error: "Invalid form data" }, { status: 400 }));
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return applyCookies(NextResponse.json({ error: "file required" }, { status: 400 }));
  }
  if (file.size > MAX_BYTES) {
    return applyCookies(NextResponse.json({ error: "이미지는 5MB 이하여야 해요" }, { status: 400 }));
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageMime(buffer);
  if (!sniffed) {
    return applyCookies(
      NextResponse.json({ error: "jpg/png/webp/gif만 업로드할 수 있어요" }, { status: 400 }),
    );
  }

  const ext = extensionForImageMime(sniffed);
  const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await admin.storage.from(EVENT_POSTS_BUCKET).upload(path, buffer, {
    contentType: sniffed,
    upsert: false,
  });

  if (error) {
    return applyCookies(
      NextResponse.json({ error: "업로드 실패", detail: error.message }, { status: 500 }),
    );
  }

  const { data } = admin.storage.from(EVENT_POSTS_BUCKET).getPublicUrl(path);
  const imageUrl = toPublicSupabaseUrl(data.publicUrl);

  return applyCookies(NextResponse.json({ imageUrl, path }));
}
