import type { WallRealtimeSession, WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";

let activeSession: WallRealtimeSession | null = null;

export function setActiveWallRealtimeSession(session: WallRealtimeSession | null): void {
  activeSession = session;
}

export function broadcastWallPatch(id: string, patch: WallObjectPatch): void {
  activeSession?.broadcastPatch(id, patch);
}

export function hasActiveWallRealtimeSession(): boolean {
  return activeSession != null;
}
