import {
  DEFAULT_WALL_BOUNDS,
  getSceneObjectsBounds,
  WALL_EXPAND_MARGIN,
  type WallBounds,
} from "@/lib/wall-bounds";
import { memorySafeWallMax } from "@/lib/wall-device";
import { computeOmniWallFollowFromContent } from "@/lib/wall-scene/wall-omni-expand";
import { getWallNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { broadcastWallLive } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";
import { throttle } from "@/lib/throttle";
import { LIVE_PATCH_MS } from "@/lib/wall-scene/realtime/live-object-patch";
import { allowWallSizeChange } from "@/lib/wall-scene/wall-size-lock";

export type LiveWallLayout = {
  bounds: WallBounds;
  panX: number;
  panY: number;
  wallpaperOffsetX: number;
  wallpaperOffsetY: number;
  viewportScale: number;
};

export type LiveWallLayoutApplier = (layout: LiveWallLayout) => void;

/** Grows/shrinks during drag without Zustand — avoids React re-renders that flash images. */
let liveWallBoundsDuringDrag: WallBounds | null = null;
let liveWallLayoutApplier: LiveWallLayoutApplier | null = null;
/** Imperative pan baked on commit — keeps finger lock when the centered wall grows. */
let livePanX = 0;
let livePanY = 0;
/** Who owns the live bounds preview — remote must not fight a local drag session. */
let liveBoundsSource: "local" | "remote" | null = null;

/** Skip sub-pixel stage thrash. */
const LIVE_EXPAND_MIN_DELTA = 1;

/**
 * @deprecated Center-origin walls never shift content. Kept so Konva/Pixi
 * can still register no-ops without branching call sites.
 */
export function setLiveContentShiftMode(mode: "immediate" | "deferred"): void {
  void mode;
}

export function registerLiveContentShiftListener(
  listener: ((dx: number, dy: number) => void) | null,
): void {
  void listener;
}

const broadcastLiveWall = throttle(
  (payload: {
    wallBounds: WallBounds;
    wallpaperOffset: { x: number; y: number };
    wallSizeLocked?: boolean;
    positions?: Array<{ id: string; x: number; y: number }>;
  }) => {
    broadcastWallLive(payload);
  },
  LIVE_PATCH_MS,
);

export function registerLiveWallBoundsApplier(applier: LiveWallLayoutApplier | null): void {
  liveWallLayoutApplier = applier;
}

/** Reset live offsets at drag start. */
export function beginLiveWallExpandSession(): void {
  liveBoundsSource = "local";
  liveWallBoundsDuringDrag = null;
  livePanX = 0;
  livePanY = 0;
}

export function endLiveWallExpandSession(): void {
  // clear happens on commit/revert
}

function clearLiveOffsets(): void {
  liveWallBoundsDuringDrag = null;
  livePanX = 0;
  livePanY = 0;
  liveBoundsSource = null;
  broadcastLiveWall.flush();
}

/**
 * Peer is live-expanding — update stage imperatively (no Zustand).
 */
export function applyRemoteWallLivePreview(live: {
  wallBounds: WallBounds;
  wallpaperOffset?: { x: number; y: number };
  wallSizeLocked?: boolean;
}): void {
  if (liveBoundsSource === "local") return;

  const store = useWallSceneStore.getState();
  const base = store.document.meta;
  const locked =
    base.wallSizeLocked === true || live.wallSizeLocked === true;
  const nextBounds = locked ? base.wallBounds : live.wallBounds;
  const baseWp = base.wallpaperOffset ?? { x: 0, y: 0 };
  const nextWp = locked ? baseWp : (live.wallpaperOffset ?? baseWp);

  liveBoundsSource = "remote";
  liveWallBoundsDuringDrag = nextBounds;
  // Center-origin: keep the camera still during live expand — pan tracking
  // fights object drag and stops further growth.
  livePanX = 0;
  livePanY = 0;

  liveWallLayoutApplier?.({
    bounds: nextBounds,
    panX: store.panX,
    panY: store.panY,
    wallpaperOffsetX: nextWp.x,
    wallpaperOffsetY: nextWp.y,
    viewportScale: store.viewportScale,
  });
}

export function clearRemoteWallLivePreview(): void {
  if (liveBoundsSource !== "remote") return;
  clearLiveOffsets();
}

export function refreshWallLayoutFromStore(): void {
  restoreLayoutFromStore();
}

export function getEffectiveWallBounds(): WallBounds {
  return liveWallBoundsDuringDrag ?? useWallSceneStore.getState().document.meta.wallBounds;
}

export function getEffectivePan(): { x: number; y: number } {
  const store = useWallSceneStore.getState();
  return { x: store.panX + livePanX, y: store.panY + livePanY };
}

export function getEffectiveWallpaperOffset(): { x: number; y: number } {
  return useWallSceneStore.getState().document.meta.wallpaperOffset ?? { x: 0, y: 0 };
}

export function isLiveWallBoundsActive(): boolean {
  return liveWallBoundsDuringDrag != null;
}

function objectsWithLivePositions(): WallSceneObject[] {
  const { document } = useWallSceneStore.getState();
  return document.objects.map((object) => {
    const node = getWallNode(object.id);
    if (!node) return object;
    return {
      ...object,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
    } as WallSceneObject;
  });
}

function pushLiveLayout(bounds: WallBounds): void {
  liveBoundsSource = "local";
  liveWallBoundsDuringDrag = bounds;
  const store = useWallSceneStore.getState();
  const wallpaper = store.document.meta.wallpaperOffset ?? { x: 0, y: 0 };
  liveWallLayoutApplier?.({
    bounds,
    panX: store.panX,
    panY: store.panY,
    wallpaperOffsetX: wallpaper.x,
    wallpaperOffsetY: wallpaper.y,
    viewportScale: store.viewportScale,
  });

  broadcastLiveWall({
    wallBounds: bounds,
    wallpaperOffset: wallpaper,
    wallSizeLocked: store.document.meta.wallSizeLocked,
  });
}

function restoreLayoutFromStore(): void {
  const store = useWallSceneStore.getState();
  const bounds = store.document.meta.wallBounds;
  const wallpaper = store.document.meta.wallpaperOffset ?? { x: 0, y: 0 };
  liveWallLayoutApplier?.({
    bounds,
    panX: store.panX,
    panY: store.panY,
    wallpaperOffsetX: wallpaper.x,
    wallpaperOffsetY: wallpaper.y,
    viewportScale: store.viewportScale,
  });
}

let konvaDragOffsetSync: ((evt?: Event) => void) | null = null;
let pixiDragOffsetSync: ((evt?: Event) => void) | null = null;

export function registerKonvaDragOffsetSync(fn: ((evt?: Event) => void) | null): void {
  konvaDragOffsetSync = fn;
}

export function registerPixiDragOffsetSync(fn: ((evt?: Event) => void) | null): void {
  pixiDragOffsetSync = fn;
}

function syncDragOffsetsAfterWallExpand(evt?: Event): void {
  konvaDragOffsetSync?.(evt);
  pixiDragOffsetSync?.(evt);
}

/**
 * Live omni grow/shrink while dragging.
 * Center-origin: only the wall AABB moves — objects keep world coordinates.
 * Same-edge reclaim stays on so pulling back shrinks naturally; expanding the
 * opposite side does not drag the far edge (see computeOmniWallFollowFromContent).
 */
export function applyWallExpandDuringDrag(
  movingIds: Iterable<string>,
  options?: { allowReclaim?: boolean },
): boolean {
  const ids = movingIds instanceof Set ? movingIds : new Set(movingIds);
  if (ids.size === 0) return false;

  // Default on — callers may pass false for grow-only previews.
  const allowReclaim = options?.allowReclaim !== false;
  const current = getEffectiveWallBounds();
  const liveObjects = objectsWithLivePositions();
  const objectBounds = getSceneObjectsBounds(liveObjects);
  const grow = computeOmniWallFollowFromContent(
    objectBounds,
    current,
    memorySafeWallMax(),
    WALL_EXPAND_MARGIN,
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    allowReclaim,
  );
  if (!grow) return false;

  const { bounds } = grow;
  const dW = bounds.width - current.width;
  const dH = bounds.height - current.height;
  const dX = bounds.x - current.x;
  const dY = bounds.y - current.y;
  if (
    Math.abs(dW) < LIVE_EXPAND_MIN_DELTA &&
    Math.abs(dH) < LIVE_EXPAND_MIN_DELTA &&
    Math.abs(dX) < LIVE_EXPAND_MIN_DELTA &&
    Math.abs(dY) < LIVE_EXPAND_MIN_DELTA
  ) {
    return false;
  }

  const isGrow =
    dW > LIVE_EXPAND_MIN_DELTA ||
    dH > LIVE_EXPAND_MIN_DELTA ||
    dX < -LIVE_EXPAND_MIN_DELTA ||
    dY < -LIVE_EXPAND_MIN_DELTA;

  if (isGrow && !allowWallSizeChange()) {
    return false;
  }

  // Do not adjust pan/camera during expand — world-stable objects + a moving
  // viewport fight the finger and make growth stop after one step.
  pushLiveLayout(bounds);
  return true;
}

/**
 * On drag end: bake live bounds into the store.
 * No object position patches for stationary nodes (world coords are stable).
 * No pan changes — the viewport stays world-locked through expand/shrink.
 */
export function applyOmniWallExpandAfterDrag(movingIds: Iterable<string>): boolean {
  const ids = movingIds instanceof Set ? movingIds : new Set(movingIds);
  applyWallExpandDuringDrag(ids, { allowReclaim: true });

  const store = useWallSceneStore.getState();
  const hadLive = liveWallBoundsDuringDrag != null;

  if (!hadLive) return false;

  const bounds = liveWallBoundsDuringDrag ?? store.document.meta.wallBounds;

  store.setWallBounds(bounds);

  if (
    bounds.width <= DEFAULT_WALL_BOUNDS.width &&
    bounds.height <= DEFAULT_WALL_BOUNDS.height &&
    Math.abs(bounds.x - DEFAULT_WALL_BOUNDS.x) < 1 &&
    Math.abs(bounds.y - DEFAULT_WALL_BOUNDS.y) < 1
  ) {
    store.setWallBounds({ ...DEFAULT_WALL_BOUNDS });
  }

  clearLiveOffsets();
  restoreLayoutFromStore();
  return true;
}

export function scheduleWallExpandDuringDrag(
  movingIds: Iterable<string>,
  evt?: Event,
): void {
  const grew = applyWallExpandDuringDrag(movingIds);
  if (grew) syncDragOffsetsAfterWallExpand(evt);
}

export function cancelWallExpandDuringDrag(): void {
  // Sync path — nothing async to cancel.
}

export function commitLiveWallBoundsToStore(): void {
  applyOmniWallExpandAfterDrag([]);
}

export function revertLiveWallBounds(): void {
  clearLiveOffsets();
  restoreLayoutFromStore();

  const store = useWallSceneStore.getState();
  const wallpaper = store.document.meta.wallpaperOffset ?? { x: 0, y: 0 };
  broadcastWallLive({
    wallBounds: store.document.meta.wallBounds,
    wallpaperOffset: wallpaper,
  });
}
