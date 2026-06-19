import { Point, type Canvas as FabricCanvas } from "fabric";

export const CANVAS_MIN_ZOOM = 0.5;
export const CANVAS_MAX_ZOOM = 4;

export function clampCanvasZoom(zoom: number): number {
  return Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, zoom));
}

export function resetCanvasViewport(canvas: FabricCanvas): void {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.requestRenderAll();
}

export function zoomCanvasToPoint(
  canvas: FabricCanvas,
  point: { x: number; y: number },
  zoom: number,
): number {
  const clamped = clampCanvasZoom(zoom);
  canvas.zoomToPoint(new Point(point.x, point.y), clamped);
  canvas.requestRenderAll();
  return clamped;
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

export function setupCanvasPinchZoom(
  container: HTMLElement,
  getCanvas: () => FabricCanvas | null,
  onZoomChange?: (zoom: number) => void,
): () => void {
  let pinchDistance = 0;
  let isPanning = false;
  let lastPan = { x: 0, y: 0 };
  let lastTapAt = 0;

  const notifyZoom = () => {
    const canvas = getCanvas();
    if (canvas) onZoomChange?.(canvas.getZoom());
  };

  const onTouchStart = (e: TouchEvent) => {
    const canvas = getCanvas();
    if (!canvas) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      pinchDistance = touchDistance(e.touches);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return;
    }

    if (e.touches.length === 1 && canvas.getZoom() > 1.01) {
      const touch = e.touches[0];
      const target = canvas.findTarget({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
      if (!target) {
        isPanning = true;
        lastPan = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    const canvas = getCanvas();
    if (!canvas) return;

    if (e.touches.length === 2 && pinchDistance > 0) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const distance = touchDistance(e.touches);
      const center = touchCenter(e.touches, rect);
      const scale = distance / pinchDistance;
      zoomCanvasToPoint(canvas, center, canvas.getZoom() * scale);
      pinchDistance = distance;
      notifyZoom();
      return;
    }

    if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const vpt = canvas.viewportTransform;
      if (!vpt) return;
      vpt[4] += touch.clientX - lastPan.x;
      vpt[5] += touch.clientY - lastPan.y;
      canvas.requestRenderAll();
      lastPan = { x: touch.clientX, y: touch.clientY };
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    const canvas = getCanvas();
    if (!canvas) return;

    if (e.touches.length < 2) pinchDistance = 0;
    if (e.touches.length === 0) isPanning = false;

    if (e.touches.length === 0 && e.changedTouches.length === 1) {
      const now = Date.now();
      if (now - lastTapAt < 280) {
        resetCanvasViewport(canvas);
        notifyZoom();
      }
      lastTapAt = now;
    }
  };

  const onWheel = (e: WheelEvent) => {
    const canvas = getCanvas();
    if (!canvas || !e.ctrlKey) return;

    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    zoomCanvasToPoint(canvas, point, canvas.getZoom() * factor);
    notifyZoom();
  };

  container.addEventListener("touchstart", onTouchStart, { passive: false });
  container.addEventListener("touchmove", onTouchMove, { passive: false });
  container.addEventListener("touchend", onTouchEnd);
  container.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    container.removeEventListener("touchstart", onTouchStart);
    container.removeEventListener("touchmove", onTouchMove);
    container.removeEventListener("touchend", onTouchEnd);
    container.removeEventListener("wheel", onWheel);
  };
}
