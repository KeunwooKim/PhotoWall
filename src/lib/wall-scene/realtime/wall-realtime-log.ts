const PREFIX = "[wall-realtime]";

function isDevLoggingEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function rtLog(message: string, data?: Record<string, unknown>): void {
  if (!isDevLoggingEnabled()) return;

  if (data) {
    console.log(`${PREFIX} ${message}`, data);
    return;
  }

  console.log(`${PREFIX} ${message}`);
}

export function rtWarn(message: string, data?: Record<string, unknown>): void {
  if (!isDevLoggingEnabled()) return;

  if (data) {
    console.warn(`${PREFIX} ${message}`, data);
    return;
  }

  console.warn(`${PREFIX} ${message}`);
}

export function rtError(message: string, error?: unknown): void {
  if (!isDevLoggingEnabled()) return;
  console.error(`${PREFIX} ${message}`, error);
}

/** Throttle noisy logs (e.g. per-frame patch send). */
export function createRtLogThrottle(everyMs: number) {
  let lastAt = 0;
  let suppressed = 0;

  return (message: string, data?: Record<string, unknown>, force = false) => {
    if (!isDevLoggingEnabled()) return;

    const now = Date.now();
    if (!force && now - lastAt < everyMs) {
      suppressed += 1;
      return;
    }

    const payload =
      suppressed > 0 ? { ...data, suppressedSinceLast: suppressed } : data;
    suppressed = 0;
    lastAt = now;
    rtLog(message, payload);
  };
}
