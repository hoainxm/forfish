import { test, expect } from "@playwright/test";
import {
  installOverlay,
  caption,
  hideCaption,
  tap,
  openRail,
  mockNoStorms,
} from "../tutorial-helpers";

// VIDEO 2 — NGƯ TRƯỜNG: bản đồ vệ tinh (nhiệt độ nước / vùng nhiều mồi) +
// lớp DỰ BÁO CÁ (PFZ), chọn loài, chạm ô xem khả năng có cá.
test("video 2 — bản đồ ngư trường & dự báo cá", async ({ page }) => {
  test.setTimeout(420_000);
  await page.route("**/sw.js", (r) => r.fulfill({ status: 404, body: "" }));
  await mockNoStorms(page);
  // làm nóng dự báo cá trước khi quay (ISR — lần sau trả tức thì)
  await page.request.get("/api/fish-forecast", { timeout: 120_000 }).catch(() => {});
  await installOverlay(page);

  await page.goto("/ngu-truong");
  await page
    .getByText("Đang mở bản đồ biển…")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(4000);

  await caption(page, "SDFish — tìm NGƯ TRƯỜNG bằng bản đồ vệ tinh", 2800);

  // lớp nền vệ tinh
  await caption(page, 'Mở bảng "Hải đồ" để đổi lớp nền vệ tinh', 1800);
  await openRail(page);
  await tap(page, 'button:has-text("Hải đồ")');
  await page.waitForTimeout(1200);

  const nen = page.locator(
    'ul[role="radiogroup"][aria-label="Lớp nền bản đồ"] button[role="radio"]',
  );
  const sst = nen.filter({ hasText: "Nước nóng lạnh" }).first();
  if (await sst.count()) {
    await sst.click({ timeout: 8000 }).catch(() => sst.click({ force: true }));
    await caption(page, "Nước nóng lạnh — dòng nước ấm/lạnh gặp nhau là chỗ cá gom", 3200);
  }
  const chl = nen.filter({ hasText: "Vùng nhiều mồi" }).first();
  if (await chl.count()) {
    await chl.click({ timeout: 8000 }).catch(() => chl.click({ force: true }));
    await caption(page, "Vùng nhiều mồi (phù du) — mồi ở đâu, cá ở đó", 3200);
  }
  await tap(page, 'button[aria-label="Đóng"]').catch(() => {});
  await page.waitForTimeout(1000);

  // lớp dự báo cá
  await caption(page, 'Mở bảng "Ngư trường" — lớp DỰ BÁO CÁ', 1800);
  await openRail(page);
  await tap(page, 'button:has-text("Ngư trường")');
  await page.waitForTimeout(1200);
  const pfz = page.getByRole("switch", { name: /Dự báo cá/ });
  if (await pfz.count()) {
    const on = await pfz.first().getAttribute("aria-checked");
    if (on !== "true") {
      await pfz.first().click({ timeout: 8000 }).catch(() => {});
    }
    await caption(page, "Ô màu trên biển = điểm khả năng có cá: XANH thấp → ĐỎ cao", 3200);
  }
  // chọn loài (nhãn thật trong danh sách: "Cá ngừ vây vàng", "Cá ngừ chù", "Cá nục heo"…)
  const species = page
    .locator("button[aria-expanded]")
    .filter({ hasText: "Mọi loài" })
    .first();
  if (await species.count()) {
    await caption(page, "Chọn đúng loài mình đánh để bản đồ chỉ chỗ loài đó", 2000);
    await species.click({ timeout: 8000 }).catch(() => species.click({ force: true }));
    await page.waitForTimeout(1200);
    const opt = page
      .locator("button")
      .filter({ hasText: /Cá ngừ vây vàng|Cá ngừ chù|Cá nục heo/ })
      .first();
    if (await opt.count()) {
      await opt.click({ timeout: 8000 }).catch(() => opt.click({ force: true }));
      await page.waitForTimeout(2000);
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  await tap(page, 'button[aria-label="Đóng"]').catch(() => {});
  await page.waitForTimeout(2500);

  // chạm 1 ô xem chi tiết — chọn vùng biển THOÁNG (Vịnh Bắc Bộ), tránh chạm
  // đúng lên cụm marker "Điểm nóng có cá" đang nhấp nháy (chạm trúng cụm này
  // từng làm trình duyệt đứng hình khi quay — xem ghi chú trong triage-log).
  await caption(page, "Chạm vào một ô để xem chỗ đó có khả năng cá gì", 2200);
  await page.mouse.move(140, 150);
  await page.waitForTimeout(500);
  await page.mouse.click(140, 150);
  await page.waitForTimeout(2500);

  const sheet = page.locator(
    'section[role="region"][aria-label="Gió sóng chỗ đang xem"]',
  );
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await tap(page, 'div[aria-label="Vuốt lên xem thêm, vuốt xuống thu gọn"]');
  await page.waitForTimeout(1500);
  const fishCard = page.getByText(/khả năng/i).first();
  if (await fishCard.count()) {
    await fishCard.scrollIntoViewIfNeeded().catch(() => {});
    await caption(page, "Khả năng có cá + gió sóng chỗ đó — đủ để quyết định đi hay không", 3200);
  }

  await caption(page, "Dự báo tham khảo, cập nhật mỗi ngày — kết hợp kinh nghiệm bà con", 3000);
  await hideCaption(page);
  await page.waitForTimeout(800);
});
