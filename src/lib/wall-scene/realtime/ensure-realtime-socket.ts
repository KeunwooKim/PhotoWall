import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncRealtimeAuth(supabase: SupabaseClient): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    await supabase.realtime.setAuth(session.access_token);
  }
}

/** Wait until the Realtime WebSocket is up so sends use WS (not slow REST fallback). */
export async function ensureRealtimeSocket(
  supabase: SupabaseClient,
  timeoutMs = 12_000,
): Promise<void> {
  await syncRealtimeAuth(supabase);

  if (supabase.realtime.isConnected()) {
    return;
  }

  supabase.realtime.connect();

  await new Promise<void>((resolve, reject) => {
    const started = Date.now();

    const tick = () => {
      if (supabase.realtime.isConnected()) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Realtime WebSocket connection timeout"));
        return;
      }
      window.setTimeout(tick, 40);
    };

    tick();
  });
}
