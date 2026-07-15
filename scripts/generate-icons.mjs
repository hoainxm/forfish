// Sinh icon PNG cho PWA/iOS/Android từ logo gốc `image/logo sdfish.png`.
// Chạy: npm run icons  (cần devDep sharp). Output commit vào public/icons/.
//
// Pipeline:
//   1. Đọc PNG gốc (mark + chữ "SDFish" trên nền giấy trắng)
//   2. Trim viền giấy thừa
//   3. Cắt nửa trên = chỉ giữ MARK (cá + 2 vòng cung + la bàn), bỏ chữ
//   4. Nền trắng bo góc, đặt mark giữa
//
// · icon-192 / icon-512: app icon đầy khung, bo 22% (≈ ios/android system mask)
// · icon-maskable-512: mark thu nhỏ 65% chính giữa, an toàn cho Android adaptive mask
// · apple-touch-icon (180): iOS home screen
// · src/app/icon.png (32) + src/app/apple-icon.png (180): favicon Next App Router
//   (convention file-based — Next tự generate <link rel="icon"> + apple-touch-icon)
//
// Đổi sang nền navy: set BG = NAVY. Đổi tỉ lệ mark trong khung: chỉnh SCALE.

import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const SRC = "image/logo sdfish.png";
const OUT = "public/icons";
const APP_DIR = "src/app";
const BG = "#ffffff"; // giấy trắng theo bộ logo gốc; đổi "#0e3556" nếu muốn navy
const SCALE = 0.86; // mark chiếm 86% khung app icon (chừa padding)
const MASKABLE_SCALE = 0.66; // Android adaptive: safe-zone trong vòng tròn nội tiếp

await mkdir(OUT, { recursive: true });

// 1+2. Đọc + trim giấy
const trimmed = await sharp(await readFile(SRC))
  .trim({ threshold: 12 })
  .toBuffer();
const m = await sharp(trimmed).metadata();

// 3. Cắt nửa trên — bỏ chữ "SDFish" (chiếm ~28% dưới). Lấy MARK vuông cân giữa.
const markH = Math.round(m.height * 0.72);
const markW = m.width;
const markSquareSide = Math.min(markW, markH);
const markSquareLeft = Math.round((markW - markSquareSide) / 2);
const mark = await sharp(trimmed)
  .extract({ left: markSquareLeft, top: 0, width: markSquareSide, height: markSquareSide })
  .toBuffer();

async function makeIcon(size, outPath, scale = SCALE, rounded = true) {
  const inner = Math.round(size * scale);
  const innerMark = await sharp(mark)
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const radius = rounded ? Math.round(size * 0.22) : 0;
  const bgSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/></svg>`
  );

  await sharp(bgSvg)
    .composite([{ input: innerMark, gravity: "center" }])
    .png()
    .toFile(outPath);
}

await makeIcon(192, path.join(OUT, "icon-192.png"));
await makeIcon(512, path.join(OUT, "icon-512.png"));
await makeIcon(180, path.join(OUT, "apple-touch-icon.png"));
// maskable: chừa safe zone rộng hơn (Android có thể cắt tròn/đa giác)
await makeIcon(512, path.join(OUT, "icon-maskable-512.png"), MASKABLE_SCALE);

// Next App Router file-based favicon: src/app/icon.png + src/app/apple-icon.png
// Tự sinh <link rel="icon"> + apple-touch-icon, ưu tiên hơn favicon.ico mặc định.
// Tab nhỏ → bo nhẹ (10%) cho icon 32px khỏi cong quá; apple-icon = full 22%.
await makeIcon(32, path.join(APP_DIR, "icon.png"), 0.92, false);
await makeIcon(180, path.join(APP_DIR, "apple-icon.png"));

// ── Android launcher icons (Capacitor native) ─────────────────────────────
// Trước đây mipmap-*/ic_launcher* là icon Capacitor mặc định (chữ X) → app cài
// về khác store listing → Google flag "Misleading Claims". Sinh lại từ logo SDFish.
//   · ic_launcher.png       : legacy vuông (API<26), nền trắng bo góc
//   · ic_launcher_round.png : legacy tròn (launcher tròn cũ)
//   · ic_launcher_foreground: foreground adaptive (API≥26) — mark trên nền trong
//     suốt, thu trong safe-zone; background = @color/ic_launcher_background (#FFF)
const ANDROID_RES = "android/app/src/main/res";
// [dir, launcher px, foreground canvas px] theo mật độ mdpi→xxxhdpi
const ANDROID_DENSITIES = [
  ["mipmap-mdpi", 48, 108],
  ["mipmap-hdpi", 72, 162],
  ["mipmap-xhdpi", 96, 216],
  ["mipmap-xxhdpi", 144, 324],
  ["mipmap-xxxhdpi", 192, 432],
];

// Foreground adaptive: mark ~62% giữa canvas trong suốt (safe-zone 66/108dp)
async function makeAdaptiveForeground(canvas, outPath) {
  const inner = Math.round(canvas * 0.62);
  const innerMark = await sharp(mark)
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  const transparent = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}"></svg>`
  );
  await sharp(transparent)
    .composite([{ input: innerMark, gravity: "center" }])
    .png()
    .toFile(outPath);
}

// Legacy tròn: mark trên đĩa trắng
async function makeRoundIcon(size, outPath) {
  const inner = Math.round(size * 0.72);
  const innerMark = await sharp(mark)
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  const r = size / 2;
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="${BG}"/></svg>`
  );
  await sharp(circle)
    .composite([{ input: innerMark, gravity: "center" }])
    .png()
    .toFile(outPath);
}

for (const [dir, px, fg] of ANDROID_DENSITIES) {
  const base = path.join(ANDROID_RES, dir);
  await mkdir(base, { recursive: true });
  await makeIcon(px, path.join(base, "ic_launcher.png"), 0.86); // legacy vuông
  await makeRoundIcon(px, path.join(base, "ic_launcher_round.png")); // legacy tròn
  await makeAdaptiveForeground(fg, path.join(base, "ic_launcher_foreground.png"));
}

console.log("Đã sinh icon vào", OUT, "+", APP_DIR, "+", ANDROID_RES);
