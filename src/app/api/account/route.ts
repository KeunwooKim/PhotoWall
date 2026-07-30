import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { deleteUserAccount } from "@/lib/auth/delete-account";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { captureException } from "@/lib/monitoring";

/** DELETE — permanently delete the authenticated user's account. */
export async function DELETE(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimitAsync(`account-delete:${user.id}`, 3, 60 * 60 * 1000))) {
    return applyCookies(
      NextResponse.json({ error: "Too many deletion attempts. Try again later." }, { status: 429 }),
    );
  }

  const confirm = request.headers.get("x-confirm-delete");
  if (confirm !== "DELETE") {
    return applyCookies(
      NextResponse.json(
        { error: "Send header X-Confirm-Delete: DELETE to confirm" },
        { status: 400 },
      ),
    );
  }

  try {
    const result = await deleteUserAccount(user.id);
    if (!result.ok) {
      return applyCookies(NextResponse.json({ error: result.error }, { status: result.status }));
    }
    return applyCookies(NextResponse.json({ ok: true }));
  } catch (err) {
    captureException(err, { route: "DELETE /api/account", userId: user.id });
    return applyCookies(
      NextResponse.json({ error: "Account deletion failed" }, { status: 500 }),
    );
  }
}
