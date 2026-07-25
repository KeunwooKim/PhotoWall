import { NextResponse } from "next/server";

/** Comments feature removed — guestbook + likes remain. */
export async function GET() {
  return NextResponse.json(
    { error: "gone", message: "댓글 기능이 종료됐어요" },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "gone", message: "댓글 기능이 종료됐어요" },
    { status: 410 },
  );
}
