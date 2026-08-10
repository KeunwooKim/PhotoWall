import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute, adminDbErrorResponse } from "@/lib/admin/require-admin-route";
import {
  isPlanExpired,
  parseUserPlan,
  planExpiryAfterDays,
  resolveEffectivePlan,
} from "@/lib/auth/user-plan";
import type { UserPlan } from "@/lib/wall-quotas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;

  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, display_name, friend_code, avatar_url, created_at, updated_at, restricted_at, restrict_reason, legal_consented_at, legal_version, plan, plan_expires_at, plan_updated_at, allow_wall_visits",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return adminDbErrorResponse(applyCookies, error, "유저를 불러오지 못했어요");
  }
  if (!profile) {
    return applyCookies(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  const [wallsRes, inquiriesRes, memberWallsRes] = await Promise.all([
    admin
      .from("walls")
      .select("id, title, theme_id, is_shared, is_hidden, created_at, updated_at")
      .eq("owner_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
    admin
      .from("inquiries")
      .select("id, category, subject, status, related_wall_id, created_at, resolved_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("wall_members")
      .select("wall_id, role, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const memberRows = memberWallsRes.error ? [] : (memberWallsRes.data ?? []);
  const memberWallIds = memberRows.map((m) => m.wall_id).filter(Boolean);
  const memberWallMeta =
    memberWallIds.length > 0
      ? await admin
          .from("walls")
          .select("id, title, is_shared, is_hidden, owner_id")
          .in("id", memberWallIds)
      : { data: [] as { id: string; title: string | null; is_shared: boolean; is_hidden: boolean; owner_id: string | null }[], error: null };

  const wallMetaById = new Map(
    (memberWallMeta.data ?? []).map((w) => [w.id, w] as const),
  );

  const expiresAt = profile.plan_expires_at ?? null;
  const plan = resolveEffectivePlan(profile.plan, expiresAt);

  return applyCookies(
    NextResponse.json({
      user: {
        id: profile.id,
        displayName: profile.display_name,
        friendCode: profile.friend_code,
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        restrictedAt: profile.restricted_at ?? null,
        restrictReason: profile.restrict_reason ?? null,
        legalConsentedAt: profile.legal_consented_at ?? null,
        legalVersion: profile.legal_version ?? null,
        plan,
        planExpiresAt: plan === "premium" ? expiresAt : null,
        planUpdatedAt: profile.plan_updated_at ?? null,
        allowWallVisits: profile.allow_wall_visits ?? false,
      },
      walls: (wallsRes.data ?? []).map((w) => ({
        id: w.id,
        title: w.title,
        themeId: w.theme_id,
        isShared: w.is_shared,
        isHidden: w.is_hidden,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      })),
      memberWalls: memberRows.map((m) => {
        const wall = wallMetaById.get(m.wall_id);
        return {
          wallId: m.wall_id,
          role: m.role,
          joinedAt: m.created_at,
          title: wall?.title ?? null,
          isShared: wall?.is_shared ?? false,
          isHidden: wall?.is_hidden ?? false,
          ownerId: wall?.owner_id ?? null,
        };
      }),
      inquiries: (inquiriesRes.data ?? []).map((i) => ({
        id: i.id,
        category: i.category,
        subject: i.subject,
        status: i.status,
        relatedWallId: i.related_wall_id,
        createdAt: i.created_at,
        resolvedAt: i.resolved_at,
      })),
    }),
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { admin, applyCookies } = auth.ctx;
  const body = (await request.json()) as {
    restricted?: boolean;
    reason?: string;
    plan?: UserPlan;
    /** null = permanent; number = days from now; ISO string = absolute expiry */
    planExpiresAt?: string | null;
    planDurationDays?: number | null;
  };

  const hasRestricted = typeof body.restricted === "boolean";
  const hasPlan = body.plan === "free" || body.plan === "premium";
  const hasExpiryField =
    "planExpiresAt" in body || "planDurationDays" in body;

  if (!hasRestricted && !hasPlan && !hasExpiryField) {
    return applyCookies(
      NextResponse.json(
        {
          error:
            "restricted boolean, plan (free|premium), or plan duration required",
        },
        { status: 400 },
      ),
    );
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (hasRestricted) {
    if (body.restricted) {
      payload.restricted_at = new Date().toISOString();
      payload.restrict_reason = body.reason?.trim() || "관리자에 의한 제한";
    } else {
      payload.restricted_at = null;
      payload.restrict_reason = null;
    }
  }

  if (hasPlan) {
    payload.plan = body.plan;
    payload.plan_updated_at = new Date().toISOString();

    if (body.plan === "free") {
      payload.plan_expires_at = null;
    } else if (typeof body.planDurationDays === "number") {
      if (
        !Number.isFinite(body.planDurationDays) ||
        body.planDurationDays <= 0 ||
        body.planDurationDays > 3650
      ) {
        return applyCookies(
          NextResponse.json(
            { error: "planDurationDays must be 1–3650" },
            { status: 400 },
          ),
        );
      }
      payload.plan_expires_at = planExpiryAfterDays(
        Math.floor(body.planDurationDays),
      );
    } else if (body.planExpiresAt === null) {
      payload.plan_expires_at = null;
    } else if (typeof body.planExpiresAt === "string" && body.planExpiresAt) {
      const ends = Date.parse(body.planExpiresAt);
      if (!Number.isFinite(ends)) {
        return applyCookies(
          NextResponse.json({ error: "invalid planExpiresAt" }, { status: 400 }),
        );
      }
      payload.plan_expires_at = new Date(ends).toISOString();
    } else if (!hasExpiryField) {
      // Premium without expiry fields → permanent
      payload.plan_expires_at = null;
    }
  } else if (hasExpiryField) {
    // Extend / set expiry while staying on current plan (must be premium)
    if (typeof body.planDurationDays === "number") {
      if (
        !Number.isFinite(body.planDurationDays) ||
        body.planDurationDays <= 0 ||
        body.planDurationDays > 3650
      ) {
        return applyCookies(
          NextResponse.json(
            { error: "planDurationDays must be 1–3650" },
            { status: 400 },
          ),
        );
      }
      payload.plan = "premium";
      payload.plan_updated_at = new Date().toISOString();
      payload.plan_expires_at = planExpiryAfterDays(
        Math.floor(body.planDurationDays),
      );
    } else if (body.planExpiresAt === null) {
      payload.plan_expires_at = null;
      payload.plan_updated_at = new Date().toISOString();
    } else if (typeof body.planExpiresAt === "string" && body.planExpiresAt) {
      const ends = Date.parse(body.planExpiresAt);
      if (!Number.isFinite(ends)) {
        return applyCookies(
          NextResponse.json({ error: "invalid planExpiresAt" }, { status: 400 }),
        );
      }
      payload.plan = "premium";
      payload.plan_updated_at = new Date().toISOString();
      payload.plan_expires_at = new Date(ends).toISOString();
    }
  }

  const { data, error } = await admin
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select("id, restricted_at, restrict_reason, plan, plan_expires_at")
    .single();

  if (error || !data) {
    return adminDbErrorResponse(applyCookies, error ?? {}, "계정 상태 변경에 실패했어요");
  }

  if (hasRestricted) {
    const { notifyAccountRestricted } = await import("@/lib/discord/notify");
    notifyAccountRestricted({
      userId: data.id,
      restricted: !!data.restricted_at,
      reason: data.restrict_reason,
    });
  }

  const expiresAt = (data as { plan_expires_at?: string | null }).plan_expires_at ?? null;
  const plan = resolveEffectivePlan(data.plan, expiresAt);

  return applyCookies(
    NextResponse.json({
      id: data.id,
      restrictedAt: data.restricted_at,
      restrictReason: data.restrict_reason,
      plan,
      planExpiresAt: plan === "premium" ? expiresAt : null,
      planExpired: isPlanExpired(expiresAt) && parseUserPlan(data.plan) === "premium",
    }),
  );
}
