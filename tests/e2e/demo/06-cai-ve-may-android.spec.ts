import { test, expect } from "@playwright/test";
import {
  installOverlay,
  caption,
  hideCaption,
  tap,
  scrollTo,
} from "../tutorial-helpers";
import {
  installPhoneChrome,
  fakeInstallPrompt,
  androidBar,
  hideAndroidBar,
  androidHome,
  fadeHome,
  noSignal,
} from "../phone-chrome";

// VIDEO 6 — ANDROID: cài SDFish về máy từ web (không qua chợ ứng dụng), rồi
// TẮT MẠNG THẬT để bà con thấy app vẫn mở được và dự báo đã tải vẫn còn.
//
// Vỏ máy (thanh Chrome, hộp thoại "Cài đặt", màn hình chính) là VẼ LẠI — đó là
// giao diện hệ điều hành, nằm ngoài trang web nên không quay được (xem
// phone-chrome.ts). Phần app và đoạn mất sóng là thật.
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

test.use({ userAgent: ANDROID_UA });

/** Điểm biển để chạm — vùng thoáng, tránh cụm nhãn nhấp nháy trên bản đồ. */
const SEA = { x: 196, y: 300 };

test("video 6 — cài SDFish về máy (Android) rồi dùng lúc mất sóng", async ({
  page,
  context,
}) => {
  // Tin bão: lúc CÒN SÓNG cho "trời yên biển lặng" (nguồn GDACS chập chờn sẽ
  // làm video dính banner lỗi); lúc TẮT MẠNG thì thả ra cho hỏng thật — app
  // phải nói "chưa hỏi được", không được nói "không có bão".
  let stormsOnline = true;
  await context.route(/\/api\/storms/, (r) =>
    stormsOnline
      ? r.fulfill({
          json: { ok: true, storms: [], checkedAt: new Date().toISOString() },
        })
      : r.abort("internetdisconnected"),
  );

  await installOverlay(page);
  await installPhoneChrome(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await androidBar(page);
  await page.waitForTimeout(600);

  await caption(page, "Điện thoại Android: mở Chrome, vào trang SDFish", 2800);
  await caption(page, "Cài thẳng từ web — không phải lên chợ ứng dụng", 2600);

  /* ── 1. Thẻ nhắc THẬT trong app ─────────────────────────────────────── */
  await fakeInstallPrompt(page);
  const banner = page.getByText("Cài SDFish về máy");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await scrollTo(page, 'button:has-text("Cài về máy")');
  await caption(page, 'App nhắc: "Cài SDFish về máy" — bấm nút xanh', 2600);
  await tap(page, 'button:has-text("Cài về máy")');
  await page.waitForTimeout(1000);

  /* ── 2. Chrome hỏi lại ──────────────────────────────────────────────── */
  await caption(page, 'Máy hỏi lại — bấm "Cài đặt"', 2400);
  await tap(page, "#__ph_install_ok");
  await page.waitForTimeout(1400);

  /* ── 3. Biểu tượng nằm ở màn hình chính ─────────────────────────────── */
  await hideAndroidBar(page);
  await androidHome(page, true);
  await page.waitForTimeout(1200);
  await caption(page, "Xong — biểu tượng SDFish nằm ở màn hình chính", 3000);
  await caption(page, "Từ nay mở app bằng biểu tượng này", 2400);
  await tap(page, "#__ph_home_app");
  await page.waitForTimeout(700);
  await fadeHome(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await caption(page, "Mở từ biểu tượng: hết thanh trình duyệt, chạy như app", 3000);

  /* ── 4. Còn ở bờ: máy tự tải dự báo về ──────────────────────────────── */
  await caption(page, "Còn ở bờ còn sóng: mở Ra khơi MỘT LƯỢT", 2400);
  await tap(page, 'nav[aria-label="Điều hướng chính"] a[href="/ngu-truong"]');
  await page
    .getByText("Đang mở bản đồ biển…")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);

  await caption(page, "Máy TỰ tải dự báo về — bà con không phải bấm gì", 2800);
  // Chờ tải xong RỒI mới chạm điểm: chạm sớm thì máy chưa có lưới gió sóng nào
  // để lấy số, sheet sẽ nói "chỗ này chưa có số nào lưu trong máy" (đúng nhưng
  // dạy sai). Nguồn chậm quá thì đi tiếp — không để video đứng hình.
  await page
    .getByText("Đang tải dự báo…")
    .waitFor({ state: "hidden", timeout: 120_000 })
    .catch(() => {});
  await page.waitForTimeout(1500);

  await caption(page, "Chạm chỗ mình hay đánh — số chỗ đó cũng được cất vào máy", 2800);
  await page.mouse.move(SEA.x, SEA.y);
  await page.waitForTimeout(700);
  await page.mouse.click(SEA.x, SEA.y);
  await page.waitForTimeout(3500);

  /* ── 5. Ra khơi — TẮT MẠNG THẬT ─────────────────────────────────────── */
  await caption(page, "Giờ ra khơi xa bờ — mất sóng hoàn toàn", 2600);
  stormsOnline = false;
  await context.setOffline(true);
  await noSignal(page, true);
  await page.waitForTimeout(1500);

  await caption(page, "Mở lại app lúc không có một vạch sóng nào…", 2400);
  await page.reload();
  await page
    .getByText("Đang mở bản đồ biển…")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await noSignal(page, true); // vẽ lại sau khi trang tải lại
  await page.waitForTimeout(2500);
  await caption(page, "App vẫn lên — vì đã nằm sẵn trong máy", 3000);

  await caption(page, "Chạm lại chỗ nãy: số dự báo đã lưu vẫn xem được", 2600);
  await page.mouse.move(SEA.x, SEA.y);
  await page.waitForTimeout(700);
  await page.mouse.click(SEA.x, SEA.y);
  await page.waitForTimeout(4000);

  await caption(page, "Nhớ: trước mỗi chuyến, mở app lúc còn sóng cho máy tải sẵn", 3600);
  await hideCaption(page);
  await page.waitForTimeout(900);

  await context.setOffline(false);
});
