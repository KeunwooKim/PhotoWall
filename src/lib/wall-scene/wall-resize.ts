import {
  DEFAULT_WALL_BOUNDS,
  WALL_EXPAND_STEP,
  getSceneObjectsBounds,
  type WallBounds,
} from "@/lib/wall-bounds";
import { memorySafeWallMax } from "@/lib/konva-device";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import {
  computeCenteredWallExpand,
  computeCenteredWallShrink,
  shiftSceneObject,
  type OmniWallGrow,
} from "@/lib/wall-scene/wall-omni-expand";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { getWallNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import { allowWallSizeChange } from "@/lib/wall-scene/wall-size-lock";

function safeMax(): WallBounds {
  return memorySafeWallMax();
}

function applyOmniGrow(grow: OmniWallGrow): void {
  const store = useWallSceneStore.getState();
  const { shiftX, shiftY, bounds } = grow;
  const prev = store.document.meta.wallBounds;

  if (shiftX !== 0 || shiftY !== 0) {
    for (const object of store.document.objects) {
      const next = shiftSceneObject(object, shiftX, shiftY);
      if (next === object) continue;
      const node = getWallNode(object.id);
      node?.position({ x: next.x, y: next.y });
      store.patchObject(object.id, { x: next.x, y: next.y });
      broadcastWallPatch(object.id, { x: next.x, y: next.y });
    }
    store.shiftWallHomeAnchors(shiftX, shiftY);
  }

  // Keep opposite edges fixed under a center-anchored stage.
  const scale = store.viewportScale;
  const dW = bounds.width - prev.width;
  const dH = bounds.height - prev.height;
  store.addPan((dW / 2 - shiftX) * scale, (dH / 2 - shiftY) * scale);

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

  if (
    bounds.width <= DEFAULT_WALL_BOUNDS.width &&
    bounds.height <= DEFAULT_WALL_BOUNDS.height
  ) {
    store.normalizeWallHomeOrigin();
    const normalized = useWallSceneStore.getState().document;
    for (const object of normalized.objects) {
      const node = getWallNode(object.id);
      node?.position({ x: object.x, y: object.y });
    }
  }
}

/** Grow wall on east/south (home top-left stays fixed). */
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

/** Shrink wall toward default (reclaims left/up home budget when present). */
export function applyShrinkWall(): boolean {
  if (!allowWallSizeChange()) return false;
  const store = useWallSceneStore.getState();
  const current = store.document.meta.wallBounds;
  const objectBounds = getSceneObjectsBounds(store.document.objects);
  const home = store.document.meta.homeOrigin ?? { x: 0, y: 0 };
  const grow = computeCenteredWallShrink(current, objectBounds, safeMax(), WALL_EXPAND_STEP, home);
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
      document.meta.homeOrigin ?? { x: 0, y: 0 },
    ) != null
  );
}
