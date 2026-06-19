/** 포토부스 QR 다운로드 페이지 허용 도메인 (SSRF 방지) */
const ALLOWED_ROOT_DOMAINS = [
  "lifefourcuts.com",
  "life4cut.com",
  "life4cuts.com",
  "life4cuts.co.kr",
  "life4cuts.co.uk",
  "life4cutsusa.com",
  "life4cuts.ca",
  "seobuk.kr",
  "photoism.co.kr",
  "photoism.com",
  "photogray.com",
  "harufilm.com",
  "piccha.co.kr",
  "namane.co.kr",
  "namane.kr",
  "lkventures.co.kr",
  "4cut.co.kr",
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

export function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h.endsWith(".local")) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
    return true;
  }
  return false;
}

export function isAllowedBoothUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    if (isPrivateOrLocalHost(host)) return false;

    return ALLOWED_ROOT_DOMAINS.some(
      (root) => host === root || host.endsWith(`.${root}`),
    );
  } catch {
    return false;
  }
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?)]+$/g, "");
}

function extractUrlCandidate(raw: string): string {
  const trimmed = raw.trim();
  const embedded = trimmed.match(/https?:\/\/[^\s<>"'\u0000-\u001F]+/i);
  if (embedded) return stripTrailingPunctuation(embedded[0]);
  return stripTrailingPunctuation(trimmed);
}

export function normalizeBoothUrl(raw: string): string | null {
  const candidate = extractUrlCandidate(raw);
  if (!candidate) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    const url = new URL(withProtocol);

    if (url.protocol === "http:") {
      url.protocol = "https:";
    }

    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
