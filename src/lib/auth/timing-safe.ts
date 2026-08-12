import { timingSafeEqual } from "crypto";

/**
 * Constant-time compare for Bearer cron secrets (and similar tokens).
 * Returns false if either side is missing or lengths differ.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Expect `Authorization: Bearer <secret>`. */
export function authorizeBearerSecret(
  authorizationHeader: string | null | undefined,
  secret: string,
): boolean {
  const auth = authorizationHeader?.trim() ?? "";
  const expected = `Bearer ${secret}`;
  return timingSafeEqualString(auth, expected);
}
