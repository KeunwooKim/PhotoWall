import { detectFourCutLayout } from "../src/lib/four-cut/detect";
import {
  applyFourCutSlotWindow,
  aspectForFourCutBox,
  boxKeepCenter,
  canonicalFourCutWindows,
  clampWindowInside,
  containBlitRects,
  coverBlitRects,
  destPointToSource,
  explodeFourCutPlacement,
  fitWindowToDest,
  fourCutDestHoles,
  fourCutHoleFractions,
  fourCutHolesInPhoto,
  layoutFromAspect,
  panWindowByDestDelta,
  panZoomWindow,
  resizeBoxKeepCenterArea,
  sourcePointToDest,
} from "../src/lib/four-cut/layout";
import { getFourCutSkin, getListedFourCutSkins, GRID2X2_ASPECT, STACK4_ASPECT } from "../src/lib/four-cut/catalog";
import { sanitizeFourCutFields } from "../src/lib/four-cut/sanitize";
import { sanitizePhotoDecorFields } from "../src/lib/photo-frames/sanitize";
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
  assert(hit?.baseWindows?.length === 4, "detect stores baseWindows");
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
  assert(getListedFourCutSkins("stack4").length === 2, "listed stack skins");
  assert(getListedFourCutSkins("grid2x2").length === 2, "listed grid skins");
  assert(getFourCutSkin("fourcut.stack.white")?.layout === "stack4", "white stack skin");
  assert(getFourCutSkin("fourcut.stack.white")?.kind === "booth", "white is booth theme");
  assert(getFourCutSkin("fourcut.stack.black")?.kind === "booth", "black is booth theme");
  assert(getFourCutSkin("fourcut.grid.white")?.kind === "booth", "grid white is booth theme");
  assert(!getFourCutSkin("fourcut.stack.cream"), "cream theme removed");
  assert(!getFourCutSkin("fourcut.doodle.party"), "doodle frames removed");
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
  const expected = fourCutDestHoles("stack4", photo.width, photo.height);
  assert(Math.abs(holes![0].x - expected[0].x) < 1e-6, "dest hole x from chrome layout");
  assert(Math.abs(holes![0].width - expected[0].width) < 1e-6, "dest hole w from chrome layout");
  assert(holes![0].width / photo.width > 0.85, "stack holes use the strip width");
  assert(fourCutHolesInPhoto(photo) != null, "dest holes do not need source size");
}

{
  const windows = canonicalFourCutWindows("stack4", 100, 250);
  const photo: WallScenePhoto = {
    id: "p-grid",
    type: "photo",
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    src: "x",
    width: 176,
    height: 200,
    fourCut: {
      layout: "grid2x2",
      windows,
      base: { x: 0, y: 0, width: 95, height: 250 },
    },
  };
  const holes = fourCutHolesInPhoto(photo);
  assert(holes != null && holes.length === 4, "relayouted strip maps grid dest holes");
  assert(holes![1].x > holes![0].x, "grid dest has a right column");
  assert(holes![2].y > holes![0].y, "grid dest has a bottom row");
}

{
  const photo: WallScenePhoto = {
    id: "p-native",
    type: "photo",
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    src: "x",
    width: 100,
    height: 250,
    fourCut: {
      layout: "stack4",
      windows: canonicalFourCutWindows("stack4", 100, 250),
    },
  };
  assert(fourCutHolesInPhoto(photo) == null, "unstyled native strip shows the original print");
}

{
  assert(layoutFromAspect(STACK4_ASPECT) === "stack4", "2×6 aspect is stack4");
  assert(layoutFromAspect(GRID2X2_ASPECT) === "grid2x2", "4×6 aspect is grid2x2");
  const box = { x: 10, y: 20, width: 38, height: 100 };
  const next = resizeBoxKeepCenterArea(box, GRID2X2_ASPECT);
  assert(Math.abs(next.width * next.height - box.width * box.height) < 1e-6, "relayout keeps area");
  assert(Math.abs(next.x + next.width / 2 - (box.x + box.width / 2)) < 1e-6, "relayout keeps center x");
  assert(Math.abs(next.y + next.height / 2 - (box.y + box.height / 2)) < 1e-6, "relayout keeps center y");

  const restored = boxKeepCenter({ x: 100, y: 200, width: 80, height: 40 }, { width: 40, height: 100 });
  assert(Math.abs(restored.x + restored.width / 2 - 140) < 1e-6, "원본 keeps center x");
  assert(Math.abs(restored.y + restored.height / 2 - 220) < 1e-6, "원본 keeps center y");
  assert(restored.width === 40 && restored.height === 100, "원본 restores size not position");
}

{
  const origin = { x: 0, y: 0, width: 80, height: 200 };
  const windows = canonicalFourCutWindows("stack4", 100, 250);
  const cells = explodeFourCutPlacement(origin, windows, { width: 100, height: 250 }, origin);
  assert(cells.length === 4, "explode yields 4 cells");
  const cx = origin.x + origin.width / 2;
  const cy = origin.y + origin.height / 2;
  const cellCx = cells.map((cell) => cell.x + cell.width / 2);
  const cellCy = cells.map((cell) => cell.y + cell.height / 2);
  assert(cellCx[0] < cx && cellCx[1] > cx, "explode 2×2 left/right");
  assert(cellCy[0] < cy && cellCy[2] > cy, "explode 2×2 top/bottom");
  assert(Math.max(cells[0].width, cells[0].height) >= 139, "extracted photos are not stamps");
  const srcAspect = windows[0].width / windows[0].height;
  const cellAspect = cells[0].width / cells[0].height;
  assert(Math.abs(cellAspect - srcAspect) < 0.02, "extracted photos keep window aspect");

  const gridAspect = aspectForFourCutBox("grid2x2", windows);
  const stackAspect = aspectForFourCutBox("stack4", windows);
  assert(Math.abs(gridAspect - GRID2X2_ASPECT) < 1e-6, "2×2 sheet is 4×6");
  assert(Math.abs(stackAspect - STACK4_ASPECT) < 1e-6, "stack sheet is 2×6");

  const gridBox = { width: 102, height: 152 };
  const dest = fourCutDestHoles("grid2x2", gridBox.width, gridBox.height)[0];
  const blit = coverBlitRects(windows[0], dest);
  assert(Math.abs(blit.dw - dest.width) < 1e-6 && Math.abs(blit.dh - dest.height) < 1e-6, "cover fills dest holes");

  const stackBox = { width: 80, height: 240 };
  const stackDest = fourCutDestHoles("stack4", stackBox.width, stackBox.height)[0];
  const gridWindows = canonicalFourCutWindows("grid2x2", 160, 240);
  const fitted = fourCutDestHoles(
    "stack4",
    stackBox.width,
    stackBox.height,
    gridWindows[0].width / gridWindows[0].height,
  )[0];
  assert(stackDest.width > fitted.width + 8, "vertical holes are not shrunk to 2×2 cell aspect");
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

  const withBaseWindows = sanitizeFourCutFields({
    ...base,
    fourCut: {
      ...base.fourCut!,
      baseWindows: [
        { x: 4, y: 10, width: 70, height: 40 },
        { x: 4, y: 55, width: 70, height: 40 },
        { x: 4, y: 100, width: 70, height: 40 },
        { x: 4, y: 145, width: 70, height: 40 },
      ],
    },
  }) as WallScenePhoto;
  assert(withBaseWindows.fourCut?.baseWindows?.[0].width === 70, "baseWindows kept");

  const stacked = sanitizePhotoDecorFields({
    ...base,
    frameId: "frame.polaroid",
  }) as WallScenePhoto;
  assert(stacked.frameId == null, "네컷 photo cannot keep a polaroid frame");
}

{
  const original = { x: 10, y: 20, width: 80, height: 40 };
  const zoomed = panZoomWindow(original, { x: 0, y: 0 }, 2);
  assert(Math.abs(zoomed.width - 40) < 1e-6, "zoom-in halves window width");
  assert(zoomed.x >= original.x && zoomed.x + zoomed.width <= original.x + original.width, "zoomed window stays in original x");
  assert(zoomed.y >= original.y && zoomed.y + zoomed.height <= original.y + original.height, "zoomed window stays in original y");

  const panned = panZoomWindow(original, { x: 1000, y: -1000 }, 2);
  assert(panned.x + panned.width <= original.x + original.width + 1e-6, "pan clamp right");
  assert(panned.x >= original.x - 1e-6, "pan clamp left");
  assert(panned.y >= original.y - 1e-6, "pan clamp top");
  assert(panned.y + panned.height <= original.y + original.height + 1e-6, "pan clamp bottom");

  const out = panZoomWindow(original, { x: 0, y: 0 }, 0.5);
  assert(Math.abs(out.width - original.width) < 1e-6, "zoom-out max is original width");
  assert(Math.abs(out.height - original.height) < 1e-6, "zoom-out max is original height");

  const dest = { x: 0, y: 0, width: 40, height: 20 };
  const mid = { x: dest.x + dest.width / 2, y: dest.y + dest.height / 2 };
  const src = destPointToSource(mid, original, dest);
  const back = sourcePointToDest(src, original, dest);
  assert(Math.abs(back.x - mid.x) < 1e-6 && Math.abs(back.y - mid.y) < 1e-6, "dest↔source roundtrip");

  const nested = clampWindowInside({ x: 0, y: 0, width: 200, height: 200 }, original);
  assert(nested.width <= original.width && nested.height <= original.height, "clamp cannot exceed original cell");

  const wide = { x: 0, y: 0, width: 80, height: 40 };
  const squareDest = { x: 0, y: 0, width: 40, height: 40 };
  const fitted = fitWindowToDest(wide, squareDest, wide);
  assert(Math.abs(fitted.width - 40) < 1e-6 && Math.abs(fitted.height - 40) < 1e-6, "fit window matches dest aspect");
  const dragged = panWindowByDestDelta(wide, { x: 10, y: 0 }, squareDest, wide);
  assert(dragged.x < fitted.x + 1e-6, "center drag moves the visible crop");
  assert(dragged.x >= wide.x - 1e-6 && dragged.x + dragged.width <= wide.x + wide.width + 1e-6, "drag stays in original cell");
}

{
  const windows = canonicalFourCutWindows("stack4", 100, 250);
  const photo: WallScenePhoto = {
    id: "p-slot",
    type: "photo",
    x: 12,
    y: 24,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    src: "x",
    width: 80,
    height: 240,
    fourCut: {
      layout: "stack4",
      windows,
      baseWindows: windows.map((window) => ({ ...window })) as typeof windows,
    },
  };
  const slot1 = windows[1];
  const nextWindow = panZoomWindow(slot1, { x: 4, y: 2 }, 1.5);
  const next = applyFourCutSlotWindow(photo, 1, nextWindow);
  assert(next.x === photo.x && next.y === photo.y, "slot crop keeps box origin");
  assert(next.width === photo.width && next.height === photo.height, "slot crop keeps box size");
  assert((next.fourCut?.windows[1].width ?? 0) < slot1.width, "slot crop writes window");
  assert(next.fourCut?.windows[0].width === windows[0].width, "other slots unchanged");
  assert(next.fourCut?.baseWindows?.[1].width === slot1.width, "baseWindows unchanged");
  const nativeHoles = fourCutHolesInPhoto(next, 100, 250);
  assert(nativeHoles != null && nativeHoles.length === 4, "native slot crop still blits into original cells");
}

if (failed > 0) {
  console.error(`verify-four-cut: ${failed} failed`);
  process.exit(1);
}
console.log("verify-four-cut: all ok");
