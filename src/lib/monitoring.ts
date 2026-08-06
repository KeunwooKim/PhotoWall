/**
 * App-level error helpers. Prefer this over importing Sentry everywhere.
 * SDK is initialized via instrumentation*.ts / sentry.*.config.ts when DSN is set.
 */
import * as Sentry from "@sentry/nextjs";

export function captureException(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  console.error("[photowall]", error, extras ?? "");
  Sentry.captureException(error, extras ? { extra: extras } : undefined);

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

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  extras?: Record<string, unknown>,
): void {
  Sentry.captureMessage(message, {
    level,
    extra: extras,
  });
}
