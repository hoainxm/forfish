import { defineConfig } from "@playwright/test";
import path from "node:path";

// ═══ BỘ TEST TRỢ LÝ GIỌNG NÓI — 13 §9 (AC-T27…T56), 14 §10 pha P3 ═══
// Chạy: npm run e2e:troly
//       npx playwright test -c playwright.troly.config.ts --project=api
//
// Cùng khuôn `playwright.san.config.ts` (kho FILE + persona `/dev`), khác hai chỗ:
//  · cổng RIÊNG 3033 và kho RIÊNG `.local/e2e-troly/market-dev.json` — chạy song
//    song với bộ chợ mà không đá kho của nhau;
//  · `ASSISTANT_MOCK=1` để `/api/tro-ly` trả lời bằng kịch bản giả lập, KHÔNG
//    gọi Anthropic (không tốn tiền, không phụ thuộc mạng, kết quả tất định).
//
// · project `api`    — chỉ `request`, không cần trình duyệt.
// · project `mobile` — chromium đội lốt iPhone. CẦN `npx playwright install chromium`.
//
// SAN_APP_DIR: thư mục chạy `next dev` (bản chép khi repo gốc đang giữ
// `.next/dev/lock`). Giữ CÙNG TÊN BIẾN với bộ chợ để một lệnh `sync-preview.sh`
// phục vụ cả hai bộ.
const APP_DIR = process.env.SAN_APP_DIR ? path.resolve(process.env.SAN_APP_DIR) : process.cwd();
const PORT = Number(process.env.TROLY_PORT ?? 3033);
const BASE_URL = `http://localhost:${PORT}`;
const STORE_FILE = path.join(APP_DIR, ".local", "e2e-troly", "market-dev.json");

// Trần lượt hỏi mạng/ngày cho bộ test — đọc bởi `getAssistantDailyLimit()` qua
// env `ASSISTANT_DAILY_LIMIT` (14 §6.2); ca test đọc lại hằng này, không chép số.
//
// Vì sao 30 chứ không phải một số bé cho nhanh: `takeQuota` chạy TRƯỚC
// `resolveMode`, nên MỌI lượt 200 — kể cả giả lập — ăn một lượt. Trần thấp làm
// các ca hợp đồng chết vì 429 giữa chừng, đỏ ở chỗ không có lỗi. Trần phải cao
// hơn số lượt của ca hợp đồng; ca quota dùng persona RIÊNG để đếm từ 0.
export const TROLY_DAILY_LIMIT = 30;

// Viewport iPhone 17 (402×874) — giống bộ chợ. ⚠️ CHROMIUM đội lốt iPhone, KHÔNG
// phải WebKit: không dùng làm bằng chứng cho hành vi Web Speech API của iOS thật
// (ca mic/TTS thật nằm ở docs/test-cases/tro-ly-2026-09-06.md nhóm E).
const mobile = {
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  browserName: "chromium" as const,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
  video: "off" as const,
  trace: "off" as const,
};

export default defineConfig({
  testDir: "./tests/e2e/troly",
  // Kho file + bộ đếm lượt là state DÙNG CHUNG cho cả bộ ⇒ tuần tự, một worker.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "./test-reports/troly/output",
  globalSetup: "./tests/e2e/troly/global-setup.ts",
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
    /*  KHÔNG dùng lại server đang chạy — khác bộ chợ, và có lý do cứng.

        Bộ đếm lượt hỏi mạng (`quota.ts`) sống trong RAM của instance: một Map
        trên `globalThis` để sống qua HMR. `global-setup` xoá được tệp
        `assistant-quota.json`, nhưng KHÔNG với tay vào RAM của một server đã
        chạy sẵn. Dùng lại server cũ ⇒ ca AC-T52 gặp 429 ngay lượt đầu và cả
        bảng ý định chết theo — đỏ ở chỗ không có lỗi nào.

        Nên mỗi lần chạy là một server mới, đếm từ 0. Cổng bận thì Playwright
        báo thẳng (global-setup nói rõ phải làm gì) thay vì âm thầm nối vào
        state cũ. */
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // `dev-market.mjs` spawn `next` qua PATH; Playwright không đi qua `npm run`.
      PATH: `${path.join(APP_DIR, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`,
      // Kho RIÊNG của bộ này (global-setup xoá đúng cặp tệp/thư mục ảnh).
      MARKET_STORE_FILE: STORE_FILE,
      // Trợ lý trả lời bằng kịch bản giả lập — không gọi Anthropic (14 §6.6).
      ASSISTANT_MOCK: "1",
      ASSISTANT_DAILY_LIMIT: String(TROLY_DAILY_LIMIT),
    },
  },
});
