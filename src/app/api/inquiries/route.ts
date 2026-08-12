import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getSiteBaseUrl } from "@/lib/site-url";
import { INQUIRY_CATEGORY_LABELS, type InquiryCategory } from "@/types/inquiry";

const VALID_CATEGORIES: InquiryCategory[] = [
  "general",
  "bug",
  "feature",
  "abuse",
  "business",
];

export async function POST(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return applyCookies(NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 }));
  }

  if (!(await checkRateLimitAsync(`inquiry:${user.id}`, 5, 60 * 60 * 1000))) {
    return applyCookies(
      NextResponse.json({ error: "문의는 1시간에 5회까지 가능해요" }, { status: 429 }),
    );
  }

  const body = (await request.json()) as {
    category?: string;
    subject?: string;
    body?: string;
    relatedWallId?: string;
  };

  const category = body.category as InquiryCategory;
  if (!VALID_CATEGORIES.includes(category)) {
    return applyCookies(NextResponse.json({ error: "잘못된 문의 유형이에요" }, { status: 400 }));
  }

  const subject = body.subject?.trim();
  const text = body.body?.trim();

  if (!subject || subject.length > 200) {
    return applyCookies(NextResponse.json({ error: "제목을 입력해 주세요 (최대 200자)" }, { status: 400 }));
  }

  if (!text || text.length > 5000) {
    return applyCookies(NextResponse.json({ error: "내용을 입력해 주세요 (최대 5000자)" }, { status: 400 }));
  }

  // insert().select() needs inquiries_select_own (RETURNING) in addition to insert policy.
  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      user_id: user.id,
      email: user.email,
      category,
      subject,
      body: text,
      related_wall_id: body.relatedWallId ?? null,
      ...(category === "business" ? { business_stage: "lead" } : {}),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[inquiries] insert failed", error.message, error.code);
    return applyCookies(
      NextResponse.json({ error: "문의 전송에 실패했어요" }, { status: 500 }),
    );
  }

  const { notifyInquiry } = await import("@/lib/discord/notify");
  notifyInquiry({
    id: data.id,
    category,
    categoryLabel: INQUIRY_CATEGORY_LABELS[category],
    subject,
    body: text,
    userId: user.id,
    email: user.email,
    relatedWallId: body.relatedWallId ?? null,
    adminUrl: `${getSiteBaseUrl()}/admin/inquiries?id=${data.id}`,
  });

  return applyCookies(NextResponse.json({ id: data.id }, { status: 201 }));
}
