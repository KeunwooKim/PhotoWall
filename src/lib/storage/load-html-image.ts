import { preferWebpSrc } from "@/lib/optimized-image-src";

/** Load an HTMLImageElement for canvas display.
 * Prefer CORS mode for http(s) so Konva stage.toDataURL / preview export stays untainted.
 * Fall back without crossOrigin if the server rejects CORS (image still displays, export may fail).
 */
const imageCache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

export function getCachedHtmlImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) ?? null;
}

function loadOnce(src: string, useCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (useCors) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 64)}`));
    img.src = src;
  });
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(src);
  if (pending) return pending;

  const needsCorsAttempt =
    src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//");

  const promise = (async () => {
    try {
      const img = needsCorsAttempt
        ? await loadOnce(src, true).catch(() => loadOnce(src, false))
        : await loadOnce(src, false);
      imageCache.set(src, img);
      return img;
    } finally {
      inflight.delete(src);
    }
  })();

  inflight.set(src, promise);
  return promise;
}

/** Prefer WebP for same-origin static assets; fall back to PNG/JPEG. */
export async function loadOptimizedHtmlImage(src: string): Promise<HTMLImageElement> {
  const webp = preferWebpSrc(src);
  if (webp === src) return loadHtmlImage(src);
  try {
    return await loadHtmlImage(webp);
  } catch {
    return loadHtmlImage(src);
  }
}

/** Warm the in-memory image cache (e.g. after signed URL prefetch). */
export async function preloadHtmlImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return;
  await Promise.allSettled(unique.map((url) => loadHtmlImage(url)));
}
