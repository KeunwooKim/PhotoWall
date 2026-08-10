import sharp from "sharp";
import path from "path";
import fs from "fs";

const assets = "/home/kim/.cursor/projects/home-kim-PhotoWall/assets";

async function process(src, dest, width) {
  const trimmed = await sharp(src)
    .trim({ background: { r: 248, g: 248, b: 248, alpha: 1 }, threshold: 22 })
    .toBuffer({ resolveWithObject: true });
  await sharp(trimmed.data)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(dest);
  const st = fs.statSync(dest);
  console.log(path.basename(dest), `${trimmed.info.width}x${trimmed.info.height}`, st.size);
}

const strips = [
  "strip-cafe-day",
  "strip-evening-date",
  "strip-night-city",
  "strip-season-spring",
  "strip-home-cozy",
];
const photos = ["photo-day", "photo-evening", "photo-night", "photo-spring"];

for (const n of strips) {
  await process(path.join(assets, `${n}.png`), path.join("public/promo/strips", `${n}.webp`), 560);
}
for (const n of photos) {
  await process(path.join(assets, `${n}.png`), path.join("public/promo/photos", `${n}.webp`), 800);
}
