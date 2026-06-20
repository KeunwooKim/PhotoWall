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

const VALID_STATUSES: InquiryStatus[] = ["open", "in_progress", "resolved"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { data, error } = await admin.from("inquiries").select("*").eq("id", id).single();

  if (error || !data) {
    return applyCookies(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  return applyCookies(NextResponse.json(mapInquiry(data)));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const body = (await request.json()) as {
    status?: InquiryStatus;
    adminNote?: string;
  };

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return applyCookies(NextResponse.json({ error: "Invalid status" }, { status: 400 }));
    }
    updates.status = body.status;
    updates.resolved_at = body.status === "resolved" ? new Date().toISOString() : null;
  }

  if (body.adminNote !== undefined) {
    updates.admin_note = body.adminNote.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return applyCookies(NextResponse.json({ error: "No updates" }, { status: 400 }));
  }

  const { data, error } = await admin
    .from("inquiries")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return applyCookies(NextResponse.json({ error: "Update failed" }, { status: 500 }));
  }

  return applyCookies(NextResponse.json(mapInquiry(data)));
}
