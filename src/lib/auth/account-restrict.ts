import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function isUserRestricted(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("restricted_at")
    .eq("id", userId)
    .maybeSingle();

  return !!data?.restricted_at;
}

/** Returns a 403 NextResponse if the user is restricted; otherwise null. */
export async function restrictedResponse(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  if (!(await isUserRestricted(supabase, userId))) return null;

  return NextResponse.json(
    {
      error: "account_restricted",
      message: "활동이 제한된 계정이에요. 문의하기에서 도움을 요청해 주세요",
    },
    { status: 403 },
  );
}
