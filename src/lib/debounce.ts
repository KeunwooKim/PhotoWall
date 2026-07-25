export type DebouncedFn<T extends (...args: never[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  flush: () => void;
  cancel: () => void;
};

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const run = (args: Parameters<T>) => {
    lastArgs = null;
    fn(...args);
  };

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) run(lastArgs);
    }, delay);
  }) as DebouncedFn<T>;

  debounced.flush = () => {
    if (!timer || !lastArgs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }
    clearTimeout(timer);
    timer = null;
    run(lastArgs);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return debounced;
}
