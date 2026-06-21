export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    pendingArgs = args;
    const now = Date.now();
    const remaining = delayMs - (now - lastCall);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn(...args);
      pendingArgs = null;
      return;
    }

    if (timer) return;

    timer = setTimeout(() => {
      timer = null;
      lastCall = Date.now();
      if (pendingArgs) fn(...pendingArgs);
      pendingArgs = null;
    }, remaining);
  };
}
