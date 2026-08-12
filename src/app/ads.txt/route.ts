import { getAdSensePublisherId } from "@/lib/ads/adsense";

export const dynamic = "force-dynamic";

/** AdSense ownership / ads.txt verification. */
export async function GET() {
  const publisherId = getAdSensePublisherId();
  const body = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
