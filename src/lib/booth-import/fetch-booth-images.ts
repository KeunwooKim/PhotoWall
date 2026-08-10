import { isAllowedBoothUrl, isPrivateOrLocalHost, normalizeBoothUrl } from "./allowed-domains";
import { extractPhotoUrlsFromHtml, htmlLooksExpired } from "./parse-download-page";
import type { BoothImportResponse } from "./types";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGES = 4;
const MAX_REDIRECTS = 5;

/** Extra HTTPS hosts used by booth download pages for photo assets (not page roots). */
const ALLOWED_IMAGE_CDN_ROOTS = [
  "imweb.me", // photoism / imweb storefront assets
];

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function hostMatchesRoot(hostname: string, root: string): boolean {
  const h = hostname.toLowerCase();
  const r = root.toLowerCase();
  return h === r || h.endsWith(`.${r}`);
}

/** Page + image fetches: allowlisted booth domains, known CDNs, or same host as page. */
export function isAllowedBoothFetchUrl(
  urlString: string,
  pageUrl?: string | null,
): boolean {
  if (isAllowedBoothUrl(urlString)) return true;

  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (isPrivateOrLocalHost(host)) return false;

    if (ALLOWED_IMAGE_CDN_ROOTS.some((root) => hostMatchesRoot(host, root))) {
      return true;
    }

    if (pageUrl) {
      const page = new URL(pageUrl);
      const ph = page.hostname.toLowerCase();
      if (host === ph || host.endsWith(`.${ph}`)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Fetch with manual redirects so each hop is re-validated (SSRF).
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  pageUrlForAllow: string | null,
): Promise<Response> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedBoothFetchUrl(current, pageUrlForAllow ?? current)) {
      throw new Error("blocked_redirect");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(current, {
        ...init,
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            init?.headers && "Accept" in (init.headers as Record<string, string>)
              ? (init.headers as Record<string, string>).Accept
              : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(init?.headers as Record<string, string> | undefined),
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect_without_location");
      current = new URL(location, current).toString();
      continue;
    }

    return response;
  }

  throw new Error("too_many_redirects");
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.subarray(0, maxBytes).toString("utf-8");
}

async function imageUrlToDataUrl(
  imageUrl: string,
  pageUrl: string,
): Promise<string | null> {
  if (!isAllowedBoothFetchUrl(imageUrl, pageUrl)) return null;

  try {
    const response = await fetchWithTimeout(
      imageUrl,
      { headers: { Accept: "image/*" } },
      pageUrl,
    );

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!mime.startsWith("image/")) return null;

    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function isDirectImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(new URL(url).pathname);
}

export async function importPhotosFromBoothUrl(rawUrl: string): Promise<BoothImportResponse> {
  const normalized = normalizeBoothUrl(rawUrl);
  if (!normalized) {
    return {
      ok: false,
      error: "invalid_url",
      message: "올바른 QR 링크가 아니에요",
    };
  }

  if (!isAllowedBoothUrl(normalized)) {
    return {
      ok: false,
      error: "domain_not_allowed",
      message: "지원하지 않는 포토부스 QR이에요. 인생네컷·포토이즘 등의 QR을 사용해 주세요",
    };
  }

  if (isDirectImageUrl(normalized)) {
    const dataUrl = await imageUrlToDataUrl(normalized, normalized);
    if (!dataUrl) {
      return {
        ok: false,
        error: "expired",
        message: "사진을 불러올 수 없어요. QR이 만료됐거나 삭제됐을 수 있어요",
      };
    }
    return { ok: true, images: [dataUrl], sourceUrl: normalized };
  }

  let pageResponse: Response;
  try {
    pageResponse = await fetchWithTimeout(normalized, undefined, normalized);
  } catch {
    return {
      ok: false,
      error: "fetch_failed",
      message: "다운로드 페이지에 연결하지 못했어요. 네트워크를 확인해 주세요",
    };
  }

  if (pageResponse.status === 404 || pageResponse.status === 410) {
    return {
      ok: false,
      error: "expired",
      message: "QR 링크가 만료됐거나 삭제됐어요 (보통 촬영 후 3일)",
    };
  }

  if (!pageResponse.ok) {
    return {
      ok: false,
      error: "not_found",
      message: "다운로드 페이지를 찾을 수 없어요. QR을 다시 확인해 주세요",
    };
  }

  const html = await readLimitedText(pageResponse, MAX_HTML_BYTES);

  if (htmlLooksExpired(html)) {
    return {
      ok: false,
      error: "expired",
      message: "QR 링크가 만료됐어요. 촬영 후 3일 이내에 사용해 주세요",
    };
  }

  const photoUrls = extractPhotoUrlsFromHtml(html, normalized);
  if (photoUrls.length === 0) {
    return {
      ok: false,
      error: "no_images",
      message: "페이지에서 사진을 찾지 못했어요. QR이 올바른지 확인해 주세요",
    };
  }

  const dataUrls: string[] = [];
  for (const photoUrl of photoUrls.slice(0, MAX_IMAGES * 2)) {
    const dataUrl = await imageUrlToDataUrl(photoUrl, normalized);
    if (dataUrl) dataUrls.push(dataUrl);
    if (dataUrls.length >= MAX_IMAGES) break;
  }

  if (dataUrls.length === 0) {
    return {
      ok: false,
      error: "expired",
      message: "사진을 불러올 수 없어요. QR이 만료됐거나 접근이 제한됐을 수 있어요",
    };
  }

  return {
    ok: true,
    images: dataUrls,
    sourceUrl: normalized,
  };
}
