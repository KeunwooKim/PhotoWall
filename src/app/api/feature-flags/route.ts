import { NextResponse } from "next/server";
import { fetchFeatureFlags } from "@/lib/feature-flags-server";

export async function GET() {
  const flags = await fetchFeatureFlags();
  return NextResponse.json(flags);
}
