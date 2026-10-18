import { defineConfig } from "@playwright/test";
import path from "node:path";

// ═══ BỘ TEST CHỢ VẬT TƯ (sàn đa người bán) — 12 §10.2 pha 3 ═══
// Chạy: npm run e2e:san            (cả hai project)
//       npx playwright test -c playwright.san.config.ts --project=api
//
// KHÁC HẲN `playwright.config.ts` (bộ quay video hướng dẫn): bộ này KHÔNG quay
// video, chạy trên `next dev` ở CHẾ ĐỘ KHO FILE (MARKET_STORE=file, 12 §5–§6)
// nên có persona `/api/dev/login` và dữ liệu seed RIÊNG `.local/e2e/market-dev.json`
// (qua `MARKET_STORE_FILE`, không đụng kho dev `.local/market-dev.json`).
//
// · project `api`    — chỉ dùng `request` (APIRequestContext), KHÔNG cần trình
//                      duyệt: chạy được cả khi chưa `npx playwright install`.
// · project `mobile` — chromium đội lốt iPhone (cùng viewport bộ cũ) cho các ca
//                      màn hình. CẦN chromium: `npx playwright install chromium`.
//
// SAN_APP_DIR: thư mục chạy `next dev`. Mặc định gốc repo; khi máy đang có một
// `next dev` khác giữ `.next/dev/lock` thì trỏ sang BẢN CHÉP để hai server sống
// chung (rsync sang thư mục tạm rồi `SAN_APP_DIR=<bản chép> npm run e2e:san`).
const APP_DIR = process.env.SAN_APP_DIR ? path.resolve(process.env.SAN_APP_DIR) : process.cwd();
const PORT = Number(process.env.SAN_PORT ?? 3031);
const BASE_URL = `http://localhost:${PORT}`;
// Tệp kho của bộ test — `file-store.ts` đọc `MARKET_STORE_FILE` (đường dẫn tệp),
// ảnh tải lên nằm ở `<dirname>/market-uploads/`. `global-setup.ts` xoá đúng cặp
// này; giữ hai chỗ khớp nhau bằng cùng một quy tắc đường dẫn.
const STORE_FILE = path.join(APP_DIR, ".local", "e2e", "market-dev.json");

// Viewport iPhone 17 (402×874 điểm logic) — giống bộ quay video, nhưng KHÔNG quay.
const mobile = {
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  // ⚠️ CHROMIUM đội lốt iPhone, KHÔNG phải WebKit — không dùng làm bằng chứng
  // cho hành vi service worker / lưu trữ của iOS (xem ghi chú playwright.config.ts).
  browserName: "chromium" as const,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
  video: "off" as const,
  trace: "off" as const,
};

export default defineConfig({
  testDir: "./tests/e2e/san",
  // Kho là MỘT tệp dùng chung cho cả bộ (tồn kho, đơn, shop đều đổi theo test)
  // ⇒ chạy tuần tự, một worker. Song song sẽ tự đá nhau, không phải lỗi sản phẩm.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "./test-reports/san/output",
  globalSetup: "./tests/e2e/san/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    extraHTTPHeaders: { "accept-language": "vi-VN,vi;q=0.9" },
  },
  projects: [
    {
      name: "api",
      testMatch: /api\..*\.spec\.ts/,
      // không `...mobile`: project này không mở trình duyệt nào
      use: { baseURL: BASE_URL },
    },
    {
      name: "mobile",
      testMatch: /ui\..*\.spec\.ts/,
      use: { ...mobile, baseURL: BASE_URL },
    },
  ],
  webServer: {
    command: `node scripts/dev-market.mjs -p ${PORT}`,
    cwd: APP_DIR,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // `dev-market.mjs` gọi `spawn("next", …)` qua PATH — Playwright không chạy
      // qua `npm run` nên phải tự thêm node_modules/.bin của thư mục app.
      PATH: `${path.join(APP_DIR, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`,
      // KHO RIÊNG CHO E2E: bộ test xoá sạch kho mỗi lần chạy (global-setup).
      // Trỏ vào `.local/e2e/` chứ KHÔNG dùng `.local/market-dev.json` chung —
      // nếu dùng chung thì chạy test là xoá luôn dữ liệu dev đang gõ tay.
      MARKET_STORE_FILE: STORE_FILE,
    },
  },
});
