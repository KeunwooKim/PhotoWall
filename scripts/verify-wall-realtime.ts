/**
 * Shared-wall realtime smoke (PROJECT.md §9.1 subset).
 * 1) Presence utils unit checks
 * 2) Live 2-session Broadcast over Supabase Realtime (no DB wall required)
 *
 * Usage: npx --yes tsx scripts/verify-wall-realtime.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  dedupePresencePeers,
  mergePeerPresence,
  peerLockedObjectIds,
  peerSelectedObjectIds,
  presencePeerKey,
  shouldShowPeerCursor,
} from "../src/lib/wall-scene/presence-utils";
import { WallRealtimeSession } from "../src/lib/wall-scene/realtime/wall-ydoc";
import type { WallPresenceState, WallSceneObject } from "../src/types/wall-scene-v2";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

function loadEnvLocal(): Record<string, string> {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function peer(partial: Partial<WallPresenceState> & Pick<WallPresenceState, "userId">): WallPresenceState {
  return {
    displayName: "t",
    color: "#f00",
    cursorX: 0,
    cursorY: 0,
    updatedAt: Date.now(),
    sessionId: partial.sessionId ?? partial.userId,
    ...partial,
  };
}

function unitPresence(): void {
  assert(presencePeerKey({ userId: "u1", sessionId: "s1" }) === "s1", "presence key prefers session");
  assert(presencePeerKey({ userId: "u1" }) === "u1", "presence key falls back to user");

  const multi = peer({
    userId: "u1",
    sessionId: "s1",
    selectedObjectIds: ["a", "b"],
  });
  assert(peerSelectedObjectIds(multi).join(",") === "a,b", "multi-select ids");

  const merged = mergePeerPresence(
    peer({ userId: "u1", sessionId: "s1", cursorX: 10, cursorY: 20, updatedAt: 1 }),
    peer({ userId: "u1", sessionId: "s1", cursorX: 0, cursorY: 0, updatedAt: 2, selectedObjectIds: ["x"] }),
  );
  assert(merged.cursorX === 10 && merged.selectedObjectIds?.[0] === "x", "merge keeps cursor + takes selection");

  const sameUserTwoSessions = dedupePresencePeers([
    peer({ userId: "u1", sessionId: "tab-a", updatedAt: 1 }),
    peer({ userId: "u1", sessionId: "tab-b", updatedAt: 2 }),
  ]);
  assert(sameUserTwoSessions.length === 2, "same account two sessions stay as two peers");

  const locked = peerLockedObjectIds(
    [peer({ userId: "u2", sessionId: "s2", selectedObjectIds: ["lock-me"] })],
    "local-session",
  );
  assert(locked.has("lock-me"), "peer selection soft-locks object");

  assert(
    shouldShowPeerCursor(
      peer({ userId: "u2", sessionId: "s2", cursorX: 5, cursorY: 5 }),
      { currentSessionId: "local" },
    ),
    "idle peer cursor shown",
  );
  assert(
    !shouldShowPeerCursor(
      peer({ userId: "u2", sessionId: "s2", cursorX: 5, cursorY: 5, selectedObjectIds: ["a"] }),
      { currentSessionId: "local" },
    ),
    "cursor hidden while selecting",
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function liveTwoSession(): Promise<void> {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    assert(false, "missing Supabase URL/key for live realtime");
    return;
  }

  const wallId = `qa-realtime-${Date.now()}`;
  const supabaseA = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });
  const supabaseB = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });

  let bGotPatch = false;
  let bGotFull = false;
  let bGotClear = false;
  let aSawPeer = false;
  let bSawPeer = false;

  const sticker: WallSceneObject = {
    id: "obj-1",
    type: "sticker",
    x: 100,
    y: 120,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    width: 80,
    height: 80,
    stickerId: "basic-star",
  };

  const sessionA = new WallRealtimeSession({
    wallId,
    userId: "qa-user-a",
    sessionId: "qa-session-a",
    displayName: "QA-A",
    color: "#e11",
    supabase: supabaseA,
    onRemoteFull: () => undefined,
    onRemoteClear: () => undefined,
    onRemotePatch: () => undefined,
    onPresenceChange: (peers) => {
      if (peers.some((p) => p.sessionId === "qa-session-b")) aSawPeer = true;
    },
    onSyncEvent: () => undefined,
    getLocalObjects: () => [sticker],
    getLocalMeta: () => ({ wallBounds: { width: 780, height: 1200 } }),
  });

  const sessionB = new WallRealtimeSession({
    wallId,
    userId: "qa-user-b",
    sessionId: "qa-session-b",
    displayName: "QA-B",
    color: "#1e1",
    supabase: supabaseB,
    onRemoteFull: (objects) => {
      if (objects.some((o) => o.id === "obj-1")) bGotFull = true;
    },
    onRemoteClear: () => {
      bGotClear = true;
    },
    onRemotePatch: (id, patch) => {
      if (id === "obj-1" && patch.x === 222) bGotPatch = true;
    },
    onPresenceChange: (peers) => {
      if (peers.some((p) => p.sessionId === "qa-session-a")) bSawPeer = true;
    },
    getLocalObjects: () => [],
    getLocalMeta: () => ({ wallBounds: { width: 780, height: 1200 } }),
  });

  try {
    await sessionA.connect();
    await sessionB.connect();
    await wait(800);

    sessionA.announceJoin();
    sessionB.announceJoin();
    await wait(1200);

    sessionA.broadcastPatch("obj-1", { x: 222, y: 120 });
    await wait(1000);

    sessionA.broadcastFull([sticker]);
    await wait(1000);

    sessionA.updatePresence(40, 50, ["obj-1"], true, true);
    sessionB.updatePresence(60, 70, undefined, false, true);
    await wait(1000);

    sessionA.broadcastClear();
    await wait(1000);

    assert(bGotPatch, "§9.1 #3 B receives A patch");
    assert(bGotFull, "§9.1 #1/#11 B receives A full sync");
    assert(bGotClear, "§9.1 #10 B receives A clear");
    assert(aSawPeer || bSawPeer, "§9.1 Presence peer visible across sessions");
  } finally {
    await sessionA.dispose();
    await sessionB.dispose();
    await supabaseA.removeAllChannels();
    await supabaseB.removeAllChannels();
  }
}

async function main() {
  console.log("\nPhotoWall shared-wall realtime verify\n");
  unitPresence();
  await liveTwoSession();

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nAll shared-wall realtime checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
