import {
  DEFAULT_WALL_BOUNDS,
  WALL_EXPAND_STEP,
  getSceneObjectsBounds,
  type WallBounds,
} from "@/lib/wall-bounds";
import { memorySafeWallMax } from "@/lib/wall-device";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import {
  computeCenteredWallExpand,
  computeCenteredWallShrink,
  type OmniWallGrow,
} from "@/lib/wall-scene/wall-omni-expand";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { getWallNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { allowWallSizeChange } from "@/lib/wall-scene/wall-size-lock";

function safeMax(): Pick<WallBounds, "width" | "height"> {
  return memorySafeWallMax();
}

function applyOmniGrow(grow: OmniWallGrow): void {
  const store = useWallSceneStore.getState();
  const { bounds } = grow;
  // World-locked view: do not addPan when the wall AABB changes.
  store.setWallBounds(bounds);

  const latest = useWallSceneStore.getState().document.objects;
  for (const object of latest) {
    const clamped = hardClampObjectPositionToWall(object, bounds);
    if (!clamped) continue;
    const node = getWallNode(object.id);
    node?.position({ x: clamped.x, y: clamped.y });
    store.patchObject(object.id, clamped);
    broadcastWallPatch(object.id, clamped);
  }
}

/** Grow wall on east/south (home center stays put when possible). */
export function applyExpandWall(): boolean {
  if (!allowWallSizeChange()) return false;
  const store = useWallSceneStore.getState();
  const grow = computeCenteredWallExpand(store.document.meta.wallBounds, safeMax());
  if (!grow) return false;
  store.recordHistory();
  applyOmniGrow(grow);
  store.bumpRevision();
  return true;
}

/** Shrink wall toward default home frame. */
export function applyShrinkWall(): boolean {
  if (!allowWallSizeChange()) return false;
  const store = useWallSceneStore.getState();
  const current = store.document.meta.wallBounds;
  const objectBounds = getSceneObjectsBounds(store.document.objects);
  const grow = computeCenteredWallShrink(current, objectBounds, safeMax(), WALL_EXPAND_STEP);
  if (!grow) return false;

  store.recordHistory();
  applyOmniGrow(grow);
  store.bumpRevision();
  return true;
}

export function canExpandWall(): boolean {
  const current = useWallSceneStore.getState().document.meta.wallBounds;
  return computeCenteredWallExpand(current, safeMax()) != null;
}

export function canShrinkWall(): boolean {
  const { document } = useWallSceneStore.getState();
  return (
    computeCenteredWallShrink(
      document.meta.wallBounds,
      getSceneObjectsBounds(document.objects),
      safeMax(),
      WALL_EXPAND_STEP,
    ) != null
  );
}

export function isDefaultWallSize(bounds: WallBounds = useWallSceneStore.getState().document.meta.wallBounds): boolean {
  return (
    bounds.width <= DEFAULT_WALL_BOUNDS.width &&
    bounds.height <= DEFAULT_WALL_BOUNDS.height
  );
}
