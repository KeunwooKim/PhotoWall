/**
 * Smoke: draft → upload → submit → approve → install → public asset + placement id.
 * Uses service role (email password auth is disabled on this host).
 * Usage: node --env-file=.env.local scripts/smoke-ugc-sticker-packs.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import sharp from "sharp";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || url || "").replace(/\/$/, "");

if (!url || !serviceKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `ugc-smoke-${Date.now()}@example.com`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("1. create user", email);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  assert(!createErr && created.user, createErr?.message ?? "user create failed");
  const userId = created.user.id;
  await admin.from("profiles").upsert({ id: userId }, { onConflict: "id" });

  console.log("2. create draft pack");
  const slug = `smoke-${Date.now().toString(36)}`;
  const { data: pack, error: packErr } = await admin
    .from("sticker_packs")
    .insert({
      creator_id: userId,
      slug,
      name: "Smoke Pack",
      description: "ugc smoke test",
      status: "draft",
    })
    .select("*")
    .single();
  assert(!packErr && pack, packErr?.message ?? "pack insert failed");

  console.log("3. upload 8 stickers");
  const items = [];
  for (let i = 0; i < 8; i++) {
    const png = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 40 + i * 20, g: 120, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const itemId = randomUUID();
    const storagePath = `${userId}/${pack.id}/${itemId}.png`;
    const { error: upErr } = await admin.storage
      .from("sticker-assets")
      .upload(storagePath, png, { contentType: "image/png", upsert: false });
    assert(!upErr, upErr?.message ?? "upload failed");

    const { data: item, error: itemErr } = await admin
      .from("sticker_pack_items")
      .insert({
        id: itemId,
        pack_id: pack.id,
        sort_order: i,
        name: `s${i}`,
        storage_path: storagePath,
        width: 64,
        height: 64,
      })
      .select("*")
      .single();
    assert(!itemErr && item, itemErr?.message ?? "item insert failed");
    items.push(item);
  }

  console.log("4. submit → pending → approve");
  const { error: pendingErr } = await admin
    .from("sticker_packs")
    .update({
      sticker_count: 8,
      cover_path: items[0].storage_path,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pack.id);
  assert(!pendingErr, pendingErr?.message ?? "submit failed");

  const { data: published, error: pubErr } = await admin
    .from("sticker_packs")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      reject_reason: null,
    })
    .eq("id", pack.id)
    .select("*")
    .single();
  assert(!pubErr && published?.status === "published", pubErr?.message ?? "approve failed");

  console.log("5. install to library");
  const { error: installErr } = await admin.from("sticker_pack_installs").insert({
    user_id: userId,
    pack_id: pack.id,
  });
  assert(!installErr, installErr?.message ?? "install failed");

  await admin.from("sticker_packs").update({ download_count: 1 }).eq("id", pack.id);

  console.log("6. library + public asset + placement id");
  const { data: libItems } = await admin
    .from("sticker_pack_items")
    .select("*")
    .eq("pack_id", pack.id)
    .order("sort_order");
  assert(libItems?.length === 8, "expected 8 items");

  const stickerId = `ugc.${pack.id}.${items[0].id}`;
  const src = `${publicUrl}/storage/v1/object/public/sticker-assets/${items[0].storage_path}`;
  const head = await fetch(src, { method: "HEAD" });
  assert(head.ok, `public asset not readable: ${src} (${head.status})`);
  assert(stickerId.startsWith("ugc."), "ugc id prefix");
  assert(items[0].width > 0 && items[0].height > 0, "placement size");

  // Anon can read published pack (store)
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: storeRow, error: storeErr } = await anon
    .from("sticker_packs")
    .select("id, name, sticker_count")
    .eq("id", pack.id)
    .maybeSingle();
  assert(!storeErr && storeRow?.id === pack.id, storeErr?.message ?? "anon store read failed");

  const { data: anonItems, error: anonItemsErr } = await anon
    .from("sticker_pack_items")
    .select("id")
    .eq("pack_id", pack.id);
  assert(!anonItemsErr && anonItems?.length === 8, anonItemsErr?.message ?? "anon items read failed");

  console.log("OK smoke passed", {
    packId: pack.id,
    stickerId,
    srcOk: true,
    items: items.length,
  });

  await admin.from("sticker_pack_installs").delete().eq("pack_id", pack.id);
  await admin.from("sticker_pack_items").delete().eq("pack_id", pack.id);
  await admin.from("sticker_packs").delete().eq("id", pack.id);
  await admin.storage.from("sticker-assets").remove(items.map((i) => i.storage_path));
  await admin.auth.admin.deleteUser(userId);
  console.log("cleaned up");
}

main().catch(async (err) => {
  console.error("SMOKE FAILED", err);
  process.exit(1);
});
