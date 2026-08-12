import { NextResponse } from "next/server";
import { isUpstashConfigured } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Liveness / readiness probe for PM2, uptime monitors, load balancers.
 * Public — no secrets in the response.
 */
export async function GET() {
  const started = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  let supabase: "ok" | "skip" | "fail" = "skip";
  if (supabaseUrl && anon) {
    try {
      const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: anon },
        signal: AbortSignal.timeout(4000),
      });
      supabase = res.ok ? "ok" : "fail";
    } catch {
      supabase = "fail";
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const upstash = isUpstashConfigured();
  const degraded = supabase === "fail" || (isProd && !upstash);

  return NextResponse.json(
    {
      ok: supabase !== "fail",
      status: degraded ? "degraded" : "ok",
      checks: {
        app: "ok",
        supabase,
        // Do not advertise upstash vs memory to anonymous probes.
        rateLimit: upstash || !isProd ? "ok" : "degraded",
      },
      uptimeSec: Math.floor(process.uptime()),
      latencyMs: Date.now() - started,
    },
    { status: supabase === "fail" ? 503 : 200 },
  );
}
