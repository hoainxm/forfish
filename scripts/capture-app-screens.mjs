// Chụp ảnh store TỪ APP ĐANG CHẠY — đúng viewport từng store nên ra ĐÚNG PIXEL,
// khỏi resize, và khớp 100% giao diện thật (không dùng ảnh cũ đã lệch).
//
// Vì sao cần: ảnh cũ chụp 2026-07-01, login-gate lên 2026-07-02 → ảnh khoe nội dung
// mà app hiện chặn bằng thẻ khóa = sai lệch, rủi ro bị store flag Misleading Claims.
//
// Chuẩn bị:
//   1. NÊN chụp trên bản production (dev overlay + perf khác bản thật):
//        npm run build && npm start            (http://localhost:3000)
//      Dev cũng chạy được (npm run dev) — script tự ẩn dev overlay của Next.
//   2. Thêm vào .env.local (KHÔNG commit):
//        SHOT_PHONE=0901234567
//        SHOT_PASSWORD=matkhau-tai-khoan-test
//      Tài khoản test này Apple cũng đòi cho reviewer → khai luôn ở App Review Information.
//      Lưu ý: tài khoản phải ĐÃ đổi mật khẩu lần đầu, không thì app đá về /doi-mat-khau.
//   3. node scripts/capture-app-screens.mjs
//
// Output (ghi đè bộ cũ):
//   store-assets/play/phone-*.png      1080x1920  (Google Play)
//   store-assets/ios/6.5/*.png         1242x2688  (iPhone 6.5")
//   store-assets/ios/6.7/*.png         1284x2778  (iPhone 6.7")
// iPad phải đóng khung riêng → scripts/generate-ios-screenshots.mjs

import puppeteer from "puppeteer";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.SHOT_BASE_URL || "http://localhost:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// đọc .env.local (node không tự nạp) — chỉ lấy 2 key cần, không log giá trị
async function loadEnv() {
  try {
    const txt = await readFile(".env.local", "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* không có .env.local — bỏ qua */ }
}
await loadEnv();

const PHONE = process.env.SHOT_PHONE;
const PASSWORD = process.env.SHOT_PASSWORD;

// viewport CSS × DPR = pixel store yêu cầu. ĐỪNG đổi số nếu chưa đối chiếu store.
const SIZES = [
  { name: "play-phone", w: 360, h: 640, dsf: 3, out: "store-assets/play",     file: (s) => `phone-${s}.png` },       // 1080x1920
  { name: "ios-6.5",    w: 414, h: 896, dsf: 3, out: "store-assets/ios/6.5",  file: (s) => `ios-6.5-${s}.png` },     // 1242x2688
  { name: "ios-6.7",    w: 428, h: 926, dsf: 3, out: "store-assets/ios/6.7",  file: (s) => `ios-6.7-${s}.png` },     // 1284x2778
];

// Thứ tự = thứ tự hiện trên store.
// CHỈ chụp màn PUBLIC — có nội dung thật, không cần login:
//  · Màn login-gate (Tàu›Sản phẩm/Dịch vụ/Giấy tờ, Tiền›Hiệu quả) đã BỎ: tài khoản test
//    chưa gắn tàu/sản phẩm SDVICO (data sync từ SDWork) → chụp ra màn TRỐNG, vô dụng cho store.
//  · Cũng KHÔNG login khi chụp: login vào thì Home hiện "Thêm tàu của bạn" (rỗng),
//    xấu hơn bản logged-out ("Bốn việc chính").
// Có tài khoản gắn sản phẩm SDVICO → thêm route needLogin:true, script tự đăng nhập.
// 2026-07-30: bỏ 3-muc-phat (tab Mức phạt gỡ 2026-07-27 → route chết); 4-gia-ca
// đổi path /tien?tab=giao-dich → /tien (khu Giao dịch KHÔNG còn tab). Giữ nguyên
// nguyên tắc chỉ chụp màn PUBLIC (tài khoản test chưa gắn tàu/SP → gated ra trống).
const ROUTES = [
  { slug: "1-home",     path: "/",           wait: 1500, needLogin: false },
  { slug: "2-ra-khoi",  path: "/ngu-truong", wait: 8000, needLogin: false }, // map tile chậm
  { slug: "3-cho",      path: "/tien",       wait: 3000, needLogin: false },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Next dev mode chèn <nextjs-portal> (badge "N" góc trái dưới) — đè lên dock,
// lọt vào ảnh store = artifact dev. Ẩn ở MỌI trang, kể cả sau client-nav.
const HIDE_DEV_OVERLAY = `nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}`;
async function cleanChrome(page) {
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY }).catch(() => {});
}

const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage();
// TẮT tour onboarding (coach-mark "BƯỚC 1/2") trước khi app JS chạy — profile
// puppeteer mới toanh nên tour bung ra che màn + làm tối nền = ảnh store hỏng.
// forfish.tour.enabled.v1 = "off" ⇒ isTourEnabled() false (src/lib/tour.ts).
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem("forfish.tour.enabled.v1", "off");
  } catch {}
});
await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 3 });

// ── đăng nhập 1 lần (session giữ trong localStorage, dùng lại cho mọi viewport).
// Chỉ login khi CÓ route cần — login thừa làm Home hiện empty-state của tài khoản test.
const needsLogin = ROUTES.some((r) => r.needLogin);
let loggedIn = false;
if (!needsLogin) {
  console.log("• Bộ route toàn màn public → bỏ qua đăng nhập (tránh empty-state).");
} else if (PHONE && PASSWORD) {
  // networkidle2 + chờ hydrate: input là controlled component — gõ trước khi React
  // hydrate thì giá trị KHÔNG vào state, submit rỗng, login câm lặng thất bại.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[type="tel"]', { timeout: 15000 });
  await sleep(2000);
  await page.type('input[type="tel"]', PHONE, { delay: 30 });
  await page.type('input[type="password"]', PASSWORD, { delay: 30 });
  await page.click('button[type="submit"]');
  // redirect sau login là client-side router.push → waitForNavigation không bắt được.
  // Chờ pathname thật sự rời /login thay vì sleep đoán mò.
  await page
    .waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 30000 })
    .catch(() => {});
  await sleep(2500);
  const url = page.url();
  if (url.includes("/doi-mat-khau")) {
    console.error("⚠ Tài khoản còn cờ must_change_password → app ép đổi mật khẩu.");
    console.error("  Đăng nhập tay 1 lần, đổi mật khẩu, cập nhật SHOT_PASSWORD rồi chạy lại.");
  } else if (url.includes("/login")) {
    console.error("⚠ Đăng nhập KHÔNG thành công — kiểm SHOT_PHONE / SHOT_PASSWORD.");
  } else {
    loggedIn = true;
    console.log("✓ Đăng nhập OK");
  }
} else {
  console.warn("⚠ Thiếu SHOT_PHONE/SHOT_PASSWORD trong .env.local → bỏ qua màn cần login.");
}

// ── chụp
for (const s of SIZES) {
  await mkdir(s.out, { recursive: true });
  await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: s.dsf });
  for (const r of ROUTES) {
    if (r.needLogin && !loggedIn) { console.log(`  bỏ qua (cần login): ${r.slug}`); continue; }
    try {
      // domcontentloaded, KHÔNG networkidle: HMR websocket + map tile giữ kết nối
      // nên networkidle không bao giờ tới → treo. Chờ nội dung bằng r.wait.
      await page.goto(BASE + r.path, { waitUntil: "domcontentloaded", timeout: 60000 });
      await cleanChrome(page);
      await sleep(r.wait);
      const out = path.join(s.out, s.file(r.slug));
      await page.screenshot({ path: out });        // viewport, KHÔNG fullPage → đúng pixel
      console.log(`${s.w * s.dsf}x${s.h * s.dsf}  ${out}`);
    } catch (e) {
      console.error(`  ✗ LỖI ${r.slug} @ ${s.name}: ${e.message.split("\n")[0]}`);
    }
  }
}
await browser.close();
console.log("done — nhớ soi lại từng ảnh trước khi upload (thẻ khóa? data giả? tràn?)");
