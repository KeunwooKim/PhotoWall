export type ThrottledFunction<T extends (...args: never[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  flush: () => void;
};

export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): ThrottledFunction<T> {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  const runPending = () => {
    if (!pendingArgs) return;
    const args = pendingArgs;
    pendingArgs = null;
    lastCall = Date.now();
    fn(...args);
  };

  const throttled = ((...args: Parameters<T>) => {
    pendingArgs = args;
    const now = Date.now();
    const remaining = delayMs - (now - lastCall);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      runPending();
      return;
    }

    if (timer) return;

    timer = setTimeout(() => {
      timer = null;
      runPending();
    }, remaining);
  }) as ThrottledFunction<T>;

  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    runPending();
  };

  return throttled;
}
