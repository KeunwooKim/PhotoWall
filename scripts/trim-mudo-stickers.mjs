#!/usr/bin/env node
/**
 * Trim transparent padding from mudo sticker PNGs and regenerate the catalog
 * with aspect-aware defaultWidth / defaultHeight (max side = 120).
 *
 * Usage: node scripts/trim-mudo-stickers.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MUDO_DIR = path.join(ROOT, "public", "stickers", "mudo");
const OUT_TS = path.join(ROOT, "src", "lib", "stickers", "mudo-catalog.generated.ts");

const MAX_SIDE = 120;
const MIN_SIDE = 32;
const TRIM_THRESHOLD = 10;
/** Extra transparent margin as fraction of the longer content side. */
const MARGIN_RATIO = 0.03;
const MARGIN_MIN = 4;
const MARGIN_MAX = 24;
/** Near-black RGB treated as baked background (Instagram export leftovers). */
const BLACK_BG_MAX = 18;

const CATEGORY_ORDER = [
  "classic",
  "bubble",
  "daily",
  "exam",
  "food",
  "weather",
  "work",
  "travel",
  "vacation",
  "birthday",
  "money",
  "love",
  "friends",
  "extra",
];

const CATEGORY_LABELS = {
  classic: "기본",
  bubble: "말풍선",
  daily: "일상",
  exam: "시험",
  food: "음식",
  weather: "계절·날씨",
  work: "직장",
  travel: "여행",
  vacation: "휴가",
  birthday: "생일",
  money: "쇼핑·돈",
  love: "사랑",
  friends: "친구",
  extra: "번외",
};

function tsEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** "001-간단.png" → "간단"; keep readable hangul/spaces. */
function displayNameFromFilename(filename) {
  const stem = path.basename(filename, path.extname(filename));
  const withoutIndex = stem.replace(/^\d{3}-/, "");
  return withoutIndex.replace(/-/g, " ").trim() || stem;
}

function placementSize(width, height) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let scale = MAX_SIDE / Math.max(w, h);
  let defaultWidth = Math.round(w * scale);
  let defaultHeight = Math.round(h * scale);
  // Keep thin stickers tappable without blowing past ~1.5× max side
  if (defaultWidth < MIN_SIDE || defaultHeight < MIN_SIDE) {
    const boost = MIN_SIDE / Math.min(defaultWidth, defaultHeight);
    defaultWidth = Math.round(defaultWidth * boost);
    defaultHeight = Math.round(defaultHeight * boost);
    const cap = MAX_SIDE * 1.5;
    if (Math.max(defaultWidth, defaultHeight) > cap) {
      const shrink = cap / Math.max(defaultWidth, defaultHeight);
      defaultWidth = Math.round(defaultWidth * shrink);
      defaultHeight = Math.round(defaultHeight * shrink);
    }
  }
  return {
    defaultWidth: Math.max(MIN_SIDE, defaultWidth),
    defaultHeight: Math.max(MIN_SIDE, defaultHeight),
  };
}

/**
 * Flood-fill from image edges: turn near-black opaque pixels transparent.
 * Does not punch holes inside letterforms — only edge-connected background.
 */
function clearEdgeBlackBackground(data, width, height) {
  const n = width * height;
  const visited = new Uint8Array(n);
  const stack = [];

  const isBlackBg = (i) => {
    const o = i * 4;
    const a = data[o + 3];
    if (a < 10) return true;
    return data[o] <= BLACK_BG_MAX && data[o + 1] <= BLACK_BG_MAX && data[o + 2] <= BLACK_BG_MAX;
  };

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    if (!isBlackBg(i)) return;
    visited[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    data[o + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function trimPng(filePath) {
  const beforeMeta = await sharp(filePath).metadata();
  const beforeW = beforeMeta.width ?? 0;
  const beforeH = beforeMeta.height ?? 0;

  const rawIn = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(rawIn.data);
  clearEdgeBlackBackground(pixels, rawIn.info.width, rawIn.info.height);

  let cleaned = await sharp(pixels, {
    raw: {
      width: rawIn.info.width,
      height: rawIn.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  let trimmed;
  try {
    trimmed = await sharp(cleaned)
      .ensureAlpha()
      .trim({ threshold: TRIM_THRESHOLD })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return { beforeW, beforeH, afterW: beforeW, afterH: beforeH, changed: false };
  }

  const contentW = trimmed.info.width;
  const contentH = trimmed.info.height;
  if (contentW <= 0 || contentH <= 0) {
    return { beforeW, beforeH, afterW: beforeW, afterH: beforeH, changed: false };
  }

  const margin = Math.min(
    MARGIN_MAX,
    Math.max(MARGIN_MIN, Math.round(MARGIN_RATIO * Math.max(contentW, contentH))),
  );

  const out = await sharp(trimmed.data)
    .ensureAlpha()
    .extend({
      top: margin,
      bottom: margin,
      left: margin,
      right: margin,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  const afterW = out.info.width;
  const afterH = out.info.height;
  await fs.promises.writeFile(filePath, out.data);

  return {
    beforeW,
    beforeH,
    afterW,
    afterH,
    changed: afterW !== beforeW || afterH !== beforeH,
  };
}

async function main() {
  const catalogOnly = process.argv.includes("--catalog-only");
  if (!fs.existsSync(MUDO_DIR)) {
    console.error(`Missing ${MUDO_DIR}`);
    process.exit(1);
  }

  const byCategory = new Map();
  let trimmedCount = 0;
  let total = 0;
  let fillBefore = 0;

  for (const catId of CATEGORY_ORDER) {
    const dir = path.join(MUDO_DIR, catId);
    if (!fs.existsSync(dir)) continue;
    const files = (await fs.promises.readdir(dir))
      .filter((f) => f.toLowerCase().endsWith(".png"))
      .sort((a, b) => a.localeCompare(b, "en"));

    const stickers = [];
    for (const file of files) {
      const full = path.join(dir, file);
      let afterW;
      let afterH;
      if (catalogOnly) {
        const meta = await sharp(full).metadata();
        afterW = meta.width ?? MAX_SIDE;
        afterH = meta.height ?? MAX_SIDE;
      } else {
        const stats = await trimPng(full);
        total += 1;
        if (stats.changed) trimmedCount += 1;
        const areaBefore = Math.max(1, stats.beforeW * stats.beforeH);
        const areaAfter = Math.max(1, stats.afterW * stats.afterH);
        fillBefore += areaAfter / areaBefore;
        afterW = stats.afterW;
        afterH = stats.afterH;
      }

      const { defaultWidth, defaultHeight } = placementSize(afterW, afterH);
      const stem = path.basename(file, ".png");
      stickers.push({
        id: `mudo.${catId}.${stem}`,
        name: displayNameFromFilename(file),
        src: `mudo/${catId}/${file}`,
        defaultWidth,
        defaultHeight,
      });
    }
    byCategory.set(catId, stickers);
    console.log(`OK ${catId}: ${stickers.length} stickers`);
  }

  const lines = [
    "/* Auto-generated by scripts/trim-mudo-stickers.mjs — do not edit by hand. */",
    'import type { StickerCategory } from "./types";',
    "",
    "function image(path: string): string {",
    '  return `/stickers/${path}`;',
    "}",
    "",
    "export const MUDO_CATEGORIES: StickerCategory[] = [",
  ];

  let catalogTotal = 0;
  for (const catId of CATEGORY_ORDER) {
    const stickers = byCategory.get(catId) ?? [];
    if (stickers.length === 0) continue;
    const label = CATEGORY_LABELS[catId] ?? catId;
    lines.push("  {");
    lines.push(`    id: "${catId}",`);
    lines.push(`    name: "${tsEscape(label)}",`);
    lines.push("    stickers: [");
    for (const s of stickers) {
      catalogTotal += 1;
      lines.push(
        "      {" +
          ` id: "${s.id}",` +
          ` name: "${tsEscape(s.name)}",` +
          ` kind: "image",` +
          ` src: image("${tsEscape(s.src)}"),` +
          ` defaultWidth: ${s.defaultWidth},` +
          ` defaultHeight: ${s.defaultHeight}` +
          " },",
      );
    }
    lines.push("    ],");
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  lines.push(
    `// ${catalogTotal} stickers across ${[...byCategory.values()].filter((s) => s.length).length} categories`,
  );
  lines.push("");

  await fs.promises.writeFile(OUT_TS, lines.join("\n"), "utf8");

  if (!catalogOnly) {
    const meanRatio = total > 0 ? (fillBefore / total) * 100 : 0;
    console.log(`Trimmed ${trimmedCount}/${total} PNGs`);
    console.log(`Mean trimmed/original pixel area: ${meanRatio.toFixed(1)}%`);
  }
  console.log(`Wrote ${path.relative(ROOT, OUT_TS)} (${catalogTotal} stickers)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
