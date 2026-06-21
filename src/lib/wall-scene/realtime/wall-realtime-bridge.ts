import type { WallRealtimeSession, WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";
import { createRtLogThrottle, rtLog, rtWarn } from "@/lib/wall-scene/realtime/wall-realtime-log";

let activeSession: WallRealtimeSession | null = null;
const logNoSession = createRtLogThrottle(2000);

export function setActiveWallRealtimeSession(session: WallRealtimeSession | null): void {
  activeSession = session;
  rtLog(session ? "session active (ready to send)" : "session cleared (cannot send)", {
    hasSession: !!session,
  });
}

export function broadcastWallPatch(id: string, patch: WallObjectPatch): void {
  if (!activeSession) {
    logNoSession("broadcast skipped — no active session (not connected yet?)", {
      objectId: id,
    });
    return;
  }

  activeSession.broadcastPatch(id, patch);
}

export function hasActiveWallRealtimeSession(): boolean {
  return activeSession != null;
}
