// Sinh screenshot App Store cho iPAD từ ảnh app thật (store-assets/play/phone-*.png).
// Apple bắt đúng cỡ pixel: iPad 12.9" = 2048x2732, iPad 13" = 2064x2752 (dọc).
//
// Vì sao chỉ iPad: app mobile-first (cột hẹp) → mở ở viewport iPad ra màn trống hoác.
// Nên đặt ảnh app vào KHUNG marketing (nền brand + tiêu đề) rồi render đúng pixel.
// iPHONE thì KHÔNG qua đây — chụp thẳng đúng pixel bằng capture-app-screens.mjs (thật hơn).
//
// Chạy (SAU capture-app-screens.mjs, không thì đóng khung ảnh cũ = lệch UI):
//   node scripts/generate-ios-screenshots.mjs
// Output: store-assets/ios/{ipad-12.9,ipad-13}/*.png
// Cần: puppeteer (đã có trong node_modules) + Chrome hệ thống.

import puppeteer from "puppeteer";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "store-assets", "play"); // ảnh app nguồn
const OUT = path.join(ROOT, "store-assets", "ios");  // screenshot App Store
// nhúng ảnh base64 (file:// trong setContent bị chặn → phải data URI)
async function dataUri(img) {
  const b = await readFile(path.join(SRC, img));
  return "data:image/png;base64," + b.toString("base64");
}

// Nguồn = ảnh app THẬT do capture-app-screens.mjs chụp (store-assets/play/phone-*.png).
// CHẠY capture-app-screens.mjs TRƯỚC, không thì đóng khung ảnh cũ = lệch UI.
const SHOTS = [
  { phone: "phone-1-home.png",     title: "Tất cả cho chuyến biển",     sub: "Mở app thấy ngay việc cần làm" },
  { phone: "phone-2-ra-khoi.png",  title: "Xem biển trước khi ra khơi", sub: "Dự báo cá · thời tiết · hải đồ vệ tinh" },
  { phone: "phone-3-muc-phat.png", title: "Tra mức phạt trong 5 giây",  sub: "Nghị định 38/2024 — gõ vài chữ là ra" },
  { phone: "phone-4-gia-ca.png",   title: "Giá cá & giá dầu hôm nay",   sub: "Tham khảo trước khi bán, trước khi bơm" },
];

// CHỈ iPad cần đóng khung: app mobile-first, canvas 3:4 nên phải đặt ảnh app lên nền brand.
// iPhone KHÔNG ở đây — chụp thẳng đúng pixel bằng capture-app-screens.mjs (thật hơn).
// pixel xuất = w*dsf x h*dsf. Apple bắt ĐÚNG pixel, không xê dịch.
const SIZES = [
  { name: "ipad-12.9", w: 1024, h: 1366, dsf: 2, src: "phone" }, // -> 2048 x 2732 (iPad Pro 12.9")
  { name: "ipad-13",   w: 1032, h: 1376, dsf: 2, src: "phone" }, // -> 2064 x 2752 (iPad 13")
];

// Khung marketing: chữ trên + ảnh app giữa. Ảnh giới hạn theo CHIỀU CAO nên
// vừa cả canvas dọc 9:19.5 (iPhone) lẫn 3:4 (iPad) — không tràn, không méo.
function html(shot, S, imgUri) {
  const { w: W, h: H } = S;
  const isPad = S.name.startsWith("ipad");
  const imgH = Math.round(H * (isPad ? 0.7 : 0.72));   // chiều cao ảnh app
  const titleSize = isPad ? 54 : 30;
  const subSize = isPad ? 26 : 16;
  const radius = isPad ? 26 : 34;
  return `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${W}px;height:${H}px;overflow:hidden;
      font-family:'Be Vietnam Pro',system-ui,sans-serif;
      background:linear-gradient(165deg,#1a5c8a 0%,#0e3556 60%,#0a2942 100%)}
    .wrap{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;
      padding:${Math.round(H*0.055)}px ${isPad ? 70 : 26}px 0}
    h1{color:#fff;font-size:${titleSize}px;font-weight:800;line-height:1.15;text-align:center;letter-spacing:-.3px}
    p{color:#ffd7a0;font-size:${subSize}px;font-weight:600;text-align:center;margin-top:${isPad ? 14 : 8}px}
    .phone{margin-top:${Math.round(H*0.04)}px;border-radius:${radius}px;overflow:hidden;
      border:${isPad ? 8 : 6}px solid rgba(255,255,255,.9);
      box-shadow:0 26px 60px -18px rgba(0,0,0,.6)}
    .phone img{display:block;height:${imgH}px;width:auto}
  </style></head>
  <body><div class="wrap">
    <h1>${shot.title}</h1>
    <p>${shot.sub}</p>
    <div class="phone"><img src="${imgUri}"></div>
  </div></body></html>`;
}

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--no-sandbox"],
});

for (const s of SIZES) {
  const outDir = path.join(OUT, s.name);
  await mkdir(outDir, { recursive: true });
  for (let i = 0; i < SHOTS.length; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: s.dsf });
    const uri = await dataUri(SHOTS[i][s.src]);
    await page.setContent(html(SHOTS[i], s, uri), { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await page.evaluate(() => Promise.all(Array.from(document.images).map(im => im.complete ? 1 : im.decode().catch(() => 1))));
    const out = path.join(outDir, `ios-${s.name}-${i + 1}.png`);
    await page.screenshot({ path: out });
    await page.close();
    console.log(`${s.w * s.dsf}x${s.h * s.dsf}`, out);
  }
}
await browser.close();
console.log("done");
