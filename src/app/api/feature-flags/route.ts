import { NextResponse } from "next/server";
import { jsonWithPublicCache } from "@/lib/api-cache-headers";
import { fetchFeatureFlags } from "@/lib/feature-flags-server";

export async function GET() {
  const flags = await fetchFeatureFlags();
  return jsonWithPublicCache(flags);
}
