/** Map a PNG/JPEG public path to a WebP sibling (same path, .webp ext). */
export function preferWebpSrc(src: string): string {
  if (/\.(png|jpe?g)$/i.test(src)) {
    return src.replace(/\.(png|jpe?g)$/i, ".webp");
  }
  return src;
}

export function pngFallbackFromWebp(src: string): string | null {
  if (!/\.webp$/i.test(src)) return null;
  return src.replace(/\.webp$/i, ".png");
}
