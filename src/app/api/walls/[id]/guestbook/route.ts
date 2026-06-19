import { NextResponse, type NextRequest } from "next/server";
import { addGuestbookPhoto } from "@/lib/supabase/social";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { ensureProfile } from "@/lib/supabase/profiles";
import { checkWallAccess } from "@/lib/supabase/wall-access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formData = await request.formData();

  const file = formData.get("photo");
  let authorName = (formData.get("authorName") as string | null) ?? "익명";
  const imageWidth = Number(formData.get("imageWidth") ?? 800);
  const imageHeight = Number(formData.get("imageHeight") ?? 600);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "photo required" }, { status: 400 });
  }

  const routeClient = createRouteClient(request);
  let userId: string | null = null;
  const supabaseForAccess = routeClient?.supabase ?? null;

  if (routeClient) {
    const user = await getRouteUser(routeClient.supabase, request);
    if (user) {
      userId = user.id;
      const profile = await ensureProfile(routeClient.supabase, user);
      if (profile?.displayName) authorName = profile.displayName;
    }
  }

  if (!supabaseForAccess) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const access = await checkWallAccess(supabaseForAccess, id, userId);
  if (!access.canGuestbook) {
    return NextResponse.json(
      { error: "Guestbook photos not allowed on this wall" },
      { status: 403 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const imageDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

  const result = await addGuestbookPhoto(
    id,
    authorName,
    imageDataUrl,
    imageWidth,
    imageHeight,
    userId,
  );

  if (!result) {
    return NextResponse.json({ error: "Failed to add guestbook photo" }, { status: 503 });
  }

  return routeClient?.applyCookies(NextResponse.json(result)) ?? NextResponse.json(result);
}
