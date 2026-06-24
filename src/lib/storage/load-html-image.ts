/** Load an HTMLImageElement for canvas display (no crossOrigin — avoids CORS load failures). */
const imageCache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

export function getCachedHtmlImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) ?? null;
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(src);
  if (pending) return pending;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      imageCache.set(src, img);
      inflight.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      inflight.delete(src);
      reject(new Error(`Failed to load image: ${src.slice(0, 64)}`));
    };
    img.src = src;
  });

  inflight.set(src, promise);
  return promise;
}

/** Warm the in-memory image cache (e.g. after signed URL prefetch). */
export async function preloadHtmlImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return;
  await Promise.allSettled(unique.map((url) => loadHtmlImage(url)));
}
