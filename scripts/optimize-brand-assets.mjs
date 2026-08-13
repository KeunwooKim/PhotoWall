/**
 * Export V5 brand lockups + mark from design/logo-concepts.
 * Usage: node scripts/optimize-brand-assets.mjs
 *
 * Lockups are cropped from website-header light/dark PNGs (the designed lockup),
 * not recomposed from mark + CSS text.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "design/logo-concepts");
const OUT = path.join(ROOT, "public/brand");

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

async function contentBBox(input, isDark) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 8) continue;
      const nonBg = isDark ? r > 18 || g > 18 || b > 22 : r < 248 || g < 248 || b < 248;
      if (nonBg) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, width: info.width, height: info.height };
}

async function exportLockup(srcName, isDark, outBase) {
  const src = path.join(SRC, srcName);
  const box = await contentBBox(src, isDark);
  const pad = 24;
  const left = Math.max(0, box.minX - pad);
  const top = Math.max(0, box.minY - pad);
  const width = Math.min(box.width - left, box.maxX - box.minX + 1 + pad * 2);
  const height = Math.min(box.height - top, box.maxY - box.minY + 1 + pad * 2);

  const { data, info } = await sharp(src)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isDark) {
      if (r < 18 && g < 18 && b < 22) data[i + 3] = 0;
    } else if (r > 248 && g > 248 && b > 248) {
      data[i + 3] = 0;
    }
  }

  const trimmed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 5 })
    .toBuffer({ resolveWithObject: true });

  for (const h of [72, 144]) {
    const suffix = h === 72 ? "" : "@2x";
    await sharp(trimmed.data, {
      raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 },
    })
      .resize({ height: h, fit: "inside" })
      .webp({ quality: 95 })
      .toFile(path.join(OUT, `${outBase}${suffix}.webp`));
  }
}

async function transparentMarkFromPng() {
  const src = path.join(SRC, "photowall-logo-v5-mark-only.png");
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

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
      .toFile(path.join(OUT, `logo-mark${suffix}.webp`));
  }
}

async function faviconsFromSvg() {
  await writeFile(path.join(OUT, "logo-mark.svg"), MARK_SVG, "utf8");
  const svgBuf = Buffer.from(MARK_SVG);
  for (const size of [32, 180]) {
    const out = size === 32 ? "favicon.png" : "apple-touch-icon.png";
    await sharp(svgBuf, { density: 300 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, out));
  }
}

async function ogImage() {
  const src = path.join(SRC, "photowall-logo-v5-base-dark-gallery-grid.png");
  await sharp(src)
    .resize(1200, 630, {
      fit: "contain",
      background: { r: 15, g: 15, b: 18, alpha: 255 },
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "og-default.png"));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await exportLockup("photowall-logo-v5-website-header-light.png", false, "logo-lockup-light");
  await exportLockup("photowall-logo-v5-website-header-dark.png", true, "logo-lockup-dark");
  await transparentMarkFromPng();
  await faviconsFromSvg();
  await ogImage();
  console.log("Brand assets written to public/brand/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
