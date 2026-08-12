import { NextResponse, type NextRequest } from "next/server";
import { addGuestbookPhoto } from "@/lib/supabase/social";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { ensureProfile } from "@/lib/supabase/profiles";
import { checkWallAccess } from "@/lib/supabase/wall-access";
import { featureDisabledResponse, isFeatureEnabled } from "@/lib/feature-flags-server";
import { getUserPlan } from "@/lib/auth/user-plan";
import { checkPhotoUpload, photoUploadMessage } from "@/lib/wall-quotas";
import { sniffImageMime } from "@/lib/storage/image-magic";

/** Guestbook embeds as data URL — keep smaller than full wall photo caps. */
const GUESTBOOK_MAX_BYTES = 4 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formData = await request.formData();

  const file = formData.get("photo");
  const imageWidth = Number(formData.get("imageWidth") ?? 800);
  const imageHeight = Number(formData.get("imageHeight") ?? 600);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "photo required" }, { status: 400 });
  }

  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  if (!(await isFeatureEnabled("guestbook", routeClient.supabase))) {
    return NextResponse.json(featureDisabledResponse("방명록"), { status: 503 });
  }

  const user = await getRouteUser(routeClient.supabase, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { restrictedResponse } = await import("@/lib/auth/account-restrict");
  const blocked = await restrictedResponse(routeClient.supabase, user.id);
  if (blocked) return routeClient.applyCookies(blocked);

  const { checkRateLimitAsync } = await import("@/lib/rate-limit");
  if (!(await checkRateLimitAsync(`guestbook:${user.id}`, 20, 60 * 60 * 1000))) {
    return routeClient.applyCookies(
      NextResponse.json({ error: "Too many guestbook posts. Try again later." }, { status: 429 }),
    );
  }

  let authorName = (formData.get("authorName") as string | null) ?? "익명";
  const profile = await ensureProfile(routeClient.supabase, user);
  if (profile?.displayName) authorName = profile.displayName;

  const access = await checkWallAccess(routeClient.supabase, id, user.id);
  if (!access.canGuestbook) {
    return NextResponse.json(
      { error: "Guestbook photos not allowed on this wall" },
      { status: 403 },
    );
  }

  const plan = await getUserPlan(user.id, routeClient.supabase);
  if (file.size > GUESTBOOK_MAX_BYTES) {
    return routeClient.applyCookies(
      NextResponse.json({ error: "방명록 사진은 4MB까지 올릴 수 있어요" }, { status: 413 }),
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageMime(buffer);
  if (!sniffed) {
    return routeClient.applyCookies(
      NextResponse.json({ error: photoUploadMessage("invalid_type", plan) }, { status: 400 }),
    );
  }

  const planViolation = checkPhotoUpload(
    { size: file.size, type: sniffed },
    plan,
  );
  if (planViolation) {
    return routeClient.applyCookies(
      NextResponse.json(
        { error: photoUploadMessage(planViolation, plan) },
        { status: planViolation === "too_large" ? 413 : 400 },
      ),
    );
  }

  const imageDataUrl = `data:${sniffed};base64,${buffer.toString("base64")}`;

  const result = await addGuestbookPhoto(
    routeClient.supabase,
    id,
    authorName,
    imageDataUrl,
    imageWidth,
    imageHeight,
    user.id,
  );

  if (!result) {
    return NextResponse.json({ error: "Failed to add guestbook photo" }, { status: 503 });
  }

  return routeClient?.applyCookies(NextResponse.json(result)) ?? NextResponse.json(result);
}
