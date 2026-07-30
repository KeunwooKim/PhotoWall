/**
 * Optional error reporting. Set SENTRY_DSN (server) and/or NEXT_PUBLIC_SENTRY_DSN (browser).
 * No SDK dependency — posts a minimal Sentry store event when a DSN is present.
 */

type SentryDsnParts = {
  publicKey: string;
  host: string;
  projectId: string;
};

function parseDsn(dsn: string): SentryDsnParts | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "").split("/")[0];
    if (!url.username || !projectId) return null;
    return { publicKey: url.username, host: url.host, projectId };
  } catch {
    return null;
  }
}

function resolveDsn(): string {
  if (typeof process === "undefined") return "";
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";
}

async function postSentryEvent(
  parts: SentryDsnParts,
  message: string,
  stack?: string,
  extras?: Record<string, unknown>,
): Promise<void> {
  const endpoint = `https://${parts.host}/api/${parts.projectId}/store/`;
  const payload = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    server_name: "photowall",
    message,
    exception: stack
      ? {
          values: [
            {
              type: "Error",
              value: message,
              stacktrace: {
                frames: stack
                  .split("\n")
                  .slice(1, 12)
                  .map((line) => ({ filename: line.trim() })),
              },
            },
          ],
        }
      : undefined,
    extra: extras,
    tags: { app: "photowall" },
  };

  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=photowall/0.1, sentry_key=${parts.publicKey}`,
    },
    body: JSON.stringify(payload),
  });
}

export function captureException(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[photowall]", message, extras ?? "", stack ?? "");

  const dsn = resolveDsn();
  const parts = dsn ? parseDsn(dsn) : null;
  if (!parts) return;

  void postSentryEvent(parts, message, stack, extras).catch(() => {
    /* reporting must never throw */
  });
}
