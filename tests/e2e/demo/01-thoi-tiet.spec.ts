import { test, expect } from "@playwright/test";
import {
  installOverlay,
  caption,
  hideCaption,
  tap,
  openRail,
  mockNoStorms,
} from "../tutorial-helpers";

// VIDEO 1 — THỜI TIẾT BIỂN: vào Ra khơi, bật lớp gió động + chạy thử dự báo
// 3 ngày, rồi chạm biển xem chi tiết sóng gió và xem trước ngày mai.
// (Rail bên phải phải thao tác TRƯỚC khi chạm biển — sheet đáy sẽ che rail.)
test("video 1 — xem thời tiết biển", async ({ page }) => {
  await page.route("**/sw.js", (r) => r.fulfill({ status: 404, body: "" }));
  await mockNoStorms(page);
  await installOverlay(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await caption(page, "SDFish — xem THỜI TIẾT BIỂN trước khi ra khơi", 2800);

  // chỉnh cỡ giao diện qua sheet Tài khoản (bộ video này dùng chế độ Gọn)
  await caption(page, "Trước tiên: chỉnh CỠ GIAO DIỆN cho hợp mắt mình", 2000);
  await tap(page, 'button:has-text("Đăng nhập")'); // chip Tài khoản trên hero (demo mode chưa đăng nhập)
  const sheet0 = page.locator('div[role="dialog"]');
  await sheet0.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await tap(page, 'div[role="dialog"] button:has-text("Chữ to")');
  await caption(page, '"Chữ to" — luôn to rõ, dễ đọc ngoài nắng…', 2200);
  await tap(page, 'div[role="dialog"] button:has-text("Gọn")');
  await caption(page, '…"Gọn" — mật độ như app thường. Video này dùng chế độ Gọn', 2600);
  await page.mouse.click(195, 60); // chạm nền mờ để đóng sheet
  await page.waitForTimeout(1200);

  await caption(page, 'Bấm "Ra khơi" ở thanh dưới cùng', 1800);
  await tap(page, 'nav[aria-label="Điều hướng chính"] a[href="/ngu-truong"]');

  // chờ bản đồ mở xong + tải ô nền
  await page
    .getByText("Đang mở bản đồ biển…")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(4000);

  // bật lớp gió động
  await caption(page, 'Mở bảng "Thời tiết" để bật lớp GIÓ trên bản đồ', 2000);
  await openRail(page);
  await tap(page, 'button:has-text("Thời tiết")');
  await page.waitForTimeout(1200);
  const gioSwitch = page.getByRole("switch", { name: /Gió \(Windy\)/ });
  if (await gioSwitch.count()) {
    const on = await gioSwitch.first().getAttribute("aria-checked");
    if (on !== "true") {
      await gioSwitch.first().hover();
      await page.waitForTimeout(500);
      await gioSwitch.first().click();
    }
    await caption(page, "Luồng gió chạy trên bản đồ — chỗ nào gió mạnh thấy liền", 3200);
  }
  await tap(page, 'button[aria-label="Đóng"]').catch(() => {});
  await page.waitForTimeout(1500);

  // chạy thử dự báo 3 ngày
  const play = page.locator('button[aria-label="Chạy thử 3 ngày"]');
  if (await play.count()) {
    await caption(page, 'Bấm nút chạy — xem gió sóng CHUYỂN BIẾN suốt 3 ngày tới', 2200);
    await play.first().hover();
    await page.waitForTimeout(400);
    await play.first().click();
    await page.waitForTimeout(9000);
    await page
      .locator('button[aria-label="Dừng chạy"]')
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
  }

  // chạm biển xem chi tiết
  await caption(page, "Chạm vào một điểm trên biển để xem gió sóng chỗ đó", 2200);
  await page.mouse.move(200, 290);
  await page.waitForTimeout(600);
  await page.mouse.click(200, 290);
  await page.waitForTimeout(2500);

  const sheet = page.locator(
    'section[role="region"][aria-label="Gió sóng chỗ đang xem"]',
  );
  await expect(sheet).toBeVisible({ timeout: 30_000 });

  await caption(page, "Vuốt lên để xem đầy đủ sóng, gió, mưa dông", 1800);
  await tap(page, 'div[aria-label="Vuốt lên xem thêm, vuốt xuống thu gọn"]');
  await page.waitForTimeout(1500);
  await caption(page, "Số liệu Open-Meteo: sóng cao bao nhiêu, gió cấp mấy", 3000);

  // đổi ngày dự báo
  const dayChips = page.locator(
    'div[role="group"][aria-label="Chọn ngày xem dự báo"] button',
  );
  if (await dayChips.count()) {
    await caption(page, 'Chạm "Ngày mai" để xem trước thời tiết ngày mai', 1800);
    const mai = dayChips.filter({ hasText: "Ngày mai" }).first();
    if (await mai.count()) {
      await mai.scrollIntoViewIfNeeded();
      await mai.hover();
      await page.waitForTimeout(500);
      await mai.click();
    }
    await page.waitForTimeout(2500);
  }

  await caption(page, "Nắm chắc thời tiết — ra khơi an toàn, đỡ tốn dầu", 3000);
  await hideCaption(page);
  await page.waitForTimeout(800);
});
