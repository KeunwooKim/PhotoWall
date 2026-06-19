import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function createRouteClient(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) return null;

  const bearerToken = getBearerToken(request);

  // Bearer JWT를 PostgREST에 전달해야 RLS auth.uid()가 동작함
  if (bearerToken) {
    const supabase = createSupabaseClient(url, key, {
      global: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
    });

    return {
      supabase: supabase as SupabaseClient,
      applyCookies(target: NextResponse) {
        return target;
      },
    };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return {
    supabase: supabase as SupabaseClient,
    applyCookies(target: NextResponse) {
      response.cookies.getAll().forEach((cookie) => {
        target.cookies.set(cookie);
      });
      return target;
    },
  };
}

export async function getRouteUser(
  supabase: SupabaseClient,
  request: NextRequest,
): Promise<User | null> {
  const bearerToken = getBearerToken(request);
  if (bearerToken) {
    const { data: { user }, error } = await supabase.auth.getUser(bearerToken);
    if (!error && user) return user;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
