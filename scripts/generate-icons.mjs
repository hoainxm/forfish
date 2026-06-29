// Sinh icon PNG cho PWA/iOS/Android từ public/logo-src.png (nguồn duy nhất).
// Chạy: npm run icons  (cần devDep sharp). Output commit vào public/icons/.
//
// Logo mới (2026-06-29): cá ngừ + la bàn, xanh↔cam, nền off-white #f4f4f4.
// · icon-192 / icon-512: logo full-bleed (nền off-white của logo lấp đầy tile).
// · icon-maskable-512: logo thu vào safe-zone Android (~80%), nền off-white
//   khớp màu nền logo → liền mạch, không thấy viền vuông khi máy bo tròn.
// · apple-touch (180): iOS home screen, KHÔNG trong suốt.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "public/logo-src.png";
const OUT = "public/icons";
// Màu nền logo (sample góc ảnh) — dùng cho maskable để liền mạch.
const BG = { r: 0xf4, g: 0xf4, b: 0xf4, alpha: 1 };

await mkdir(OUT, { recursive: true });

async function render(size, file) {
  await sharp(SRC)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .png()
    .toFile(path.join(OUT, file));
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(180, "apple-touch-icon.png");

// maskable — logo nằm trong safe-zone (Android mask cắt tới ~80% biên).
const inner = Math.round(512 * 0.8);
const logo = await sharp(SRC)
  .resize(inner, inner, { fit: "cover", kernel: "lanczos3" })
  .png()
  .toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: BG },
})
  .composite([{ input: logo, gravity: "center" }])
  .png()
  .toFile(path.join(OUT, "icon-maskable-512.png"));

console.log("Đã sinh icon vào", OUT);
