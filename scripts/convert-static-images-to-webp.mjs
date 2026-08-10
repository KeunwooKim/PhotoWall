#!/usr/bin/env node
/**
 * Generate WebP siblings for wallpapers + sticker PNGs (keeps originals as fallback).
 * Usage: node scripts/convert-static-images-to-webp.mjs [--wallpapers] [--stickers] [--quality=82]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const doWallpapers = args.length === 0 || args.includes("--wallpapers");
const doStickers = args.length === 0 || args.includes("--stickers");
const qualityArg = args.find((a) => a.startsWith("--quality="));
const quality = qualityArg ? Number(qualityArg.split("=")[1]) : 82;

async function walkPng(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkPng(full)));
    else if (entry.name.toLowerCase().endsWith(".png")) out.push(full);
  }
  return out;
}

async function convertFile(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, ".webp");
  const pngStat = fs.statSync(pngPath);
  if (fs.existsSync(webpPath)) {
    const webpStat = fs.statSync(webpPath);
    if (webpStat.mtimeMs >= pngStat.mtimeMs) return { skipped: true, saved: 0 };
  }
  await sharp(pngPath)
    .webp({ quality, effort: 4 })
    .toFile(webpPath);
  const saved = pngStat.size - fs.statSync(webpPath).size;
  return { skipped: false, saved: Math.max(0, saved) };
}

async function runDir(label, dir) {
  const files = await walkPng(dir);
  let converted = 0;
  let skipped = 0;
  let saved = 0;
  for (const file of files) {
    const result = await convertFile(file);
    if (result.skipped) skipped += 1;
    else {
      converted += 1;
      saved += result.saved;
    }
  }
  console.log(
    `[${label}] ${converted} converted, ${skipped} up-to-date, saved ~${(saved / 1024 / 1024).toFixed(1)} MB`,
  );
}

async function main() {
  if (doWallpapers) await runDir("wallpapers", path.join(ROOT, "public", "wallpapers"));
  if (doStickers) await runDir("stickers", path.join(ROOT, "public", "stickers"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
