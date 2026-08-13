import type { PhotoCropRect, WallSceneFourCut } from "@/types/wall-scene-v2";
import type { RgbaBuffer } from "./types";

const DETECT_MAX_EDGE = 320;
const STACK_ASPECT_MIN = 2.0;
const STACK_ASPECT_MAX = 4.2;
const GRID_ASPECT_MIN = 0.85;
const GRID_ASPECT_MAX = 1.35;
const CONTENT_DIST = 72;
const FRAME_ROW_MAX = 0.22;
const MIN_BORDER_FRAC = 0.035;
const CELL_HEIGHT_CV_MAX = 0.22;
const GRID_CELL_CV_MAX = 0.18;

type Run = { start: number; end: number };

function pixelRgb(data: Uint8ClampedArray, i: number): [number, number, number] {
  return [data[i], data[i + 1], data[i + 2]];
}

function dist(a: [number, number, number], b: [number, number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function medianChannel(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function borderMedian(buf: RgbaBuffer): [number, number, number] {
  const { width, height, data } = buf;
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.03));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  for (let x = 0; x < width; x += 2) {
    for (let y = 0; y < band; y++) push(x, y);
    for (let y = height - band; y < height; y++) push(x, y);
  }
  for (let y = band; y < height - band; y += 2) {
    for (let x = 0; x < band; x++) push(x, y);
    for (let x = width - band; x < width; x++) push(x, y);
  }
  return [medianChannel(rs), medianChannel(gs), medianChannel(bs)];
}

function axisContentFrac(
  buf: RgbaBuffer,
  border: [number, number, number],
  axis: "row" | "col",
): number[] {
  const { width, height, data } = buf;
  const len = axis === "row" ? height : width;
  const other = axis === "row" ? width : height;
  const out = new Array<number>(len).fill(0);
  for (let a = 0; a < len; a++) {
    let content = 0;
    for (let b = 0; b < other; b++) {
      const x = axis === "row" ? b : a;
      const y = axis === "row" ? a : b;
      const i = (y * width + x) * 4;
      if (dist(pixelRgb(data, i), border) > CONTENT_DIST) content += 1;
    }
    out[a] = content / Math.max(1, other);
  }
  return out;
}

function runsAbove(values: number[], threshold: number): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > threshold) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      runs.push({ start, end: i });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, end: values.length });
  return runs;
}

function mergeCloseRuns(runs: Run[], gap: number): Run[] {
  if (runs.length === 0) return runs;
  const out: Run[] = [{ ...runs[0] }];
  for (let i = 1; i < runs.length; i++) {
    const prev = out[out.length - 1];
    if (runs[i].start - prev.end <= gap) {
      prev.end = runs[i].end;
    } else {
      out.push({ ...runs[i] });
    }
  }
  return out;
}

function coeffVar(sizes: number[]): number {
  if (sizes.length === 0) return 1;
  const mean = sizes.reduce((s, n) => s + n, 0) / sizes.length;
  if (mean <= 0) return 1;
  const variance =
    sizes.reduce((s, n) => s + (n - mean) * (n - mean), 0) / sizes.length;
  return Math.sqrt(variance) / mean;
}

function contentBoxInRun(
  buf: RgbaBuffer,
  border: [number, number, number],
  y0: number,
  y1: number,
): PhotoCropRect | null {
  const { width, data } = buf;
  let minX = width;
  let maxX = 0;
  let minY = y1;
  let maxY = y0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (dist(pixelRgb(data, i), border) <= CONTENT_DIST) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function detectStack4(
  buf: RgbaBuffer,
  border: [number, number, number],
): WallSceneFourCut | null {
  const { width, height } = buf;
  const rows = axisContentFrac(buf, border, "row");
  const headerEnd = Math.round(height * MIN_BORDER_FRAC);
  const headerFrac =
    rows.slice(0, Math.max(2, headerEnd)).reduce((s, n) => s + n, 0) /
    Math.max(1, headerEnd);
  if (headerFrac > FRAME_ROW_MAX) return null;

  let runs = runsAbove(rows, 0.28);
  runs = mergeCloseRuns(runs, Math.max(2, Math.round(height * 0.01)));
  runs = runs.filter((run) => run.end - run.start >= Math.round(height * 0.08));
  if (runs.length !== 4) return null;

  const heights = runs.map((run) => run.end - run.start);
  if (coeffVar(heights) > CELL_HEIGHT_CV_MAX) return null;

  const windows: PhotoCropRect[] = [];
  for (const run of runs) {
    const box = contentBoxInRun(buf, border, run.start, run.end);
    if (!box) return null;
    windows.push(box);
  }
  const widths = windows.map((w) => w.width);
  if (coeffVar(widths) > CELL_HEIGHT_CV_MAX) return null;
  if (windows[0].width < width * 0.45) return null;

  return {
    layout: "stack4",
    windows: windows as WallSceneFourCut["windows"],
  };
}

function detectGrid2x2(
  buf: RgbaBuffer,
  border: [number, number, number],
): WallSceneFourCut | null {
  const { width, height } = buf;
  const minSide = Math.min(width, height);
  const rows = axisContentFrac(buf, border, "row");
  const cols = axisContentFrac(buf, border, "col");

  const borderBand = Math.max(3, Math.round(minSide * MIN_BORDER_FRAC));
  const topFrac =
    rows.slice(0, borderBand).reduce((s, n) => s + n, 0) / borderBand;
  const leftFrac =
    cols.slice(0, borderBand).reduce((s, n) => s + n, 0) / borderBand;
  if (topFrac > FRAME_ROW_MAX || leftFrac > FRAME_ROW_MAX) return null;

  let rowRuns = mergeCloseRuns(
    runsAbove(rows, 0.28).filter((run) => run.end - run.start >= Math.round(height * 0.12)),
    Math.max(2, Math.round(height * 0.01)),
  );
  let colRuns = mergeCloseRuns(
    runsAbove(cols, 0.28).filter((run) => run.end - run.start >= Math.round(width * 0.12)),
    Math.max(2, Math.round(width * 0.01)),
  );
  if (rowRuns.length !== 2 || colRuns.length !== 2) return null;

  const gutterY = rowRuns[1].start - rowRuns[0].end;
  const gutterX = colRuns[1].start - colRuns[0].end;
  if (gutterY < minSide * 0.02 || gutterX < minSide * 0.02) return null;

  const cells: PhotoCropRect[] = [];
  for (const row of rowRuns) {
    for (const col of colRuns) {
      const box = contentBoxInRun(buf, border, row.start, row.end);
      if (!box) return null;
      const x0 = Math.max(box.x, col.start);
      const x1 = Math.min(box.x + box.width, col.end);
      if (x1 - x0 < width * 0.15) return null;
      cells.push({
        x: x0,
        y: box.y,
        width: x1 - x0,
        height: box.height,
      });
    }
  }
  if (cells.length !== 4) return null;
  const areas = cells.map((c) => c.width * c.height);
  if (coeffVar(areas) > GRID_CELL_CV_MAX) return null;

  return {
    layout: "grid2x2",
    windows: cells as WallSceneFourCut["windows"],
  };
}

/** Pure detector — windows are in buffer pixel space. */
export function detectFourCutLayout(buf: RgbaBuffer): WallSceneFourCut | null {
  const { width, height } = buf;
  if (width < 24 || height < 24) return null;
  const aspect = height / width;
  const border = borderMedian(buf);
  if (aspect >= STACK_ASPECT_MIN && aspect <= STACK_ASPECT_MAX) {
    return detectStack4(buf, border);
  }
  if (aspect >= GRID_ASPECT_MIN && aspect <= GRID_ASPECT_MAX) {
    return detectGrid2x2(buf, border);
  }
  return null;
}

function scaleWindows(
  windows: WallSceneFourCut["windows"],
  scaleX: number,
  scaleY: number,
): WallSceneFourCut["windows"] {
  return windows.map((window) => ({
    x: window.x * scaleX,
    y: window.y * scaleY,
    width: window.width * scaleX,
    height: window.height * scaleY,
  })) as WallSceneFourCut["windows"];
}

export function rasterizeForDetect(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
): RgbaBuffer | null {
  if (typeof document === "undefined") return null;
  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(8, Math.round(naturalWidth * scale));
  const height = Math.max(8, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

export function detectFourCutFromImage(image: HTMLImageElement): WallSceneFourCut | null {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const buf = rasterizeForDetect(image, naturalWidth, naturalHeight);
  if (!buf) return null;
  const hit = detectFourCutLayout(buf);
  if (!hit) return null;
  return {
    layout: hit.layout,
    windows: scaleWindows(
      hit.windows,
      naturalWidth / buf.width,
      naturalHeight / buf.height,
    ),
  };
}
