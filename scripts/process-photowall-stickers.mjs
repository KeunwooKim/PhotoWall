#!/usr/bin/env node
/**
 * Process PhotoWall original stickers:
 * raw PNG (white/light bg) → clear edge background → trim → public + catalog.
 *
 * Usage:
 *   node scripts/process-photowall-stickers.mjs summer
 *   node scripts/process-photowall-stickers.mjs summer --catalog-only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const MAX_SIDE = 120;
const MIN_SIDE = 32;
const TRIM_THRESHOLD = 12;
const MARGIN_RATIO = 0.04;
const MARGIN_MIN = 6;
const MARGIN_MAX = 28;
const WHITE_MIN = 232;

const PACK_META = {
  basic: {
    id: "basic",
    name: "기본",
    emoji: "✨",
    sortOrder: 0,
    categoryOrder: ["deco", "cute"],
    categoryLabels: { deco: "꾸미기", cute: "귀여움" },
  },
  summer: {
    id: "summer",
    name: "여름",
    emoji: "🏖️",
    sortOrder: 10,
    categoryOrder: ["beach", "treats"],
    categoryLabels: { beach: "비치", treats: "간식" },
  },
  autumn: {
    id: "autumn",
    name: "가을",
    emoji: "🍂",
    sortOrder: 11,
    categoryOrder: ["nature", "cozy"],
    categoryLabels: { nature: "자연", cozy: "포근" },
  },
  cafe: {
    id: "cafe",
    name: "카페",
    emoji: "☕",
    sortOrder: 12,
    categoryOrder: ["drink", "bite"],
    categoryLabels: { drink: "음료", bite: "디저트" },
  },
  spring: {
    id: "spring",
    name: "봄",
    emoji: "🌸",
    sortOrder: 9,
    categoryOrder: ["bloom", "picnic"],
    categoryLabels: { bloom: "꽃", picnic: "피크닉" },
  },
  winter: {
    id: "winter",
    name: "겨울",
    emoji: "❄️",
    sortOrder: 13,
    categoryOrder: ["snow", "warm"],
    categoryLabels: { snow: "눈", warm: "따뜻" },
  },
  party: {
    id: "party",
    name: "파티",
    emoji: "🎉",
    sortOrder: 14,
    categoryOrder: ["celeb", "fun"],
    categoryLabels: { celeb: "축하", fun: "재미" },
  },
  cute: {
    id: "cute",
    name: "귀여움",
    emoji: "🧸",
    sortOrder: 2,
    categoryOrder: ["animals", "sweets"],
    categoryLabels: { animals: "동물", sweets: "간식" },
  },
  daku: {
    id: "daku",
    name: "다꾸",
    emoji: "🎀",
    sortOrder: 1,
    categoryOrder: ["chars", "accents"],
    categoryLabels: { chars: "캐릭터", accents: "데코" },
  },
  love: {
    id: "love",
    name: "연애",
    emoji: "💕",
    sortOrder: 3,
    categoryOrder: ["hearts", "date"],
    categoryLabels: { hearts: "하트", date: "데이트" },
  },
  travel: {
    id: "travel",
    name: "여행",
    emoji: "✈️",
    sortOrder: 15,
    categoryOrder: ["trip", "spot"],
    categoryLabels: { trip: "여행", spot: "명소" },
  },
  night: {
    id: "night",
    name: "밤",
    emoji: "🌙",
    sortOrder: 16,
    categoryOrder: ["sky", "city"],
    categoryLabels: { sky: "하늘", city: "도시" },
  },
};

function tsEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function placementSize(width, height) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let defaultWidth = Math.round((w * MAX_SIDE) / Math.max(w, h));
  let defaultHeight = Math.round((h * MAX_SIDE) / Math.max(w, h));
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

function clearEdgeLightBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const stack = [];

  const isBg = (i) => {
    const o = i * 4;
    const a = data[o + 3];
    if (a < 12) return true;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    // Near-white / very light gray studio backdrop
    if (r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN) return true;
    if (Math.abs(r - g) <= 8 && Math.abs(g - b) <= 8 && r >= 220) return true;
    return false;
  };

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i] || !isBg(i)) return;
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
    data[i * 4 + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function processPng(srcPath, destPath) {
  const rawIn = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(rawIn.data);
  clearEdgeLightBackground(pixels, rawIn.info.width, rawIn.info.height);

  const cleaned = await sharp(pixels, {
    raw: { width: rawIn.info.width, height: rawIn.info.height, channels: 4 },
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
    trimmed = await sharp(cleaned).ensureAlpha().toBuffer({ resolveWithObject: true });
  }

  const margin = Math.min(
    MARGIN_MAX,
    Math.max(MARGIN_MIN, Math.round(MARGIN_RATIO * Math.max(trimmed.info.width, trimmed.info.height))),
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

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await fs.promises.writeFile(destPath, out.data);
  return { width: out.info.width, height: out.info.height };
}

async function main() {
  const packKey = process.argv[2];
  const catalogOnly = process.argv.includes("--catalog-only");
  const meta = PACK_META[packKey];
  if (!meta) {
    console.error(`Usage: node scripts/process-photowall-stickers.mjs <${Object.keys(PACK_META).join("|")}>`);
    process.exit(1);
  }

  const manifestPath = path.join(ROOT, "stickers-src", "photowall", packKey, "manifest.json");
  const rawDir = path.join(ROOT, "stickers-src", "photowall", packKey, "raw");
  const publicDir = path.join(ROOT, "public", "stickers", packKey);
  const outTs = path.join(ROOT, "src", "lib", "stickers", `${packKey}-catalog.generated.ts`);

  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
  const byCategory = new Map(meta.categoryOrder.map((id) => [id, []]));

  let index = 1;
  for (const sticker of manifest.stickers) {
    const rawName = `${String(index).padStart(3, "0")}-${sticker.id}.png`;
    const rawPath = path.join(rawDir, rawName);
    const cat = sticker.category;
    const destName = `${String(index).padStart(3, "0")}-${sticker.id}.png`;
    const destPath = path.join(publicDir, cat, destName);

    if (!catalogOnly) {
      if (!fs.existsSync(rawPath)) {
        console.warn(`SKIP missing raw: ${rawPath}`);
        index += 1;
        continue;
      }
      const size = await processPng(rawPath, destPath);
      console.log(`OK ${destName} → ${size.width}x${size.height}`);
    } else if (!fs.existsSync(destPath)) {
      console.warn(`SKIP missing public: ${destPath}`);
      index += 1;
      continue;
    }

    const dims = await sharp(destPath).metadata();
    const place = placementSize(dims.width ?? MAX_SIDE, dims.height ?? MAX_SIDE);
    const list = byCategory.get(cat) ?? [];
    list.push({
      id: sticker.fullId || `${packKey}.${cat}.${sticker.id}`,
      name: sticker.name,
      src: `${packKey}/${cat}/${destName}`,
      ...place,
    });
    byCategory.set(cat, list);
    index += 1;
  }

  const lines = [
    `/* Auto-generated by scripts/process-photowall-stickers.mjs — do not edit by hand. */`,
    `import type { StickerCategory } from "./types";`,
    ``,
    `function image(path: string): string {`,
    `  return \`/stickers/\${path}\`;`,
    `}`,
    ``,
    `export const ${packKey.toUpperCase()}_CATEGORIES: StickerCategory[] = [`,
  ];

  let total = 0;
  for (const catId of meta.categoryOrder) {
    const stickers = byCategory.get(catId) ?? [];
    if (!stickers.length) continue;
    lines.push(`  {`);
    lines.push(`    id: "${catId}",`);
    lines.push(`    name: "${tsEscape(meta.categoryLabels[catId] ?? catId)}",`);
    lines.push(`    stickers: [`);
    for (const s of stickers) {
      total += 1;
      lines.push(
        `      { id: "${s.id}", name: "${tsEscape(s.name)}", kind: "image", src: image("${tsEscape(s.src)}"), defaultWidth: ${s.defaultWidth}, defaultHeight: ${s.defaultHeight} },`,
      );
    }
    lines.push(`    ],`);
    lines.push(`  },`);
  }
  lines.push(`];`);
  lines.push(``);
  lines.push(`// ${total} stickers`);
  lines.push(``);

  await fs.promises.writeFile(outTs, lines.join("\n"), "utf8");
  console.log(`Wrote ${path.relative(ROOT, outTs)} (${total} stickers)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
