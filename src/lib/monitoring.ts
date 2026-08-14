/**
 * App-level error helpers. Server errors also go to Discord when configured.
 */
export function captureException(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  console.error("[photowall]", error, extras ?? "");

  // Discord webhook is server-only (secret). Skip in browser bundles.
  if (typeof window === "undefined") {
    void import("@/lib/discord/error-notify")
      .then(({ notifyAppError }) => {
        notifyAppError({ error, extras });
      })
      .catch(() => {
        // Never let alerting break the request path.
      });
  }
}
