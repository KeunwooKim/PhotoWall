export const CANVAS_MIN_ZOOM = 0.5;
export const CANVAS_MAX_ZOOM = 4;

export function clampCanvasZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, zoom));
}

export interface WorkspaceViewport {
  cleanup: () => void;
  reset: () => void;
  setScale: (scale: number) => void;
  getScale: () => number;
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/** Pinch/pan zoom on the wall stage (CSS transform) — Figma-style workspace. */
export function setupWorkspacePinchZoom(
  workspace: HTMLElement,
  stage: HTMLElement,
  onZoomChange?: (zoom: number) => void,
): WorkspaceViewport {
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let pinchDistance = 0;
  let pinchActive = false;
  let isPanning = false;
  let lastPan = { x: 0, y: 0 };
  let lastTapAt = 0;
  let zoomRaf = 0;

  const applyTransform = () => {
    stage.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${scale})`;
  };

  const notifyZoom = () => {
    if (!onZoomChange) return;
    cancelAnimationFrame(zoomRaf);
    zoomRaf = requestAnimationFrame(() => onZoomChange(clampCanvasZoom(scale)));
  };

  const setScale = (next: number) => {
    scale = clampCanvasZoom(next);
    applyTransform();
    notifyZoom();
  };

  const reset = () => {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
    notifyZoom();
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      pinchActive = true;
      isPanning = false;
      pinchDistance = touchDistance(e.touches);
      return;
    }

    if (e.touches.length === 1 && scale > 1.01) {
      isPanning = true;
      lastPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && pinchDistance > 0) {
      e.preventDefault();
      e.stopPropagation();
      const distance = touchDistance(e.touches);
      if (distance <= 0) return;
      setScale(scale * (distance / pinchDistance));
      pinchDistance = distance;
      return;
    }

    if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      panX += touch.clientX - lastPan.x;
      panY += touch.clientY - lastPan.y;
      lastPan = { x: touch.clientX, y: touch.clientY };
      applyTransform();
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinchDistance = 0;

    if (pinchActive && e.touches.length === 0) {
      pinchActive = false;
      lastTapAt = 0;
      notifyZoom();
      return;
    }

    if (e.touches.length === 0) isPanning = false;

    if (e.touches.length === 0 && e.changedTouches.length === 1 && !pinchActive) {
      const now = Date.now();
      if (now - lastTapAt < 280) {
        reset();
        lastTapAt = 0;
        return;
      }
      lastTapAt = now;
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setScale(scale * factor);
  };

  applyTransform();

  const opts: AddEventListenerOptions = { passive: false, capture: true };
  workspace.addEventListener("touchstart", onTouchStart, opts);
  workspace.addEventListener("touchmove", onTouchMove, opts);
  workspace.addEventListener("touchend", onTouchEnd, opts);
  workspace.addEventListener("touchcancel", onTouchEnd, opts);
  workspace.addEventListener("wheel", onWheel, opts);

  return {
    setScale,
    getScale: () => scale,
    reset,
    cleanup: () => {
      cancelAnimationFrame(zoomRaf);
      workspace.removeEventListener("touchstart", onTouchStart, opts);
      workspace.removeEventListener("touchmove", onTouchMove, opts);
      workspace.removeEventListener("touchend", onTouchEnd, opts);
      workspace.removeEventListener("touchcancel", onTouchEnd, opts);
      workspace.removeEventListener("wheel", onWheel, opts);
    },
  };
}
