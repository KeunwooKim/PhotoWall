import { captureException } from "@/lib/monitoring";

type RequestInfo = {
  path: string;
  method: string;
};

type ErrorContext = {
  routePath: string;
  routeType: string;
};

/** Next.js not-found / redirect / abort — not real failures. */
function isNextControlFlowError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest =
    "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (digest === "NEXT_NOT_FOUND" || digest === "NEXT_REDIRECT") return true;
  if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) return true;
  if (name === "AbortError") return true;
  if (/NEXT_NOT_FOUND|NEXT_REDIRECT/.test(message)) return true;
  return false;
}

/** Unhandled App Router / route-handler failures → Discord (replaces Sentry). */
export function onRequestError(
  error: { digest?: string } & Error,
  request: RequestInfo,
  context: ErrorContext,
): void {
  if (isNextControlFlowError(error)) return;
  captureException(error, {
    route: `${request.method} ${context.routePath || request.path}`,
    path: request.path,
    routeType: context.routeType,
    digest: error.digest,
  });
}
