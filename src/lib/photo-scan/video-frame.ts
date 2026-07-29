import type { QuadPoints } from "./types";

export function shouldRotateCapture(video: HTMLVideoElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const screenPortrait = window.innerHeight >= window.innerWidth;
  return screenPortrait && vw > vh;
}

/** Wait until video frame dimensions are available (iOS often delays this). */
export function waitForVideoFrame(
  video: HTMLVideoElement,
  timeoutMs = 5000,
): Promise<boolean> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("resize", onReady);
      resolve(ok);
    };

    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) finish(true);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("resize", onReady);
    onReady();
  });
}

/**
 * Draw the current video frame to canvas, rotating when the device is portrait
 * but the camera buffer is landscape (common on mobile).
 */
export function drawVideoToCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxSide?: number,
): { width: number; height: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const rotate = shouldRotateCapture(video);
  let outW = rotate ? vh : vw;
  let outH = rotate ? vw : vh;

  if (maxSide && Math.max(outW, outH) > maxSide) {
    const scale = maxSide / Math.max(outW, outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  } else {
    outW = Math.round(outW);
    outH = Math.round(outH);
  }

  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, outW, outH);

  if (rotate) {
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate(Math.PI / 2);
    if (maxSide) {
      const scale = outW / vh;
      ctx.drawImage(video, (-vw * scale) / 2, (-vh * scale) / 2, vw * scale, vh * scale);
    } else {
      ctx.drawImage(video, -vw / 2, -vh / 2);
    }
  } else if (maxSide && (outW !== vw || outH !== vh)) {
    ctx.drawImage(video, 0, 0, outW, outH);
  } else {
    ctx.drawImage(video, 0, 0);
  }

  return { width: outW, height: outH };
}

/** Centered portrait photo guide (~3:4) for manual capture fallback. */
export function defaultPhotoQuad(
  frameW: number,
  frameH: number,
  aspectWidth = 3,
  aspectHeight = 4,
): QuadPoints {
  const aspect = aspectWidth / aspectHeight;
  const margin = 0.1;
  let quadW: number;
  let quadH: number;

  if (frameW / frameH > aspect) {
    quadH = frameH * (1 - margin * 2);
    quadW = quadH * aspect;
  } else {
    quadW = frameW * (1 - margin * 2);
    quadH = quadW / aspect;
  }

  const cx = frameW / 2;
  const cy = frameH / 2;
  const halfW = quadW / 2;
  const halfH = quadH / 2;

  return [
    { x: cx - halfW, y: cy - halfH },
    { x: cx + halfW, y: cy - halfH },
    { x: cx + halfW, y: cy + halfH },
    { x: cx - halfW, y: cy + halfH },
  ];
}

export function scaleQuad(quad: QuadPoints, sx: number, sy: number): QuadPoints {
  return [
    { x: quad[0].x * sx, y: quad[0].y * sy },
    { x: quad[1].x * sx, y: quad[1].y * sy },
    { x: quad[2].x * sx, y: quad[2].y * sy },
    { x: quad[3].x * sx, y: quad[3].y * sy },
  ];
}
