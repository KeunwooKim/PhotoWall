import type { Viewport } from "pixi-viewport";
import { clampUserZoom, USER_ZOOM_MAX, USER_ZOOM_MIN } from "@/lib/wall-scene/viewport-zoom";
import type { WallViewportSnapshot } from "@/lib/wall-scene/wall-viewport-storage";

export type WallCameraBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function wallCenter(wall: WallCameraBounds): { x: number; y: number } {
  return { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2 };
}

export function fitScaleForWall(viewport: Viewport, wall: WallCameraBounds, padding = 40): number {
  if (wall.width <= 0 || wall.height <= 0) return 1;
  const scaleX = (viewport.screenWidth - padding) / wall.width;
  const scaleY = (viewport.screenHeight - padding) / wall.height;
  return Math.min(1, scaleX, scaleY);
}

/** Absolute Pixi scale range so the wall cannot zoom out past fit. */
export function wallCameraScaleLimits(
  viewport: Viewport,
  wall: WallCameraBounds,
): { minScale: number; maxScale: number } {
  const fit = fitScaleForWall(viewport, wall);
  return {
    minScale: fit * USER_ZOOM_MIN,
    maxScale: fit * USER_ZOOM_MAX,
  };
}

export function applyWallCameraZoomClamp(
  viewport: Viewport,
  wall: WallCameraBounds,
): { minScale: number; maxScale: number } {
  const limits = wallCameraScaleLimits(viewport, wall);
  viewport.clampZoom(limits);
  const sx = viewport.scale.x;
  if (sx < limits.minScale || sx > limits.maxScale) {
    const next = Math.max(limits.minScale, Math.min(limits.maxScale, sx));
    viewport.scale.set(next, next);
  }
  return limits;
}

/** Apply Konva-style camera (userZoom + screen pan) to a Pixi viewport. */
export function applyWallCameraToPixiViewport(
  viewport: Viewport,
  wall: WallCameraBounds,
  camera: WallViewportSnapshot,
): number {
  const fitScale = fitScaleForWall(viewport, wall);
  const zoom = clampUserZoom(camera.userZoom);
  const scale = fitScale * zoom;
  viewport.scale.set(scale, scale);
  applyWallCameraZoomClamp(viewport, wall);
  const center = wallCenter(wall);
  viewport.moveCenter(center.x, center.y);
  const centerScreen = viewport.toScreen(center);
  const targetX = viewport.screenWidth / 2 + camera.panX;
  const targetY = viewport.screenHeight / 2 + camera.panY;
  viewport.position.x += targetX - centerScreen.x;
  viewport.position.y += targetY - centerScreen.y;
  return fitScale;
}

/**
 * Apply camera without refitting — keeps zoom frozen during live wall expand.
 */
export function applyLiveWallCameraToPixiViewport(
  viewport: Viewport,
  wall: WallCameraBounds,
  fitScaleBaseline: number,
  camera: WallViewportSnapshot,
): void {
  const scale = fitScaleBaseline * clampUserZoom(camera.userZoom);
  viewport.scale.set(scale, scale);
  const center = wallCenter(wall);
  viewport.moveCenter(center.x, center.y);
  const centerScreen = viewport.toScreen(center);
  const targetX = viewport.screenWidth / 2 + camera.panX;
  const targetY = viewport.screenHeight / 2 + camera.panY;
  viewport.position.x += targetX - centerScreen.x;
  viewport.position.y += targetY - centerScreen.y;
}

/** Read Konva-style camera from the current Pixi viewport. */
export function readWallCameraFromPixiViewport(
  viewport: Viewport,
  wall: WallCameraBounds,
  fitScale: number,
): WallViewportSnapshot {
  const centerScreen = viewport.toScreen(wallCenter(wall));
  return {
    userZoom: clampUserZoom(viewport.scale.x / Math.max(fitScale, 0.0001)),
    panX: centerScreen.x - viewport.screenWidth / 2,
    panY: centerScreen.y - viewport.screenHeight / 2,
  };
}

export function camerasNear(
  a: WallViewportSnapshot,
  b: WallViewportSnapshot,
  panEpsilon = 0.75,
  zoomEpsilon = 0.001,
): boolean {
  return (
    Math.abs(a.panX - b.panX) < panEpsilon &&
    Math.abs(a.panY - b.panY) < panEpsilon &&
    Math.abs(a.userZoom - b.userZoom) < zoomEpsilon
  );
}
