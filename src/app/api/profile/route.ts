import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient, getRouteUser } from "@/lib/supabase/route";
import {
  ensureProfile,
  updateAllowWallVisits,
  updateDisplayName,
  updateThemePreferences,
} from "@/lib/supabase/profiles";
import { updatePersonalWallTitle } from "@/lib/supabase/walls";
import { isColorPaletteId } from "@/lib/color-palettes";
import { isThemeMode } from "@/lib/settings-storage";

export async function GET(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureProfile(supabase, user);
  if (!profile) {
    return applyCookies(
      NextResponse.json({ error: "Failed to load profile" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json(profile));
}

export async function PATCH(request: NextRequest) {
  const routeClient = createRouteClient(request);
  if (!routeClient) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { supabase, applyCookies } = routeClient;
  const user = await getRouteUser(supabase, request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    allowWallVisits?: boolean;
    displayName?: string;
    wallTitle?: string;
    themeMode?: string;
    colorPalette?: string;
  };

  const hasAllow = typeof body.allowWallVisits === "boolean";
  const hasName = typeof body.displayName === "string";
  const hasWallTitle = typeof body.wallTitle === "string";
  const hasTheme = isThemeMode(body.themeMode);
  const hasPalette = isColorPaletteId(body.colorPalette);

  if (!hasAllow && !hasName && !hasWallTitle && !hasTheme && !hasPalette) {
    return applyCookies(
      NextResponse.json(
        {
          error:
            "allowWallVisits, displayName, wallTitle, themeMode, or colorPalette required",
        },
        { status: 400 },
      ),
    );
  }

  if (body.themeMode !== undefined && !hasTheme) {
    return applyCookies(
      NextResponse.json({ error: "Invalid themeMode" }, { status: 400 }),
    );
  }
  if (body.colorPalette !== undefined && !hasPalette) {
    return applyCookies(
      NextResponse.json({ error: "Invalid colorPalette" }, { status: 400 }),
    );
  }

  if (hasAllow) {
    const ok = await updateAllowWallVisits(supabase, user.id, body.allowWallVisits!);
    if (!ok) {
      return applyCookies(
        NextResponse.json({ error: "Failed to update privacy" }, { status: 500 }),
      );
    }
  }

  if (hasName) {
    const trimmed = body.displayName!.trim();
    if (!trimmed) {
      return applyCookies(
        NextResponse.json({ error: "displayName must not be empty" }, { status: 400 }),
      );
    }
    const ok = await updateDisplayName(supabase, user.id, trimmed);
    if (!ok) {
      return applyCookies(
        NextResponse.json({ error: "Failed to update display name" }, { status: 500 }),
      );
    }
  }

  if (hasWallTitle) {
    const trimmed = body.wallTitle!.trim();
    if (!trimmed) {
      return applyCookies(
        NextResponse.json({ error: "wallTitle must not be empty" }, { status: 400 }),
      );
    }
    const updated = await updatePersonalWallTitle(supabase, user.id, trimmed);
    if (!updated) {
      return applyCookies(
        NextResponse.json(
          { error: "No personal wall to rename, or update failed" },
          { status: 400 },
        ),
      );
    }
  }

  if (hasTheme || hasPalette) {
    const ok = await updateThemePreferences(supabase, user.id, {
      ...(hasTheme ? { themeMode: body.themeMode } : {}),
      ...(hasPalette ? { colorPalette: body.colorPalette } : {}),
    });
    if (!ok) {
      return applyCookies(
        NextResponse.json(
          { error: "Failed to update theme (run profiles-theme-migration.sql?)" },
          { status: 500 },
        ),
      );
    }
  }

  const profile = await ensureProfile(supabase, user);
  if (!profile) {
    return applyCookies(
      NextResponse.json({ error: "Failed to load profile" }, { status: 500 }),
    );
  }

  return applyCookies(NextResponse.json(profile));
}
