import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import { checkRateLimit } from "@/lib/rate-limit";
import type { InquiryCategory } from "@/types/inquiry";

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
    return applyCookies(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  if (!checkRateLimit(`inquiry:${user.id}`, 5, 60 * 60 * 1000)) {
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
    return applyCookies(NextResponse.json({ error: "Invalid category" }, { status: 400 }));
  }

  const subject = body.subject?.trim();
  const text = body.body?.trim();

  if (!subject || subject.length > 200) {
    return applyCookies(NextResponse.json({ error: "Subject required (max 200)" }, { status: 400 }));
  }

  if (!text || text.length > 5000) {
    return applyCookies(NextResponse.json({ error: "Body required (max 5000)" }, { status: 400 }));
  }

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      user_id: user.id,
      email: user.email,
      category,
      subject,
      body: text,
      related_wall_id: body.relatedWallId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return applyCookies(NextResponse.json({ error: "Failed to submit inquiry" }, { status: 500 }));
  }

  return applyCookies(NextResponse.json({ id: data.id }, { status: 201 }));
}
