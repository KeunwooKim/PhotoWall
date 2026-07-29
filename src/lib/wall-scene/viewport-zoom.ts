export const USER_ZOOM_MIN = 0.5;
export const USER_ZOOM_MAX = 4;

export function clampUserZoom(zoom: number): number {
  return Math.max(USER_ZOOM_MIN, Math.min(USER_ZOOM_MAX, zoom));
}

/** Keep the wall point under (screenX, screenY) fixed while changing zoom. */
export function panForZoomAtScreenPoint(
  panX: number,
  panY: number,
  oldZoom: number,
  newZoom: number,
  screenX: number,
  screenY: number,
  containerCenterX: number,
  containerCenterY: number,
): { panX: number; panY: number } {
  const ratio = newZoom / oldZoom;
  return {
    panX: screenX - containerCenterX - (screenX - containerCenterX - panX) * ratio,
    panY: screenY - containerCenterY - (screenY - containerCenterY - panY) * ratio,
  };
}

export function containerCenter(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
