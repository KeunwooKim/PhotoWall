import { NextResponse, type NextRequest } from "next/server";
import { importPhotosFromBoothUrl } from "@/lib/booth-import/fetch-booth-images";

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_url", message: "요청 형식이 올바르지 않아요" },
      { status: 400 },
    );
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid_url", message: "QR 링크가 필요해요" },
      { status: 400 },
    );
  }

  const result = await importPhotosFromBoothUrl(body.url);

  if (!result.ok) {
    const status =
      result.error === "invalid_url" || result.error === "domain_not_allowed" ? 400 : 422;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
