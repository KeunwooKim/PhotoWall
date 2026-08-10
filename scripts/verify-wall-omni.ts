import {
  DEFAULT_WALL_BOUNDS,
  WALL_EXPAND_MARGIN,
  WALL_EXPAND_STEP,
  needsLegacyWallMigration,
  migrateLegacyWallToCenterOrigin,
  wallExpandEdgeLimits,
  wallExpandExtentsFromHome,
} from "../src/lib/wall-bounds";
import { PIXI_WALL_MAX_HEIGHT, PIXI_WALL_MAX_WIDTH } from "../src/lib/wall-device";
import {
  computeCenteredWallExpand,
  computeCenteredWallShrink,
  computeOmniWallFollowFromContent,
  computeOmniWallGrowFromContent,
} from "../src/lib/wall-scene/wall-omni-expand";

const max = { width: PIXI_WALL_MAX_WIDTH, height: PIXI_WALL_MAX_HEIGHT };
const margin = WALL_EXPAND_MARGIN;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

{
  assert(DEFAULT_WALL_BOUNDS.x === -390, "default wall centered on x");
  assert(DEFAULT_WALL_BOUNDS.y === -600, "default wall centered on y");
  assert(PIXI_WALL_MAX_WIDTH === 8000 && PIXI_WALL_MAX_HEIGHT === 8000, "pixi max 8000×8000");
  const extents = wallExpandExtentsFromHome(max);
  assert(extents.west === extents.east, "west/east extents equal");
  assert(extents.north === extents.south, "north/south extents equal");
  assert(extents.west === (8000 - 780) / 2, "horizontal extent 3610");
  assert(extents.north === (8000 - 1200) / 2, "vertical extent 3400");
}

{
  const cur = { ...DEFAULT_WALL_BOUNDS };
  const content = {
    minX: cur.x + 10,
    minY: 0,
    maxX: 100,
    maxY: 100,
  };
  const g = computeOmniWallFollowFromContent(content, cur, max, margin);
  assert(!!g && g.shiftX === 0 && g.shiftY === 0, "west grow: no object shift");
  assert(!!g && g.bounds.x < cur.x, "west grow: wall.x moves left");
  assert(!!g && g.bounds.width > cur.width, "west grow: width increases");
}

{
  const cur = { ...DEFAULT_WALL_BOUNDS };
  const content = {
    minX: -50,
    minY: -50,
    maxX: cur.x + cur.width - 10,
    maxY: 100,
  };
  const g = computeOmniWallFollowFromContent(content, cur, max, margin);
  assert(!!g && g.shiftX === 0, "east grow: no object shift");
  assert(!!g && g.bounds.width > cur.width, "east grow: width increases");
  assert(!!g && g.bounds.x === cur.x, "east grow: wall.x stays");
}

{
  const cur = { x: -390, y: -600, width: 2000, height: 1200 };
  const content = { minX: 800, minY: -100, maxX: 1100, maxY: 100 };
  const g = computeOmniWallFollowFromContent(content, cur, max, margin);
  assert(!!g && g.bounds.width < cur.width, "same-edge reclaim shrinks east when near east");
  assert(!!g && g.bounds.x === cur.x, "same-edge reclaim: left edge stays");
  assert(!!g && g.shiftX === 0, "reclaim: no object shift");
}

{
  const cur = { x: -390, y: -600, width: 2000, height: 1200 };
  const right = cur.x + cur.width;
  const crossed = { minX: -200, minY: -100, maxX: 100, maxY: 100 };
  const mid = computeOmniWallFollowFromContent(crossed, cur, max, margin);
  assert(mid == null, "cross to west half: east edge stays put");
  const westPress = {
    minX: cur.x + 10,
    minY: -100,
    maxX: 100,
    maxY: 100,
  };
  const liveWest = computeOmniWallFollowFromContent(westPress, cur, max, margin);
  assert(!!liveWest && liveWest.bounds.x < cur.x, "west grow: left edge moves");
  assert(
    !!liveWest && liveWest.bounds.x + liveWest.bounds.width === right,
    "west grow: right edge stays put",
  );
}

{
  // Full east to per-side limit, then full west — both sides reachable.
  const limits = wallExpandEdgeLimits(max);
  const afterEast = {
    x: DEFAULT_WALL_BOUNDS.x,
    y: DEFAULT_WALL_BOUNDS.y,
    width: limits.maxRight - DEFAULT_WALL_BOUNDS.x,
    height: DEFAULT_WALL_BOUNDS.height,
  };
  assert(afterEast.width === 780 + 3610, "east-only width uses half budget");
  assert(afterEast.x + afterEast.width === limits.maxRight, "east hits maxRight");

  const westPress = {
    minX: limits.minLeft + margin - 10,
    minY: -100,
    maxX: limits.minLeft + margin + 50,
    maxY: 100,
  };
  const afterWest = computeOmniWallFollowFromContent(westPress, afterEast, max, margin);
  assert(!!afterWest, "west still grows after east max");
  assert(!!afterWest && afterWest.bounds.x === limits.minLeft, "west hits minLeft");
  assert(
    !!afterWest && afterWest.bounds.x + afterWest.bounds.width === limits.maxRight,
    "east stays at max while west reaches max",
  );
  assert(!!afterWest && afterWest.bounds.width === 8000, "full both sides → 8000 wide");
}

{
  const limits = wallExpandEdgeLimits(max);
  const cur = { ...DEFAULT_WALL_BOUNDS };
  const pastEast = {
    minX: 0,
    minY: 0,
    maxX: limits.maxRight + 500,
    maxY: 100,
  };
  const g = computeOmniWallFollowFromContent(pastEast, cur, max, margin);
  assert(!!g && g.bounds.x + g.bounds.width === limits.maxRight, "east clamp at limit");
}

{
  const cur = { ...DEFAULT_WALL_BOUNDS };
  const g = computeCenteredWallExpand(cur, max);
  assert(!!g && g.shiftX === 0, "menu expand no shift");
  assert(!!g && g.bounds.x === cur.x, "menu expand keeps left edge");
}

{
  const cur = { x: -500, y: -700, width: 1000, height: 1400 };
  const g = computeCenteredWallShrink(cur, null, max, WALL_EXPAND_STEP);
  assert(!!g && g.shiftX === 0, "menu shrink no shift");
}

{
  const cur = { ...DEFAULT_WALL_BOUNDS };
  const content = { minX: -500, minY: -100, maxX: 100, maxY: 100 };
  const g = computeOmniWallGrowFromContent(content, cur, max, margin);
  assert(!!g && g.shiftX === 0, "grow-from-content: no shift");
  assert(!!g && g.bounds.x < cur.x, "grow-from-content: expands west");
}

{
  assert(needsLegacyWallMigration({ width: 780, height: 1200 }), "size-only is legacy");
  assert(!needsLegacyWallMigration(DEFAULT_WALL_BOUNDS), "centered bounds not legacy");
  const migrated = migrateLegacyWallToCenterOrigin({
    wallBounds: { width: 780, height: 1200 },
    homeOrigin: { x: 0, y: 0 },
    objects: [
      {
        id: "a",
        type: "emoji",
        text: "x",
        fontSize: 24,
        x: 390,
        y: 600,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        zIndex: 0,
      },
    ],
  });
  assert(migrated.translated, "legacy migrates");
  assert(migrated.wallBounds.x === -390, "migrated wall.x");
  assert(migrated.objects[0].x === 0 && migrated.objects[0].y === 0, "home center → origin");
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll center-origin wall checks passed");
