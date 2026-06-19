import type { Canvas as FabricCanvas, Point as FabricPoint } from "fabric";

export const CANVAS_MIN_ZOOM = 0.5;
export const CANVAS_MAX_ZOOM = 4;

type FabricRuntime = {
  Point: new (x: number, y: number) => FabricPoint;
};

export function clampCanvasZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, zoom));
}

export function resetCanvasViewport(canvas: FabricCanvas): void {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.requestRenderAll();
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function touchCenter(touches: TouchList, rect: DOMRect): { x: number; y: number } {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
  };
}

/**
 * Pinch-to-zoom on the wall canvas. Uses Fabric's zoomToPoint after the canvas exists.
 * Does not touch React state during gestures (call onZoomChange via rAF only).
 */
export function setupCanvasPinchZoom(
  container: HTMLElement,
  canvas: FabricCanvas,
  fabric: FabricRuntime,
  onZoomChange?: (zoom: number) => void,
): () => void {
  let pinchDistance = 0;
  let pinchActive = false;
  let lastTapAt = 0;
  let zoomRaf = 0;

  const notifyZoom = (zoom: number) => {
    if (!onZoomChange) return;
    cancelAnimationFrame(zoomRaf);
    zoomRaf = requestAnimationFrame(() => onZoomChange(clampCanvasZoom(zoom)));
  };

  const applyZoom = (center: { x: number; y: number }, nextZoom: number) => {
    const clamped = clampCanvasZoom(nextZoom);
    canvas.zoomToPoint(new fabric.Point(center.x, center.y), clamped);
    notifyZoom(clamped);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 2) return;

    try {
      e.preventDefault();
      e.stopPropagation();
      pinchActive = true;
      pinchDistance = touchDistance(e.touches);
      if (pinchDistance <= 0) return;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    } catch {
      pinchActive = false;
      pinchDistance = 0;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || pinchDistance <= 0) return;

    try {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const distance = touchDistance(e.touches);
      if (distance <= 0) return;

      const center = touchCenter(e.touches, rect);
      const scale = distance / pinchDistance;
      applyZoom(center, canvas.getZoom() * scale);
      pinchDistance = distance;
    } catch {
      pinchDistance = 0;
      pinchActive = false;
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    try {
      if (e.touches.length < 2) {
        pinchDistance = 0;
      }

      if (pinchActive && e.touches.length === 0) {
        pinchActive = false;
        lastTapAt = 0;
        notifyZoom(canvas.getZoom());
        return;
      }

      if (e.touches.length === 0 && e.changedTouches.length === 1 && !pinchActive) {
        const now = Date.now();
        if (now - lastTapAt < 280) {
          resetCanvasViewport(canvas);
          notifyZoom(1);
          lastTapAt = 0;
          return;
        }
        lastTapAt = now;
      }
    } catch {
      pinchActive = false;
      pinchDistance = 0;
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;

    try {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      applyZoom(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        canvas.getZoom() * factor,
      );
    } catch {
      // ignore wheel zoom errors
    }
  };

  const opts: AddEventListenerOptions = { passive: false, capture: true };
  container.addEventListener("touchstart", onTouchStart, opts);
  container.addEventListener("touchmove", onTouchMove, opts);
  container.addEventListener("touchend", onTouchEnd, opts);
  container.addEventListener("touchcancel", onTouchEnd, opts);
  container.addEventListener("wheel", onWheel, opts);

  return () => {
    cancelAnimationFrame(zoomRaf);
    container.removeEventListener("touchstart", onTouchStart, opts);
    container.removeEventListener("touchmove", onTouchMove, opts);
    container.removeEventListener("touchend", onTouchEnd, opts);
    container.removeEventListener("touchcancel", onTouchEnd, opts);
    container.removeEventListener("wheel", onWheel, opts);
  };
}
