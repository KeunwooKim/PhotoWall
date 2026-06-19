"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

let client: SupabaseClient | null = null;

export { isSupabaseConfigured };

export function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createBrowserClient(url, key);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient();
  }
  return client;
}
