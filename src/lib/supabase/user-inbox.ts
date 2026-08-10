import type { SupabaseClient } from "@supabase/supabase-js";

export type InboxNotice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  inquiryId: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  inquiry_id: string | null;
  created_at: string;
};

function mapRow(row: Row): InboxNotice {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    inquiryId: row.inquiry_id,
    createdAt: row.created_at,
  };
}

export async function createInquiryReplyNotice(
  admin: SupabaseClient,
  opts: {
    recipientId: string;
    inquiryId: string;
    subject: string;
    reply: string;
  },
): Promise<void> {
  const { error } = await admin.from("user_inbox_notices").insert({
    recipient_id: opts.recipientId,
    kind: "inquiry_reply",
    title: `문의 답변: ${opts.subject.slice(0, 60)}`,
    body: opts.reply.slice(0, 2000),
    inquiry_id: opts.inquiryId,
    dismissed_at: null,
  });
  if (error) {
    console.warn("[inbox] create inquiry reply notice failed:", error.message);
  }
}

export async function listInboxNotices(
  supabase: SupabaseClient,
  recipientId: string,
  limit = 20,
): Promise<InboxNotice[]> {
  const { data, error } = await supabase
    .from("user_inbox_notices")
    .select("id, kind, title, body, inquiry_id, created_at")
    .eq("recipient_id", recipientId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[inbox] list failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Row));
}

export async function dismissInboxNotices(
  supabase: SupabaseClient,
  recipientId: string,
  opts: { ids?: string[]; all?: boolean },
): Promise<void> {
  const now = new Date().toISOString();
  if (opts.all) {
    await supabase
      .from("user_inbox_notices")
      .update({ dismissed_at: now })
      .eq("recipient_id", recipientId)
      .is("dismissed_at", null);
    return;
  }
  if (opts.ids?.length) {
    await supabase
      .from("user_inbox_notices")
      .update({ dismissed_at: now })
      .eq("recipient_id", recipientId)
      .in("id", opts.ids);
  }
}
