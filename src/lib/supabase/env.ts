/**
 * Browser: always NEXT_PUBLIC_SUPABASE_URL (public Cloudflare URL).
 * Server: prefer SUPABASE_URL (e.g. http://127.0.0.1:8000) to avoid
 * hairpin/NAT timeouts when the host cannot reach its own public hostname.
 */
export function getSupabaseEnv() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url =
    typeof window === "undefined"
      ? process.env.SUPABASE_URL || publicUrl
      : publicUrl;
  return { url, key, publicUrl };
}

/**
 * Auth cookie / storage key must match across browser + server clients.
 * supabase-js defaults to `sb-<first-hostname-label>-auth-token`, so using
 * SUPABASE_URL=http://127.0.0.1:8000 on the server would look for
 * `sb-127-auth-token` while the browser wrote `sb-api-auth-token`.
 * Always derive from the public URL.
 */
export function getSupabaseAuthCookieName(): string | undefined {
  const { publicUrl, url } = getSupabaseEnv();
  const base = publicUrl || url;
  if (!base) return undefined;
  try {
    const label = new URL(base).hostname.split(".")[0];
    if (!label) return undefined;
    return `sb-${label}-auth-token`;
  } catch {
    return undefined;
  }
}

/** Options so createBrowserClient / createServerClient share one cookie name. */
export function getSupabaseAuthCookieOptions(): { name: string } | undefined {
  const name = getSupabaseAuthCookieName();
  return name ? { name } : undefined;
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseEnv();
  return !!(url && key);
}

/** Rewrite internal Kong URLs to the public API host (for signed storage links). */
export function toPublicSupabaseUrl(url: string): string {
  const { url: internal, publicUrl } = getSupabaseEnv();
  if (!internal || !publicUrl || internal === publicUrl) return url;
  const a = internal.replace(/\/$/, "");
  const b = publicUrl.replace(/\/$/, "");
  if (url.startsWith(a)) return `${b}${url.slice(a.length)}`;
  return url;
}
