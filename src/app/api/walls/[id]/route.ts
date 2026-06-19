import { NextResponse } from "next/server";
import { fetchWallFromDb } from "@/lib/supabase/walls";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const wall = await fetchWallFromDb(id);

  if (!wall) {
    return NextResponse.json({ error: "Wall not found" }, { status: 404 });
  }

  return NextResponse.json(wall);
}
