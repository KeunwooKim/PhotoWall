/** OAuth 콜백 등에서 사용할 앱 origin (Vercel x-forwarded-host 반영) */
export function getSiteOrigin(request: Request): string {
  const { origin } = new URL(request.url);

  if (process.env.NODE_ENV === "development") {
    return origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return origin;
}
