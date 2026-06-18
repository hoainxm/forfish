// Sinh icon PNG cho PWA/iOS/Android từ public/icon.svg (nguồn duy nhất).
// Chạy: npm run icons  (cần devDep sharp). Output commit vào public/icons/.
//
// · icon-192 / icon-512: icon nền đầy (svg đã có nền navy).
// · icon-maskable-512: thu nhỏ ~72% đặt giữa nền navy (safe-zone Android mask).
// · apple-touch-icon (180): iOS home screen, KHÔNG trong suốt.

import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "public/icon.svg";
const OUT = "public/icons";
const NAVY = { r: 0x14, g: 0x32, b: 0x4f, alpha: 1 };

const svg = await readFile(SRC);
await mkdir(OUT, { recursive: true });

async function render(size, file) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, file));
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(180, "apple-touch-icon.png");

// maskable — chừa safe zone
const inner = Math.round(512 * 0.72);
const fish = await sharp(svg, { density: 384 })
  .resize(inner, inner)
  .png()
  .toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: NAVY },
})
  .composite([{ input: fish, gravity: "center" }])
  .png()
  .toFile(path.join(OUT, "icon-maskable-512.png"));

console.log("Đã sinh icon vào", OUT);
