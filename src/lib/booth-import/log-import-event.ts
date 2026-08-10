import type { SupabaseClient } from "@supabase/supabase-js";

export async function logImportEvent(
  admin: SupabaseClient | null,
  opts: {
    userId: string;
    ok: boolean;
    errorCode?: string | null;
    sourceUrl?: string | null;
  },
): Promise<void> {
  if (!admin) return;
  let sourceHost: string | null = null;
  if (opts.sourceUrl) {
    try {
      sourceHost = new URL(opts.sourceUrl).hostname.slice(0, 120);
    } catch {
      sourceHost = null;
    }
  }
  try {
    await admin.from("import_events").insert({
      user_id: opts.userId,
      ok: opts.ok,
      error_code: opts.errorCode ?? null,
      source_host: sourceHost,
    });
  } catch (err) {
    console.warn("[import_events] log failed:", err);
  }
}
