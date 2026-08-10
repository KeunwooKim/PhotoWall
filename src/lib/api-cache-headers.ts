import { NextResponse } from "next/server";

/** Short-lived public cache for read-mostly config endpoints. */
export function jsonWithPublicCache<T>(
  data: T,
  maxAgeSec = 60,
  staleWhileRevalidateSec = 300,
): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${maxAgeSec}, stale-while-revalidate=${staleWhileRevalidateSec}`,
    },
  });
}
