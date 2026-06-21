"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

let client: SupabaseClient | null = null;

export { isSupabaseConfigured };

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!client) {
    const { url, key } = getSupabaseEnv();
    if (!url || !key) {
      throw new Error("Supabase is not configured");
    }
    client = createBrowserClient(url, key);
  }
  return client;
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  return createClient();
}
