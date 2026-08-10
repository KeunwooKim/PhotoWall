/** Safe in-app destinations after QR import / photo scan. */

export const DEFAULT_WALL_RETURN_PATH = "/wall/edit";

const SHARED_EDITOR_PATH =
  /^\/shared\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Only allow returning to personal edit or a shared wall editor.
 * Blocks open redirects and unknown paths (defaults to personal wall).
 */
export function sanitizeWallReturnPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_WALL_RETURN_PATH;

  let path = raw.trim();
  try {
    if (/^https?:\/\//i.test(path)) {
      path = new URL(path).pathname;
    }
  } catch {
    return DEFAULT_WALL_RETURN_PATH;
  }

  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  const hash = path.indexOf("#");
  if (hash >= 0) path = path.slice(0, hash);

  if (!path.startsWith("/") || path.includes("//") || path.includes("..")) {
    return DEFAULT_WALL_RETURN_PATH;
  }

  if (path === "/wall/edit") return path;
  if (SHARED_EDITOR_PATH.test(path)) return path;

  return DEFAULT_WALL_RETURN_PATH;
}

export function hrefWithWallReturn(
  base: "/import" | "/capture",
  returnTo: string,
): string {
  const safe = sanitizeWallReturnPath(returnTo);
  return `${base}?returnTo=${encodeURIComponent(safe)}`;
}
