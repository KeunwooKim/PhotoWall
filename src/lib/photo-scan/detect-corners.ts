import * as ort from "onnxruntime-web";
import { orderQuadCorners } from "./perspective";
import type { Point2, QuadPoints } from "./types";

const MODEL_URL = "/models/doc-aligner-lcnet100.onnx";
const INPUT_SIZE = 256;
const HEATMAP_SIZE = 128;
const HEATMAP_THRESHOLD = 0.25;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function configureOrt() {
  // Prefer local wasm copies to avoid CDN blocks on mobile Safari
  ort.env.wasm.wasmPaths = "/ort/";
  ort.env.wasm.numThreads = 1;
}

export async function loadCornerDetector(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    configureOrt();
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }).catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

function imageToTensorNCHW(img: HTMLImageElement | HTMLCanvasElement): {
  tensor: ort.Tensor;
  width: number;
  height: number;
} {
  const width =
    "naturalWidth" in img && img.naturalWidth ? img.naturalWidth : img.width;
  const height =
    "naturalHeight" in img && img.naturalHeight ? img.naturalHeight : img.height;

  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const float = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0; i < plane; i++) {
    float[i] = data[i * 4] / 255;
    float[plane + i] = data[i * 4 + 1] / 255;
    float[plane * 2 + i] = data[i * 4 + 2] / 255;
  }

  return {
    tensor: new ort.Tensor("float32", float, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    width,
    height,
  };
}

/** Soft-argmax around heatmap peak for sub-pixel corner. */
function peakFromHeatmap(
  heat: Float32Array,
  channel: number,
  h: number,
  w: number,
): { point: Point2; score: number } | null {
  const offset = channel * h * w;
  let maxV = -Infinity;
  let maxI = 0;
  for (let i = 0; i < h * w; i++) {
    const v = heat[offset + i];
    if (v > maxV) {
      maxV = v;
      maxI = i;
    }
  }
  if (maxV < HEATMAP_THRESHOLD) return null;

  const cy = Math.floor(maxI / w);
  const cx = maxI % w;
  const radius = 2;
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(h - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(w - 1, cx + radius); x++) {
      const v = Math.max(0, heat[offset + y * w + x]);
      sum += v;
      sx += x * v;
      sy += y * v;
    }
  }
  if (sum < 1e-6) return { point: { x: cx, y: cy }, score: maxV };
  return { point: { x: sx / sum, y: sy / sum }, score: maxV };
}

export type DetectCornersResult = {
  quad: QuadPoints | null;
  scores: number[];
  ms: number;
};

/**
 * Detect document/photo corners with DocAligner LCNet100 (ONNX, ~4.5MB).
 * Returns null quad when detection confidence is too low.
 */
export async function detectDocumentCorners(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<DetectCornersResult> {
  const started = performance.now();
  const session = await loadCornerDetector();
  const { tensor, width, height } = imageToTensorNCHW(source);
  const outputs = await session.run({ img: tensor });
  const heatmap = outputs.heatmap;
  const data = heatmap.data as Float32Array;

  const points: Point2[] = [];
  const scores: number[] = [];
  for (let c = 0; c < 4; c++) {
    const peak = peakFromHeatmap(data, c, HEATMAP_SIZE, HEATMAP_SIZE);
    if (!peak) {
      return { quad: null, scores, ms: Math.round(performance.now() - started) };
    }
    // heatmap 128 → original image coords
    points.push({
      x: (peak.point.x / (HEATMAP_SIZE - 1)) * (width - 1),
      y: (peak.point.y / (HEATMAP_SIZE - 1)) * (height - 1),
    });
    scores.push(peak.score);
  }

  // Re-order to TL→TR→BR→BL (model channel order is usually already this, but be safe)
  const quad = orderQuadCorners(points);
  return { quad, scores, ms: Math.round(performance.now() - started) };
}
