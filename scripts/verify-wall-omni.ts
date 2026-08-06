import {
  DEFAULT_WALL_BOUNDS,
  WALL_EXPAND_MARGIN,
  WALL_EXPAND_STEP,
} from "../src/lib/wall-bounds";
import {
  computeCenteredWallExpand,
  computeCenteredWallShrink,
  computeOmniWallFollowFromContent,
} from "../src/lib/wall-scene/wall-omni-expand";

const max = { width: 2400, height: 4000 };
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
  const cur = { width: 1000, height: 1400 };
  // After west expand: content at margin, budget 200
  const content = { minX: margin + 80, minY: margin, maxX: 600, maxY: 500 };
  const g = computeOmniWallFollowFromContent(content, cur, max, margin, { x: 200, y: 0 });
  assert(!!g && g.shiftX < 0, "west reclaim when budget > 0");
  assert(!!g && g.bounds.width < cur.width, "west reclaim shrinks width");
}

{
  const cur = { width: 1000, height: 1400 };
  const content = { minX: margin + 80, minY: margin, maxX: 600, maxY: 500 };
  const g = computeOmniWallFollowFromContent(content, cur, max, margin, { x: 0, y: 0 });
  assert(!g || g.shiftX === 0, "no west reclaim without budget (home stable)");
}

{
  const cur = { width: 1000, height: 1400 };
  const content = { minX: margin, minY: margin + 80, maxX: 600, maxY: 500 };
  const g = computeOmniWallFollowFromContent(content, cur, max, margin, { x: 0, y: 200 });
  assert(!!g && g.shiftY < 0, "north reclaim when budget > 0");
  assert(!!g && g.bounds.height < cur.height, "north reclaim shrinks height");
}

{
  const cur = { width: 1100, height: 1520 };
  const g = computeCenteredWallShrink(cur, null, max, WALL_EXPAND_STEP, { x: 200, y: 100 });
  assert(!!g && g.shiftX === -Math.min(200, WALL_EXPAND_STEP), "menu shrink reclaims west budget");
  assert(!!g && g.shiftY === -Math.min(100, WALL_EXPAND_STEP), "menu shrink reclaims north budget");
}

{
  const cur = { ...DEFAULT_WALL_BOUNDS };
  const g = computeCenteredWallExpand(cur, max);
  assert(!!g && g.shiftX === 0, "menu expand no shift");
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll west/north reclaim checks passed");
