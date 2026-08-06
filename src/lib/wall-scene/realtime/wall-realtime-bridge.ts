import type {
  WallRealtimeSession,
  WallObjectPatch,
  WallLiveSync,
} from "@/lib/wall-scene/realtime/wall-ydoc";

let activeSession: WallRealtimeSession | null = null;

export function setActiveWallRealtimeSession(session: WallRealtimeSession | null): void {
  activeSession = session;
}

export function broadcastWallPatch(id: string, patch: WallObjectPatch): void {
  activeSession?.broadcastPatch(id, patch);
}

export function broadcastWallLive(live: WallLiveSync): void {
  activeSession?.broadcastWallLive(live);
}

export function hasActiveWallRealtimeSession(): boolean {
  return activeSession != null;
}
