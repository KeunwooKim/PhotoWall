/**
 * Rate limiter — uses Upstash Redis REST when configured, otherwise
 * falls back to per-instance memory (dev / single-instance only).
 * Production should set UPSTASH_REDIS_REST_* (see /api/health + admin dashboard).
 */

import type { NextRequest } from "next/server";

const memoryHits = new Map<string, { count: number; resetAt: number }>();
let warnedMissingUpstash = false;

export function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

export type RateLimitBackend = "upstash" | "memory";

export function getRateLimitBackend(): RateLimitBackend {
  return isUpstashConfigured() ? "upstash" : "memory";
}

function warnIfProdMissingUpstash() {
  if (warnedMissingUpstash) return;
  if (process.env.NODE_ENV !== "production") return;
  if (isUpstashConfigured()) return;
  warnedMissingUpstash = true;
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN missing in production — using per-instance memory",
  );
}

/** Prefer Cloudflare / proxy client IP; fall back to a stable unknown bucket. */
export function getRequestIp(request: Request | NextRequest): string {
  const headers = request.headers;
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

function memoryCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memoryHits.get(key);

  if (!entry || now > entry.resetAt) {
    memoryHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

async function upstashIncr(key: string, windowMs: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redisKey = `rl:${key}`;
  const pipeline = [
    ["INCR", redisKey],
    ["PEXPIRE", redisKey, String(windowMs), "NX"],
  ];

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = data?.[0]?.result;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

/** Sync wrapper kept for existing call sites — uses memory only. Prefer checkRateLimitAsync in new code. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  return memoryCheck(key, limit, windowMs);
}

/** Durable when UPSTASH_REDIS_REST_* is set; otherwise memory fallback. */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  warnIfProdMissingUpstash();
  const count = await upstashIncr(key, windowMs);
  if (count == null) return memoryCheck(key, limit, windowMs);
  return count <= limit;
}
