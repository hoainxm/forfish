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
  safariBar,
  hideSafariBar,
  safariShare,
  iosAddSheet,
  iosHome,
  fadeHome,
  noSignal,
  captionBottom,
} from "../phone-chrome";

// VIDEO 7 — IPHONE: thêm SDFish vào Màn hình chính (Safari không có nút cài như
// Android — phải đi qua nút Chia sẻ), rồi TẮT MẠNG THẬT để thấy app vẫn dùng
// được. iPhone còn một lý do RIÊNG phải thêm vào màn hình chính: Safari xoá sạch
// dữ liệu đã lưu sau ~7 ngày không dùng nếu chưa thêm (xem lib/storage-persist.ts).
//
// Thanh Safari, khay Chia sẻ và màn hình chính là VẼ LẠI (giao diện hệ điều
// hành, không quay được — xem phone-chrome.ts). App và đoạn mất sóng là thật.
// UA iPhone/Safari đã đặt sẵn trong playwright.config.ts.

/** Điểm biển để chạm — vùng thoáng, tránh cụm nhãn nhấp nháy trên bản đồ. */
const SEA = { x: 196, y: 300 };

test("video 7 — thêm SDFish vào Màn hình chính (iPhone) rồi dùng lúc mất sóng", async ({
  page,
  context,
}) => {
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
  await safariBar(page);
  await captionBottom(page, 215); // phụ đề nằm trên thanh Safari
  await page.waitForTimeout(600);

  await caption(page, "iPhone: mở Safari, vào trang SDFish", 2800);
  await caption(page, "iPhone không có nút cài — đi qua nút Chia sẻ", 2800);

  /* ── 1. Thẻ nhắc THẬT trong app đã chỉ đúng việc phải làm ───────────── */
  const banner = page.getByText("Cài SDFish về máy");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await scrollTo(page, "text=Thêm vào Màn hình chính");
  await caption(page, "App chỉ sẵn: bấm Chia sẻ, rồi Thêm vào Màn hình chính", 3200);

  /* ── 2. Nút Chia sẻ ở thanh dưới Safari ─────────────────────────────── */
  await caption(page, "Nút Chia sẻ — hình vuông có mũi tên đi lên", 2600);
  await tap(page, "#__ph_share");
  await safariShare(page);
  await page.waitForTimeout(1400);

  await caption(page, 'Vuốt lên tìm dòng "Thêm vào Màn hình chính"', 2800);
  await tap(page, "#__ph_a2hs");
  await page.waitForTimeout(900);
  await iosAddSheet(page);
  await page.waitForTimeout(1000);

  /* ── 3. Bấm Thêm ────────────────────────────────────────────────────── */
  await caption(page, 'Bấm "Thêm" ở góc trên bên phải', 2600);
  await tap(page, "#__ph_add_ok");
  await page.waitForTimeout(1200);

  /* ── 4. Biểu tượng nằm ở màn hình chính ─────────────────────────────── */
  await hideSafariBar(page);
  await captionBottom(page, 96);
  await iosHome(page, true);
  await page.waitForTimeout(1200);
  await caption(page, "Xong — biểu tượng SDFish nằm ở màn hình chính", 3000);
  await caption(
    page,
    "Với iPhone việc này BẮT BUỘC: chưa thêm thì máy tự xoá dữ liệu sau ít ngày",
    3600,
  );
  await tap(page, "#__ph_home_app");
  await page.waitForTimeout(700);
  await fadeHome(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await caption(page, "Mở từ biểu tượng: hết thanh trình duyệt, chạy như app", 3000);

  /* ── 5. Còn ở bờ: máy tự tải dự báo về ──────────────────────────────── */
  await caption(page, "Còn ở bờ còn sóng: mở Ra khơi MỘT LƯỢT", 2400);
  await tap(page, 'nav[aria-label="Điều hướng chính"] a[href="/ngu-truong"]');
  await page
    .getByText("Đang mở bản đồ biển…")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(2500);

  await caption(page, "Máy TỰ tải dự báo về — bà con không phải bấm gì", 2800);
  // Chờ tải xong rồi mới chạm điểm (xem lý do ở video 06).
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

  /* ── 6. Ra khơi — TẮT MẠNG THẬT ─────────────────────────────────────── */
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
  await noSignal(page, true);
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
