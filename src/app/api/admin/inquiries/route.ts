import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import type { Inquiry, InquiryCategory, InquiryStatus } from "@/types/inquiry";

function mapInquiry(row: {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string;
  subject: string;
  body: string;
  related_wall_id: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}): Inquiry {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    category: row.category as InquiryCategory,
    subject: row.subject,
    body: row.body,
    relatedWallId: row.related_wall_id,
    status: row.status as InquiryStatus,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { admin, applyCookies } = auth.ctx;
  const status = request.nextUrl.searchParams.get("status");

  let query = admin.from("inquiries").select("*").order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return applyCookies(NextResponse.json({ error: "Failed to load inquiries" }, { status: 500 }));
  }

  return applyCookies(NextResponse.json((data ?? []).map(mapInquiry)));
}
