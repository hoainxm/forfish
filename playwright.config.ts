import { defineConfig } from "@playwright/test";

// E2E quay video hướng dẫn — 2 biến thể build (xem scripts/e2e-build.mjs):
// · demo (cổng 3100): không Supabase — video thời tiết / ngư trường / dẫn đường
// · auth (cổng 3101): env Supabase GIẢ + mock page.route() — video cảnh báo
//   thuyền viên / giao dịch (cần trạng thái "đã đăng nhập")
// Build trước: node scripts/e2e-build.mjs all ; chạy: npm run e2e:videos
//
// Viewport iPhone 17 (6,3" · 1206×2622px vật lý @3x → 402×874 điểm logic).
const IPHONE17_WIDTH = 402;
const IPHONE17_HEIGHT = 874;
const mobile = {
  viewport: { width: IPHONE17_WIDTH, height: IPHONE17_HEIGHT },
  // Ghi hình ở 1x (nhẹ, ổn định cho canvas WebGL của MapLibre) — xuất video
  // sẽ phóng đúng 3x ra độ phân giải vật lý thật của máy (1206×2622) sau khi
  // quay xong. Để 3x ngay khi quay từng treo cứng browser ở màn Ngư trường
  // (canvas 1206×2622 quá nặng cho software WebGL của Chromium headless).
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  browserName: "chromium" as const, // Safari thật là WebKit — dùng Chromium (đã cài, ổn định trên Windows)
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  video: {
    mode: "on" as const,
    size: { width: IPHONE17_WIDTH, height: IPHONE17_HEIGHT },
  },
  trace: "off" as const,
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 240_000,
  // Lưới an toàn: một hành động (click/hover) không có timeout riêng có thể
  // đợi VÔ HẠN nếu bị lớp khác che, chỉ dừng khi hết giờ CẢ BÀI TEST — từng
  // làm treo cứng 7 phút. Chặn ở đây để lỗi lộ ra nhanh, không nuốt cả video.
  use: { actionTimeout: 15_000, navigationTimeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./test-reports/triage/e2e-output",
  projects: [
    {
      name: "demo",
      testMatch: /demo[\\/].*\.spec\.ts/,
      use: { ...mobile, baseURL: "http://localhost:3100" },
    },
    {
      name: "auth",
      testMatch: /auth[\\/].*\.spec\.ts/,
      use: { ...mobile, baseURL: "http://localhost:3101" },
    },
  ],
  webServer: [
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        E2E_DEMO_BUILD: "1",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        SDWORK_SUPABASE_URL: "",
        SDWORK_SUPABASE_ANON_KEY: "",
      },
    },
    {
      command: "npx next start -p 3101",
      url: "http://localhost:3101",
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        E2E_AUTH_BUILD: "1",
        // giữ đúng env giả của build — server không bao giờ gọi tới host này
        // cho flow được quay (mọi request Supabase bị mock ở trình duyệt)
        NEXT_PUBLIC_SUPABASE_URL: "https://e2edemo.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-demo-anon-key",
        SDWORK_SUPABASE_URL: "",
        SDWORK_SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        ADMIN_PHONES: "",
      },
    },
  ],
});
