import type { User } from "@supabase/supabase-js";

function parseAllowlist(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminUser(user: Pick<User, "id" | "email"> | null | undefined): boolean {
  if (!user) return false;

  const ids = parseAllowlist(process.env.ADMIN_USER_IDS);
  if (ids.includes(user.id)) return true;

  const emails = parseAllowlist(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase());
  if (user.email && emails.includes(user.email.toLowerCase())) return true;

  return false;
}
