/**
 * Export live brand files from design/logo-concepts into public/brand.
 * Usage: node scripts/optimize-brand-assets.mjs
 *
 * Sources: logo.png (lockup), mark.png (neon mark).
 * Light UI wordmark #0a0a0a. Dark UI wordmark white.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "design/logo-concepts");
const OUT = path.join(ROOT, "public/brand");
const LOCKUP_SRC = path.join(SRC, "logo.png");
const MARK_SRC = path.join(SRC, "mark.png");

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
  <defs>
    <linearGradient id="g" x1="4" y1="20" x2="36" y2="20" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FF5B8D"/><stop offset="1" stop-color="#B8E0D2"/>
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="14" height="14" rx="3.5" fill="white" stroke="url(#g)" stroke-width="2.4"/>
  <rect x="21" y="5" width="14" height="14" rx="3.5" fill="white" stroke="url(#g)" stroke-width="2.4"/>
  <rect x="5" y="21" width="14" height="14" rx="3.5" fill="white" stroke="url(#g)" stroke-width="2.4"/>
  <rect x="21" y="21" width="14" height="14" rx="3.5" fill="white" stroke="url(#g)" stroke-width="2.4"/>
</svg>`;

/** Right edge of the neon mark (high-chroma pixels). Highlights on the mark are near-white and must not be recolored with the wordmark. */
function markRightEdge(data, width, height) {
  let maxX = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) continue;
      const chroma = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      if (chroma > 28 && x > maxX) maxX = x;
    }
  }
  return maxX;
}

function recolorWordmark(data, width, height, rgb) {
  const minX = markRightEdge(data, width, height) + 16;
  for (let y = 0; y < height; y++) {
    for (let x = minX; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 8) continue;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma > 28) continue;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  }
}

async function writeLockupWebp(pngBuf, baseName) {
  for (const h of [72, 144]) {
    const suffix = h === 72 ? "" : "@2x";
    await sharp(pngBuf)
      .resize({ height: h, fit: "inside" })
      .webp({ quality: 95 })
      .toFile(path.join(OUT, `${baseName}${suffix}.webp`));
  }
}

async function exportLockups() {
  const { data, info } = await sharp(LOCKUP_SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const lightData = Buffer.from(data);
  recolorWordmark(lightData, info.width, info.height, [10, 10, 10]);
  const lightPng = await sharp(lightData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 3 })
    .png()
    .toBuffer();

  const darkData = Buffer.from(data);
  recolorWordmark(darkData, info.width, info.height, [255, 255, 255]);
  const darkPng = await sharp(darkData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 3 })
    .png()
    .toBuffer();

  await writeLockupWebp(lightPng, "logo-light");
  await writeLockupWebp(darkPng, "logo-dark");
}

async function exportMark() {
  const { data, info } = await sharp(MARK_SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 40 && g < 40 && b < 45) data[i + 3] = 0;
  }

  const trimmed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .toBuffer({ resolveWithObject: true });

  for (const size of [64, 128]) {
    const suffix = size === 64 ? "" : "@2x";
    await sharp(trimmed.data, {
      raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 },
    })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 95 })
      .toFile(path.join(OUT, `mark${suffix}.webp`));
  }
}

async function exportFavicons() {
  await writeFile(path.join(OUT, "mark.svg"), MARK_SVG, "utf8");
  const svgBuf = Buffer.from(MARK_SVG);
  for (const size of [32, 180]) {
    const out = size === 32 ? "favicon.png" : "apple-touch-icon.png";
    await sharp(svgBuf, { density: 300 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, out));
  }
}

async function exportOg() {
  const logo = await sharp(path.join(OUT, "logo-dark@2x.webp"))
    .resize({ width: 720, fit: "inside" })
    .toBuffer();
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 15, g: 15, b: 18, alpha: 255 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "og.png"));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await exportLockups();
  await exportMark();
  await exportFavicons();
  await exportOg();
  console.log("Brand assets written to public/brand/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
