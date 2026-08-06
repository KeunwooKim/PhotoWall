import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthCookieOptions, getSupabaseEnv, isSupabaseConfigured } from "./env";

export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();
  const cookieOptions = getSupabaseAuthCookieOptions();

  return createServerClient(url!, key!, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component — cookie write may be ignored
        }
      },
    },
  });
}
