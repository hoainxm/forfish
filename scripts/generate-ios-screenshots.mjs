// Sinh screenshot App Store (iOS) từ ảnh app thật trong play-assets/.
// Apple yêu cầu đúng cỡ pixel: 6.5" = 1242x2688, 6.7" = 1284x2778 (dọc).
// Ảnh Play cũ (1080x1920 = 9:16) KHÔNG khớp tỉ lệ iPhone → không resize thẳng được;
// script này đặt ảnh app vào KHUNG marketing (nền brand + tiêu đề) rồi render đúng cỡ.
//
// Chạy: node scripts/generate-ios-screenshots.mjs
// Output: play-assets/ios/6.5/*.png (1242x2688) + play-assets/ios/6.7/*.png (1284x2778)
// Cần: puppeteer (đã có trong node_modules) + Chrome hệ thống.

import puppeteer from "puppeteer";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "play-assets");
// nhúng ảnh base64 (file:// trong setContent bị chặn → phải data URI)
async function dataUri(img) {
  const b = await readFile(path.join(SRC, img));
  return "data:image/png;base64," + b.toString("base64");
}

// Ảnh app thật + tiêu đề marketing (tiếng Việt, ngắn)
const SHOTS = [
  { img: "real-1-home.png",     title: "Tất cả cho chuyến biển", sub: "Mở app thấy ngay việc cần làm" },
  { img: "real-2-danh-bat.png", title: "Xem biển trước khi ra khơi", sub: "Dự báo cá · thời tiết · hải đồ vệ tinh" },
  { img: "real-3-ban-ca.png",   title: "Giá cá & lãi lỗ rõ ràng", sub: "Ghi từng chuyến, chia tiền bạn thuyền" },
  { img: "real-4-van-hanh.png", title: "Bảo hành đồ mua SDVICO", sub: "App nhắc hạn — bấm gọi hỗ trợ ngay" },
  { img: "real-5-giay-to.png",  title: "Đủ điều kiện xuất bến chưa?", sub: "Giấy tờ tàu + checklist đèn xanh đỏ" },
];

// [tên, CSS width px, CSS height px] — pixel = width*3 x height*3 (deviceScaleFactor 3)
const SIZES = [
  { name: "6.5", w: 414, h: 896 },   // -> 1242 x 2688
  { name: "6.7", w: 428, h: 926 },   // -> 1284 x 2778
];

function html(shot, W, H, imgUri) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${W}px;height:${H}px;overflow:hidden;
      font-family:'Be Vietnam Pro',system-ui,sans-serif;
      background:linear-gradient(165deg,#1a5c8a 0%,#0e3556 60%,#0a2942 100%)}
    .wrap{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;
      padding:${Math.round(H*0.055)}px 26px 0}
    h1{color:#fff;font-size:30px;font-weight:800;line-height:1.15;text-align:center;letter-spacing:-.3px}
    p{color:#ffd7a0;font-size:16px;font-weight:600;text-align:center;margin-top:8px}
    .phone{margin-top:${Math.round(H*0.035)}px;border-radius:34px;overflow:hidden;
      border:6px solid rgba(255,255,255,.9);
      box-shadow:0 26px 60px -18px rgba(0,0,0,.6);width:${Math.round(W*0.82)}px}
    .phone img{display:block;width:100%;height:auto}
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
  const outDir = path.join(SRC, "ios", s.name);
  await mkdir(outDir, { recursive: true });
  for (let i = 0; i < SHOTS.length; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 3 });
    const uri = await dataUri(SHOTS[i].img);
    await page.setContent(html(SHOTS[i], s.w, s.h, uri), { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await page.evaluate(() => Promise.all(Array.from(document.images).map(im => im.complete ? 1 : im.decode().catch(() => 1))));
    const out = path.join(outDir, `ios-${s.name}-${i + 1}.png`);
    await page.screenshot({ path: out });
    await page.close();
    console.log(`${s.w * 3}x${s.h * 3}`, out);
  }
}
await browser.close();
console.log("done");
