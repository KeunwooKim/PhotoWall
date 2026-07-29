import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { saveLegalConsent } from "@/lib/supabase/profiles";
import { LEGAL_VERSION } from "@/lib/legal/meta";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("legal_consented_at, legal_version")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return applyCookies(
      NextResponse.json({ error: error.message || "Failed to load consent" }, { status: 500 }),
    );
  }

  const legalConsentedAt = (data?.legal_consented_at as string | null) ?? null;
  const legalVersion = (data?.legal_version as string | null) ?? null;
  const ok = Boolean(legalConsentedAt && legalVersion === LEGAL_VERSION);

  return applyCookies(
    NextResponse.json({
      ok,
      legalConsentedAt,
      legalVersion,
      requiredVersion: LEGAL_VERSION,
    }),
  );
}

export async function POST(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    consentedAt?: string;
    version?: string;
  };

  const version = body.version ?? LEGAL_VERSION;
  if (version !== LEGAL_VERSION) {
    return applyCookies(
      NextResponse.json({ error: "stale_legal_version", message: "약관 버전이 변경됐어요" }, { status: 409 }),
    );
  }

  const consentedAt =
    body.consentedAt && !Number.isNaN(Date.parse(body.consentedAt))
      ? body.consentedAt
      : new Date().toISOString();

  const profile = await saveLegalConsent(supabase, user.id, { consentedAt, version });
  if (!profile) {
    return applyCookies(
      NextResponse.json(
        {
          error: "Failed to save consent",
          message: "동의 기록 저장에 실패했어요. SQL 마이그레이션을 확인해 주세요",
        },
        { status: 500 },
      ),
    );
  }

  return applyCookies(
    NextResponse.json({
      legalConsentedAt: profile.legalConsentedAt,
      legalVersion: profile.legalVersion,
    }),
  );
}
