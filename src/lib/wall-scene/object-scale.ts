/** Absolute scale magnitude limits for wall objects (sign preserved separately). */
export const OBJECT_SCALE_ABS_MIN = 0.2;
export const OBJECT_SCALE_ABS_MAX = 4;

/** Longest on-wall edge after scale (px). Tightens max when the base size is large. */
export const OBJECT_MAX_VISUAL_EDGE = 3200;

export function clampObjectScaleAbs(scale: number): number {
  const sign = Math.sign(scale) || 1;
  const abs = Math.abs(scale) || OBJECT_SCALE_ABS_MIN;
  return (
    sign *
    Math.max(OBJECT_SCALE_ABS_MIN, Math.min(OBJECT_SCALE_ABS_MAX, abs))
  );
}

export function maxAllowedScaleAbs(baseWidth: number, baseHeight: number): number {
  const edge = Math.max(Math.abs(baseWidth), Math.abs(baseHeight), 1);
  return Math.min(OBJECT_SCALE_ABS_MAX, OBJECT_MAX_VISUAL_EDGE / edge);
}

export function minAllowedScaleAbs(baseWidth: number, baseHeight: number): number {
  void baseWidth;
  void baseHeight;
  return OBJECT_SCALE_ABS_MIN;
}

/** Clamp a uniform scale factor so every peer stays within abs min/max. */
export function clampUniformScaleFactor(
  peers: Array<{ startScaleX: number; baseWidth: number; baseHeight: number }>,
  factor: number,
): number {
  let minF = 0.05;
  let maxF = Number.POSITIVE_INFINITY;
  for (const peer of peers) {
    const base = Math.abs(peer.startScaleX) || 1;
    const absMin = minAllowedScaleAbs(peer.baseWidth, peer.baseHeight);
    const absMax = maxAllowedScaleAbs(peer.baseWidth, peer.baseHeight);
    minF = Math.max(minF, absMin / base);
    maxF = Math.min(maxF, absMax / base);
  }
  if (!Number.isFinite(maxF) || maxF < minF) return Math.max(minF, Math.min(factor, minF));
  return Math.max(minF, Math.min(maxF, factor));
}

export function clampObjectScalePair(
  scaleX: number,
  scaleY: number,
  baseWidth = 1,
  baseHeight = 1,
): { scaleX: number; scaleY: number } {
  const signX = Math.sign(scaleX) || 1;
  const signY = Math.sign(scaleY) || 1;
  const absX = Math.abs(scaleX) || 1;
  const absY = Math.abs(scaleY) || 1;
  const ratio = absY / absX;
  const absMax = maxAllowedScaleAbs(baseWidth, baseHeight);
  const nextX = Math.max(OBJECT_SCALE_ABS_MIN, Math.min(absMax, absX));
  const nextY = Math.max(OBJECT_SCALE_ABS_MIN, Math.min(absMax * ratio, nextX * ratio));
  return { scaleX: signX * nextX, scaleY: signY * nextY };
}
