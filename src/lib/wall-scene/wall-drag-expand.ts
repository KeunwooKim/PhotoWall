import {
  DEFAULT_WALL_BOUNDS,
  getSceneObjectsBounds,
  WALL_EXPAND_MARGIN,
  type WallBounds,
} from "@/lib/wall-bounds";
import { memorySafeWallMax } from "@/lib/konva-device";
import { computeOmniWallFollowFromContent } from "@/lib/wall-scene/wall-omni-expand";
import { getWallNode } from "@/lib/wall-scene/realtime/wall-node-sync";
import { broadcastWallPatch } from "@/lib/wall-scene/realtime/wall-realtime-bridge";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallSceneObject } from "@/types/wall-scene-v2";
import { DD } from "konva/lib/DragAndDrop";

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
/** Accumulated content shift applied to nodes during this drag (west/north). */
let liveContentShiftX = 0;
let liveContentShiftY = 0;
/** Imperative pan baked on commit — keeps finger lock when the centered wall grows. */
let livePanX = 0;
let livePanY = 0;
let contentShiftListener: ((dx: number, dy: number) => void) | null = null;

/** Skip sub-pixel stage thrash. */
const LIVE_EXPAND_MIN_DELTA = 1;

export function registerLiveWallBoundsApplier(applier: LiveWallLayoutApplier | null): void {
  liveWallLayoutApplier = applier;
}

/** group-drag updates session start positions when live west/north shifts content. */
export function registerLiveContentShiftListener(
  listener: ((dx: number, dy: number) => void) | null,
): void {
  contentShiftListener = listener;
}

/** Reset live offsets at drag start. */
export function beginLiveWallExpandSession(): void {
  liveWallBoundsDuringDrag = null;
  liveContentShiftX = 0;
  liveContentShiftY = 0;
  livePanX = 0;
  livePanY = 0;
}

export function endLiveWallExpandSession(): void {
  // clear happens on commit/revert
}

/** Wall bounds for clamping / layout — live preview wins while dragging. */
export function getEffectiveWallBounds(): WallBounds {
  return liveWallBoundsDuringDrag ?? useWallSceneStore.getState().document.meta.wallBounds;
}

export function isLiveWallBoundsActive(): boolean {
  return liveWallBoundsDuringDrag != null;
}

function objectsWithLivePositions(): WallSceneObject[] {
  const { document } = useWallSceneStore.getState();
  // Prefer Konva node transforms for every object — west/north live shift moves
  // stationary nodes too, and store positions lag until commit.
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

function readBaseWallpaperOffset(): { x: number; y: number } {
  return useWallSceneStore.getState().document.meta.wallpaperOffset ?? { x: 0, y: 0 };
}

function pushLiveLayout(bounds: WallBounds): void {
  liveWallBoundsDuringDrag = bounds;
  const store = useWallSceneStore.getState();
  const wallpaper = readBaseWallpaperOffset();
  liveWallLayoutApplier?.({
    bounds,
    panX: store.panX + livePanX,
    panY: store.panY + livePanY,
    wallpaperOffsetX: wallpaper.x + liveContentShiftX,
    wallpaperOffsetY: wallpaper.y + liveContentShiftY,
    viewportScale: store.viewportScale,
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

function clearLiveOffsets(): void {
  liveWallBoundsDuringDrag = null;
  liveContentShiftX = 0;
  liveContentShiftY = 0;
  livePanX = 0;
  livePanY = 0;
}

/**
 * After live wall/pan changes, Konva's pointer→node drag offset is stale.
 * Rebind offset to the current pointer so the next move does not undo west/north shift.
 */
export function syncKonvaDragOffsets(evt?: Event): void {
  DD._dragElements.forEach((elem) => {
    if (elem.dragStatus !== "dragging" && elem.dragStatus !== "ready") return;
    const node = elem.node;
    const stage = node.getStage();
    if (!stage) return;
    if (evt) {
      stage.setPointersPositions(evt);
    }
    const pos =
      stage._getPointerById(elem.pointerId) || stage.getPointerPosition();
    if (!pos) return;
    const ap = node.getAbsolutePosition();
    elem.offset.x = pos.x - ap.x;
    elem.offset.y = pos.y - ap.y;
  });
}

/**
 * Live omni grow/shrink while dragging.
 * Shrinks when content leaves an edge; never shrinks an axis while pressing it.
 */
export function applyWallExpandDuringDrag(movingIds: Iterable<string>): boolean {
  const ids = movingIds instanceof Set ? movingIds : new Set(movingIds);
  if (ids.size === 0) return false;

  const current = getEffectiveWallBounds();
  const liveObjects = objectsWithLivePositions();
  const objectBounds = getSceneObjectsBounds(liveObjects);
  const home = useWallSceneStore.getState().document.meta.homeOrigin ?? { x: 0, y: 0 };
  const grow = computeOmniWallFollowFromContent(
    objectBounds,
    current,
    memorySafeWallMax(),
    WALL_EXPAND_MARGIN,
    {
      // Prior west/north expands (persisted) + this drag's live shifts.
      x: home.x + liveContentShiftX,
      y: home.y + liveContentShiftY,
    },
  );
  if (!grow) return false;

  const { shiftX, shiftY, bounds } = grow;
  const dW = bounds.width - current.width;
  const dH = bounds.height - current.height;
  if (
    Math.abs(dW) < LIVE_EXPAND_MIN_DELTA &&
    Math.abs(dH) < LIVE_EXPAND_MIN_DELTA &&
    shiftX === 0 &&
    shiftY === 0
  ) {
    return false;
  }

  if (shiftX !== 0 || shiftY !== 0) {
    for (const object of liveObjects) {
      const node = getWallNode(object.id);
      if (!node) continue;
      node.position({ x: node.x() + shiftX, y: node.y() + shiftY });
    }
    liveContentShiftX += shiftX;
    liveContentShiftY += shiftY;
    contentShiftListener?.(shiftX, shiftY);
  }

  // Keep the opposite edges of the wall fixed on screen (center-anchored wrapper).
  // East grow → left stays; north grow (with shift) → bottom stays.
  const scale = useWallSceneStore.getState().viewportScale;
  livePanX += (dW / 2 - shiftX) * scale;
  livePanY += (dH / 2 - shiftY) * scale;

  pushLiveLayout(bounds);
  return true;
}

/**
 * On drag end: finish any pending omni adjust, bake live pan/wallpaper/bounds into the store,
 * and persist shifts for non-moving objects.
 */
export function applyOmniWallExpandAfterDrag(movingIds: Iterable<string>): boolean {
  const ids = movingIds instanceof Set ? movingIds : new Set(movingIds);
  applyWallExpandDuringDrag(ids);

  const store = useWallSceneStore.getState();
  const hadLive =
    liveWallBoundsDuringDrag != null ||
    liveContentShiftX !== 0 ||
    liveContentShiftY !== 0 ||
    livePanX !== 0 ||
    livePanY !== 0;

  if (!hadLive) return false;

  const shiftX = liveContentShiftX;
  const shiftY = liveContentShiftY;
  const bounds = liveWallBoundsDuringDrag ?? store.document.meta.wallBounds;

  if (shiftX !== 0 || shiftY !== 0) {
    for (const object of store.document.objects) {
      if (ids.has(object.id)) continue;
      const node = getWallNode(object.id);
      const x = node?.x() ?? object.x + shiftX;
      const y = node?.y() ?? object.y + shiftY;
      store.patchObject(object.id, { x, y });
      broadcastWallPatch(object.id, { x, y });
    }
    store.shiftWallHomeAnchors(shiftX, shiftY);
  }

  if (livePanX !== 0 || livePanY !== 0) {
    store.addPan(livePanX, livePanY);
  }

  store.setWallBounds(bounds);

  if (
    bounds.width <= DEFAULT_WALL_BOUNDS.width &&
    bounds.height <= DEFAULT_WALL_BOUNDS.height
  ) {
    store.normalizeWallHomeOrigin();
    for (const object of useWallSceneStore.getState().document.objects) {
      getWallNode(object.id)?.position({ x: object.x, y: object.y });
    }
  }

  clearLiveOffsets();
  return true;
}

/** Apply live wall adjust during drag; rebind Konva drag offsets when layout changes. */
export function scheduleWallExpandDuringDrag(
  movingIds: Iterable<string>,
  evt?: Event,
): void {
  const grew = applyWallExpandDuringDrag(movingIds);
  if (grew) syncKonvaDragOffsets(evt);
}

export function cancelWallExpandDuringDrag(): void {
  // Sync path — nothing async to cancel.
}

/** Persist live preview into the store (call once at drag end). */
export function commitLiveWallBoundsToStore(): void {
  applyOmniWallExpandAfterDrag([]);
}

/** Drop live preview and restore stage to stored bounds (drag cancel). */
export function revertLiveWallBounds(): void {
  if (liveContentShiftX !== 0 || liveContentShiftY !== 0) {
    const { document } = useWallSceneStore.getState();
    for (const object of document.objects) {
      const node = getWallNode(object.id);
      if (!node) continue;
      node.position({
        x: node.x() - liveContentShiftX,
        y: node.y() - liveContentShiftY,
      });
    }
  }
  clearLiveOffsets();
  restoreLayoutFromStore();
}
