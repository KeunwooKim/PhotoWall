const EXPIRED_KEYWORDS = [
  "만료",
  "expired",
  "expire",
  "삭제되",
  "deleted",
  "더 이상",
  "not available",
  "not found",
  "유효하지",
  "기간이 지",
  "access denied",
];

const SKIP_IMAGE_HINTS = [
  "logo",
  "icon",
  "favicon",
  "banner",
  "btn_",
  "button",
  "spinner",
  "loading",
  "thumbnail/202201", // imweb site chrome
  "cdn.imweb.me/thumbnail/20250424/c1f5ce", // app store badges
];

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function htmlLooksExpired(html: string): boolean {
  const lower = html.toLowerCase();
  return EXPIRED_KEYWORDS.some((word) => lower.includes(word.toLowerCase()));
}

function resolveUrl(candidate: string, baseUrl: string): string | null {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyPhotoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (SKIP_IMAGE_HINTS.some((hint) => lower.includes(hint))) return false;
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(lower)) return true;
  if (lower.includes("/photo") || lower.includes("/image") || lower.includes("/download")) {
    return true;
  }
  if (lower.includes("cdn") && (lower.includes("jpg") || lower.includes("png"))) return true;
  return false;
}

function extractMetaImage(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const patterns = [
    /property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/gi,
    /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const resolved = resolveUrl(decodeHtmlEntities(match[1]), baseUrl);
      if (resolved) found.push(resolved);
    }
  }

  return found;
}

function extractImgTags(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const pattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const resolved = resolveUrl(decodeHtmlEntities(match[1]), baseUrl);
    if (resolved && isLikelyPhotoUrl(resolved)) {
      found.push(resolved);
    }
  }

  return found;
}

function extractLinkedImages(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const pattern = /href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const resolved = resolveUrl(decodeHtmlEntities(match[1]), baseUrl);
    if (resolved) found.push(resolved);
  }

  return found;
}

function extractJsonImageUrls(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const urlPattern = /https?:\/\/[^"'\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\]*)?/gi;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(html)) !== null) {
    const resolved = resolveUrl(match[0], baseUrl);
    if (resolved && isLikelyPhotoUrl(resolved)) {
      found.push(resolved);
    }
  }

  return found;
}

export function extractPhotoUrlsFromHtml(html: string, pageUrl: string): string[] {
  const candidates = [
    ...extractMetaImage(html, pageUrl),
    ...extractImgTags(html, pageUrl),
    ...extractLinkedImages(html, pageUrl),
    ...extractJsonImageUrls(html, pageUrl),
  ];

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }

  return unique;
}
