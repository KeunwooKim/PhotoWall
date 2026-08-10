import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/admin/require-admin-route";
import { createInquiryReplyNotice } from "@/lib/supabase/user-inbox";
import type {
  BusinessStage,
  Inquiry,
  InquiryCategory,
  InquiryStatus,
} from "@/types/inquiry";

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
  admin_reply?: string | null;
  admin_replied_at?: string | null;
  business_stage?: string | null;
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
    adminReply: row.admin_reply ?? null,
    adminRepliedAt: row.admin_replied_at ?? null,
    businessStage: (row.business_stage as BusinessStage | null) ?? null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

const VALID_STATUSES: InquiryStatus[] = ["open", "in_progress", "resolved"];
const VALID_STAGES: BusinessStage[] = ["lead", "meeting", "contract", "closed"];

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
    adminReply?: string;
    businessStage?: BusinessStage | null;
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

  let replyText: string | null = null;
  if (body.adminReply !== undefined) {
    replyText = body.adminReply.trim() || null;
    updates.admin_reply = replyText;
    updates.admin_replied_at = replyText ? new Date().toISOString() : null;
  }

  if (body.businessStage !== undefined) {
    if (body.businessStage !== null && !VALID_STAGES.includes(body.businessStage)) {
      return applyCookies(NextResponse.json({ error: "Invalid business stage" }, { status: 400 }));
    }
    updates.business_stage = body.businessStage;
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

  if (replyText && data.user_id) {
    await createInquiryReplyNotice(admin, {
      recipientId: data.user_id as string,
      inquiryId: data.id as string,
      subject: data.subject as string,
      reply: replyText,
    });
  }

  return applyCookies(NextResponse.json(mapInquiry(data)));
}
