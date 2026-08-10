/** OAuth 콜백 등에서 사용할 앱 origin */

function configuredSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Prefer NEXT_PUBLIC_SITE_URL in production so client-controlled
 * x-forwarded-host cannot poison post-login redirects.
 */
export function getSiteOrigin(request: Request): string {
  const configured = configuredSiteOrigin();
  const { origin } = new URL(request.url);

  if (process.env.NODE_ENV === "development") {
    return configured ?? origin;
  }

  if (configured) return configured;

  // Fallback: request URL host only (do not trust x-forwarded-host).
  return origin;
}

/**
 * Safe in-app path after OAuth. Blocks open redirects and scheme tricks.
 */
export function sanitizeAuthNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";

  let path = raw.trim();
  if (!path) return "/";

  if (/^https?:\/\//i.test(path) || path.startsWith("//") || path.includes("\\")) {
    return "/";
  }

  try {
    if (path.includes("://")) return "/";
  } catch {
    return "/";
  }

  if (!path.startsWith("/")) return "/";
  if (path.includes("//") || path.includes("..")) return "/";

  const hash = path.indexOf("#");
  if (hash >= 0) path = path.slice(0, hash);

  if (path.length > 512) path = path.slice(0, 512);

  return path || "/";
}

/**
 * Reject cross-site cookie-auth mutations. Browser fetch sends Origin;
 * Referer is a fallback. Missing both is allowed for non-browser clients
 * that use Bearer tokens (still gated by session auth on the route).
 */
export function rejectForeignOrigin(request: Request): Response | null {
  const site = getSiteOrigin(request);
  let siteOrigin: string;
  try {
    siteOrigin = new URL(site).origin;
  } catch {
    return null;
  }

  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    try {
      if (new URL(origin).origin !== siteOrigin) {
        return Response.json({ error: "Invalid origin" }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Invalid origin" }, { status: 403 });
    }
    return null;
  }

  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      if (new URL(referer).origin !== siteOrigin) {
        return Response.json({ error: "Invalid origin" }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Invalid origin" }, { status: 403 });
    }
  }

  return null;
}
