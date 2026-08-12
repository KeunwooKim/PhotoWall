import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/admin/service-client";
import {
  removeStoragePaths,
  scanOrphanWallPhotos,
} from "@/lib/storage/orphan-sweep";
import { authorizeBearerSecret } from "@/lib/auth/timing-safe";

export const dynamic = "force-dynamic";

/**
 * Weekly / manual cron: Authorization: Bearer $CRON_SECRET
 * Default is dry-run. Pass ?dryRun=0 to actually delete orphans.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  if (!authorizeBearerSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role required" }, { status: 503 });
  }

  // Default to dry-run. Destructive deletes require an explicit ?dryRun=0.
  const dryRunParam = request.nextUrl.searchParams.get("dryRun");
  const dryRun = dryRunParam !== "0";

  try {
    const scan = await scanOrphanWallPhotos(admin);
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        ...scan,
        orphans: scan.orphans.slice(0, 50),
        hint: "Pass dryRun=0 to delete after reviewing the scan.",
      });
    }

    const paths = scan.orphans.slice(0, 500).map((o) => o.path);
    const removed = await removeStoragePaths(admin, paths);
    return NextResponse.json({
      dryRun: false,
      removed,
      orphanCount: scan.orphanCount,
      totalFiles: scan.totalFiles,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sweep failed" },
      { status: 500 },
    );
  }
}
