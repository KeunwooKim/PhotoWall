import { detectFourCutLayout } from "../src/lib/four-cut/detect";
import { canonicalFourCutWindows, containBlitRects, fourCutHoleFractions, fourCutHolesInPhoto } from "../src/lib/four-cut/layout";
import { getFourCutSkin, getListedFourCutSkins } from "../src/lib/four-cut/catalog";
import { sanitizeFourCutFields } from "../src/lib/four-cut/sanitize";
import type { RgbaBuffer } from "../src/lib/four-cut/types";
import type { WallScenePhoto } from "../src/types/wall-scene-v2";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

function makeBuffer(width: number, height: number, fill: [number, number, number]): RgbaBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function fillRect(
  buf: RgbaBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: [number, number, number],
) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(buf.width, Math.ceil(x + w));
  const y1 = Math.min(buf.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * buf.width + px) * 4;
      buf.data[i] = fill[0];
      buf.data[i + 1] = fill[1];
      buf.data[i + 2] = fill[2];
      buf.data[i + 3] = 255;
    }
  }
}

{
  const buf = makeBuffer(80, 220, [250, 250, 248]);
  const colors: Array<[number, number, number]> = [
    [40, 80, 160],
    [180, 60, 50],
    [40, 140, 70],
    [200, 160, 40],
  ];
  const side = 6;
  const header = 24;
  const footer = 18;
  const gap = 5;
  const cellH = (220 - header - footer - 3 * gap) / 4;
  const cellW = 80 - side * 2;
  for (let i = 0; i < 4; i++) {
    fillRect(buf, side, header + i * (cellH + gap), cellW, cellH, colors[i]);
  }
  const hit = detectFourCutLayout(buf);
  assert(hit?.layout === "stack4", "synthetic strip → stack4");
  assert(hit?.windows.length === 4, "strip has 4 windows");
}

{
  const buf = makeBuffer(160, 180, [250, 250, 248]);
  const colors: Array<[number, number, number]> = [
    [40, 80, 160],
    [180, 60, 50],
    [40, 140, 70],
    [200, 160, 40],
  ];
  const side = 12;
  const header = 20;
  const footer = 16;
  const gap = 8;
  const cellW = (160 - side * 2 - gap) / 2;
  const cellH = (180 - header - footer - gap) / 2;
  const cells = [
    [side, header],
    [side + cellW + gap, header],
    [side, header + cellH + gap],
    [side + cellW + gap, header + cellH + gap],
  ];
  cells.forEach(([x, y], i) => fillRect(buf, x, y, cellW, cellH, colors[i]));
  const hit = detectFourCutLayout(buf);
  assert(hit?.layout === "grid2x2", "synthetic 2×2 → grid2x2");
  assert(hit?.windows.length === 4, "2×2 has 4 windows");
}

{
  const buf = makeBuffer(80, 220, [210, 40, 40]);
  assert(detectFourCutLayout(buf) == null, "solid tall image is not a strip");
}

{
  const buf = makeBuffer(120, 140, [250, 250, 248]);
  fillRect(buf, 16, 16, 88, 96, [30, 90, 160]);
  assert(detectFourCutLayout(buf) == null, "single polaroid window is not 네컷");
}

{
  const buf = makeBuffer(160, 160, [30, 90, 160]);
  assert(detectFourCutLayout(buf) == null, "square photo is not 2×2");
}

{
  assert(fourCutHoleFractions("stack4").length === 4, "stack4 has 4 holes");
  assert(fourCutHoleFractions("grid2x2").length === 4, "grid2x2 has 4 holes");
  const canon = canonicalFourCutWindows("stack4", 100, 200);
  assert(canon.length === 4, "canonical stack windows");
  assert(Math.abs(canon[0].x - fourCutHoleFractions("stack4")[0].x * 100) < 1e-6, "canonical x from fractions");
  assert(getListedFourCutSkins("stack4").length >= 3, "listed stack skins");
  assert(getListedFourCutSkins("grid2x2").length >= 3, "listed grid skins");
  assert(getFourCutSkin("fourcut.stack.white")?.layout === "stack4", "white stack skin");
  assert(getFourCutSkin("fourcut.stack.white")?.kind === "booth", "white is booth theme");
  assert(getFourCutSkin("fourcut.stack.black")?.kind === "film", "black is film theme");
  assert(getFourCutSkin("fourcut.stack.cream")?.kind === "paper", "cream is paper theme");
  assert(getFourCutSkin("fourcut.stack.pink")?.kind === "gingham", "pink is gingham theme");
  assert(getFourCutSkin("fourcut.stack.sky")?.kind === "dots", "sky is dots theme");
  assert(getFourCutSkin("fourcut.grid.white")?.kind === "booth", "grid white is booth theme");
  assert(Boolean(getFourCutSkin("fourcut.stack.pink")?.pattern), "pink has pattern");
  assert(!getFourCutSkin("nope"), "unknown skin is undefined");
}

{
  const src = { x: 10, y: 20, width: 80, height: 40 };
  const dest = { x: 0, y: 0, width: 80, height: 40 };
  const fit = containBlitRects(src, dest);
  assert(fit.sw === 80 && fit.sh === 40, "contain same aspect uses full source");
  assert(Math.abs(fit.dw - 80) < 1e-6 && Math.abs(fit.dh - 40) < 1e-6, "contain same aspect fills dest");

  const tall = containBlitRects(src, { x: 0, y: 0, width: 40, height: 80 });
  assert(tall.sw === 80 && tall.sh === 40, "contain mismatched aspect does not crop source");
  assert(Math.abs(tall.dw - 40) < 1e-6, "contain letterboxes to dest width");
  assert(tall.dh < 80, "contain letterboxes inside dest height");
}

{
  const windows = canonicalFourCutWindows("stack4", 100, 250);
  const photo: WallScenePhoto = {
    id: "p",
    type: "photo",
    x: 10,
    y: 20,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    src: "x",
    width: 100,
    height: 250,
    fourCut: {
      layout: "stack4",
      windows,
      skinId: "fourcut.stack.white",
      base: { x: 10, y: 20, width: 100, height: 250 },
    },
  };
  const holes = fourCutHolesInPhoto(photo, 100, 250);
  assert(holes != null && holes.length === 4, "mapped dest holes");
  assert(Math.abs(holes![0].width - windows[0].width) < 1e-6, "inner photo width matches 원본");
  assert(Math.abs(holes![0].x - windows[0].x) < 1e-6, "inner photo x matches 원본");
  assert(fourCutHolesInPhoto(photo) == null, "holes wait for source size");
}

{
  const base: WallScenePhoto = {
    id: "p1",
    type: "photo",
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    src: "x",
    width: 100,
    height: 260,
    fourCut: {
      layout: "stack4",
      windows: [
        { x: 4, y: 10, width: 70, height: 40 },
        { x: 4, y: 55, width: 70, height: 40 },
        { x: 4, y: 100, width: 70, height: 40 },
        { x: 4, y: 145, width: 70, height: 40 },
      ],
      skinId: "fourcut.stack.white",
      base: { x: 1, y: 2, width: 80, height: 200 },
    },
  };
  const kept = sanitizeFourCutFields(base) as WallScenePhoto;
  assert(kept.fourCut?.skinId === "fourcut.stack.white", "known skin kept");
  assert(kept.fourCut?.base?.width === 80, "base box kept");

  const bad = sanitizeFourCutFields({
    ...base,
    fourCut: { ...base.fourCut!, skinId: "fourcut.missing" },
  }) as WallScenePhoto;
  assert(bad.fourCut?.skinId == null, "unknown skin dropped");

  const mismatch = sanitizeFourCutFields({
    ...base,
    fourCut: { ...base.fourCut!, skinId: "fourcut.grid.white" },
  }) as WallScenePhoto;
  assert(mismatch.fourCut?.skinId == null, "layout-mismatched skin dropped");

  const gone = sanitizeFourCutFields({
    ...base,
    fourCut: { layout: "stack4", windows: [] as never },
  }) as WallScenePhoto;
  assert(gone.fourCut == null, "invalid windows dropped");
}

if (failed > 0) {
  console.error(`verify-four-cut: ${failed} failed`);
  process.exit(1);
}
console.log("verify-four-cut: all ok");
