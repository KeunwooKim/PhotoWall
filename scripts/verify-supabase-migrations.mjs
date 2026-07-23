/**
 * Supabase migration verification (P1)
 * Usage: node scripts/verify-supabase-migrations.mjs
 * Reads .env.local — never prints secret values.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function ok(label, detail = "") {
  return { status: "pass", label, detail };
}

function fail(label, detail = "") {
  return { status: "fail", label, detail };
}

function warn(label, detail = "") {
  return { status: "warn", label, detail };
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminUserId = env.ADMIN_USER_IDS?.split(",")[0]?.trim();

  if (!url || !anonKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  const results = [];
  const admin = serviceKey ? createClient(url, serviceKey) : null;
  const anon = createClient(url, anonKey);

  console.log(`\nPhotoWall Supabase migration check`);
  console.log(`Project: ${url}\n`);

  // ── admin-inquiries-migration.sql ──
  if (!admin) {
    results.push(warn("admin-inquiries", "SUPABASE_SERVICE_ROLE_KEY 없음 — inquiries/is_hidden 확인 생략"));
  } else {
    const { error: inqErr } = await admin.from("inquiries").select("id").limit(1);
    results.push(
      inqErr
        ? fail("inquiries 테이블", inqErr.message)
        : ok("inquiries 테이블", "admin-inquiries-migration.sql 적용됨"),
    );

    const { error: hiddenErr } = await admin.from("walls").select("is_hidden").limit(1);
    results.push(
      hiddenErr
        ? fail("walls.is_hidden 컬럼", hiddenErr.message)
        : ok("walls.is_hidden 컬럼", "admin-inquiries-migration.sql 적용됨"),
    );
  }

  // ── admin-rls-migration.sql ──
  if (admin) {
    const { data: admins, error: adminErr } = await admin.from("app_admins").select("user_id");
    if (adminErr) {
      results.push(fail("app_admins 테이블", adminErr.message));
    } else {
      results.push(ok("app_admins 테이블", `${admins?.length ?? 0}명 등록`));
      if (adminUserId) {
        const registered = admins?.some((row) => row.user_id === adminUserId);
        results.push(
          registered
            ? ok("app_admins 등록", `ADMIN_USER_IDS (${adminUserId.slice(0, 8)}…) 일치`)
            : fail(
                "app_admins 등록",
                `ADMIN_USER_IDS UUID가 app_admins에 없음 — SQL Editor에서 insert 필요`,
              ),
        );
      }
    }

    const { error: rpcErr } = await admin.rpc("is_app_admin");
    results.push(
      rpcErr?.message?.includes("Could not find the function")
        ? fail("is_app_admin()", "admin-rls-migration.sql 미적용")
        : ok("is_app_admin()", "함수 존재"),
    );
  }

  // ── storage-private-migration.sql ──
  if (admin) {
    const { data: bucket, error: bucketErr } = await admin.storage.getBucket("wall-photos");
    if (bucketErr) {
      results.push(fail("wall-photos 버킷", bucketErr.message));
    } else {
      results.push(
        bucket.public === false
          ? ok("wall-photos private", "storage-private-migration.sql 적용됨")
          : fail("wall-photos private", `public=${bucket.public} — storage-private-migration.sql 실행 필요`),
      );
    }
  }

  const publicStorageUrl = `${url}/storage/v1/object/public/wall-photos/probe/nonexistent.jpg`;
  try {
    const res = await fetch(publicStorageUrl, { method: "HEAD" });
    results.push(
      res.status === 400 || res.status === 404
        ? ok("공개 Storage URL 차단", `HEAD ${res.status} — private 버킷 동작`)
        : fail("공개 Storage URL 차단", `HEAD ${res.status} — 버킷이 아직 public일 수 있음`),
    );
  } catch (error) {
    results.push(warn("공개 Storage URL 차단", String(error)));
  }

  // ── walls-select-rls-migration.sql (behavioral) ──
  const { error: anonWallsErr } = await anon.from("walls").select("id").limit(1);
  results.push(
    anonWallsErr
      ? warn("anon walls SELECT", `${anonWallsErr.message} — RLS 정책 확인 필요`)
      : ok("anon walls SELECT", "정책상 일부 벽 조회 가능"),
  );

  if (admin) {
    const { data: privateWalls } = await admin
      .from("walls")
      .select("id, owner_id")
      .not("owner_id", "is", null)
      .eq("is_hidden", false)
      .eq("is_shared", false)
      .limit(30);

    let probeWallId = null;
    for (const wall of privateWalls ?? []) {
      const { data: profile } = await admin
        .from("profiles")
        .select("allow_wall_visits")
        .eq("id", wall.owner_id)
        .maybeSingle();
      if (profile?.allow_wall_visits === false) {
        probeWallId = wall.id;
        break;
      }
    }

    if (!probeWallId) {
      results.push(warn("walls_select RLS", "비공개 프로필 벽 샘플 없음 — 수동 확인"));
    } else {
      const { data: anonRow } = await anon
        .from("walls")
        .select("id")
        .eq("id", probeWallId)
        .maybeSingle();
      results.push(
        anonRow
          ? fail("walls_select RLS", "anon이 allow_wall_visits=false 벽 조회 가능 — walls-select-rls-migration.sql 필요")
          : ok("walls_select RLS", "비공개 벽 anon 차단 — walls-select-rls-migration.sql 적용 추정"),
      );
    }
  }

  // ── shared-walls-members-only-migration.sql ──
  if (admin) {
    const { data: sharedWall } = await admin
      .from("walls")
      .select("id")
      .eq("is_shared", true)
      .eq("is_hidden", false)
      .limit(1)
      .maybeSingle();

    if (!sharedWall?.id) {
      results.push(warn("공동 벽 멤버 전용", "is_shared=true 벽 샘플 없음 — 수동 확인"));
    } else {
      const { data: anonShared } = await anon
        .from("walls")
        .select("id")
        .eq("id", sharedWall.id)
        .maybeSingle();
      results.push(
        anonShared
          ? fail(
              "공동 벽 멤버 전용",
              "anon이 공동 벽 조회 가능 — shared-walls-members-only-migration.sql 필요",
            )
          : ok("공동 벽 멤버 전용", "anon 공동 벽 차단 — members-only migration 적용 추정"),
      );

      const { data: meta, error: metaErr } = await anon.rpc("get_wall_access_meta", {
        p_wall_id: sharedWall.id,
        p_user_id: null,
      });
      results.push(
        metaErr
          ? warn("get_wall_access_meta RPC", metaErr.message)
          : meta?.exists && meta?.is_shared
            ? ok("get_wall_access_meta RPC", "공동 벽 메타 조회 가능 (캔버스 미노출)")
            : fail("get_wall_access_meta RPC", "RPC 응답 확인 필요"),
      );
    }
  }

  // ── production signed-photos (optional) ──
  if (admin) {
    const { data: sampleWall } = await admin.from("walls").select("id").limit(1).maybeSingle();
    if (sampleWall?.id) {
      try {
        const prodRes = await fetch(
          `https://photowall-one.vercel.app/api/walls/${sampleWall.id}/signed-photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paths: ["probe/nonexistent.jpg"] }),
          },
        );
        results.push(
          prodRes.ok
            ? ok("프로덕션 signed-photos API", `HTTP ${prodRes.status} — SUPABASE_SERVICE_ROLE_KEY 동작`)
            : fail("프로덕션 signed-photos API", `HTTP ${prodRes.status}`),
        );
      } catch (error) {
        results.push(warn("프로덕션 signed-photos API", String(error)));
      }
    }
  }

  // ── admin-operations-migration.sql ──
  if (admin) {
    const { error: annErr } = await admin.from("announcements").select("id").limit(1);
    results.push(
      annErr
        ? fail("announcements 테이블", annErr.message)
        : ok("announcements 테이블", "admin-operations-migration.sql 적용됨"),
    );

    const { data: flags, error: flagErr } = await admin.from("feature_flags").select("key, enabled");
    if (flagErr) {
      results.push(fail("feature_flags 테이블", flagErr.message));
    } else {
      const count = flags?.length ?? 0;
      results.push(
        count >= 5
          ? ok("feature_flags 테이블", `${count}개 플래그 — admin-operations-migration.sql 적용됨`)
          : fail("feature_flags 시드", `${count}개 — 5개 기대, admin-operations-migration.sql 실행 필요`),
      );
    }
  }

  // Policy names — run supabase/verify-migrations.sql in Dashboard for full list
  results.push(
    warn(
      "정책 이름 상세",
      "supabase/verify-migrations.sql 을 Dashboard SQL Editor에서 실행해 walls_select / wall_photos_owner_read 확인",
    ),
  );

  // Print report
  const icons = { pass: "✅", fail: "❌", warn: "⚠️ " };
  for (const r of results) {
    console.log(`${icons[r.status]} ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;

  console.log("\n── Dashboard SQL Editor에서 정책 확인 (복붙) ──\n");
  console.log(`select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (
    tablename = 'walls'
    or (tablename = 'objects' and policyname like 'wall_photos%')
  )
order by tablename, policyname;`);

  console.log("\n기대 결과:");
  console.log("  walls: walls_select (있음), walls_select_public (없음)");
  console.log("  storage.objects: wall_photos_owner_read (있음), wall_photos_public_read (없음)");

  console.log(`\n요약: ${failed} 실패, ${warned} 확인 필요, ${results.length - failed - warned} 통과\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
