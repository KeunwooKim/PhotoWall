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
