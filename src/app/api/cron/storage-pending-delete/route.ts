import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/admin/service-client";
import { processDuePendingDeletes } from "@/lib/storage/pending-delete";

export const dynamic = "force-dynamic";

/**
 * Process due storage_pending_delete rows.
 * Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role required" }, { status: 503 });
  }

  try {
    const result = await processDuePendingDeletes(admin, 500);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "process failed" },
      { status: 500 },
    );
  }
}
