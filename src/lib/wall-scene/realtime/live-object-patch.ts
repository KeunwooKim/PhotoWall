import { throttle } from "@/lib/throttle";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import type { WallObjectPatch } from "@/lib/wall-scene/realtime/wall-ydoc";

/** ~30fps live sync while dragging — store commits happen on drag/transform end. */
export const LIVE_PATCH_MS = 32;

export function createLivePatchBroadcaster() {
  return throttle((id: string, patch: WallObjectPatch) => {
    broadcastWallPatch(id, patch);
  }, LIVE_PATCH_MS);
}
