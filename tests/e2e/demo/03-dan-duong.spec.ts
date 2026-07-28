import { test, expect } from "@playwright/test";
import {
  installOverlay,
  caption,
  hideCaption,
  tap,
  mockNoStorms,
  scrollTo,
} from "../tutorial-helpers";

// VIDEO 3 — DẪN ĐƯỜNG TIẾT KIỆM DẦU: chạm điểm đến trên biển, mở bảng dẫn
// đường, khai tốc độ + máy ăn dầu, tính tuyến né sóng gió + lít dầu ước tính.
test("video 3 — dẫn đường tiết kiệm dầu", async ({ page }) => {
  test.setTimeout(300_000);
  await page.route("**/sw.js", (r) => r.fulfill({ status: 404, body: "" }));
  await mockNoStorms(page);
  await installOverlay(page);

  await page.goto("/ngu-truong");
  await page
    .getByText("Đang mở bản đồ biển…")
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => {});
  await page.waitForSelector("canvas", { timeout: 60_000 });
  await page.waitForTimeout(4000);

  await caption(page, "SDFish — DẪN ĐƯỜNG né sóng gió, đỡ tốn dầu", 2800);

  await caption(page, "Chạm vào chỗ mình định tới trên biển", 2000);
  await page.mouse.move(175, 280);
  await page.waitForTimeout(500);
  await page.mouse.click(175, 280);
  await page.waitForTimeout(2500);

  const sheet = page.locator(
    'section[role="region"][aria-label="Gió sóng chỗ đang xem"]',
  );
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await tap(page, 'div[aria-label="Vuốt lên xem thêm, vuốt xuống thu gọn"]');
  await page.waitForTimeout(1200);

  // mở bảng dẫn đường
  const openBtn = page
    .locator("button")
    .filter({ hasText: /Dẫn đường tới chỗ (này|mới này)/ })
    .first();
  await openBtn.scrollIntoViewIfNeeded();
  await caption(page, 'Bấm "Dẫn đường tới chỗ này"', 1800);
  await openBtn.hover();
  await page.waitForTimeout(500);
  await openBtn.click();
  await page.waitForTimeout(1500);

  // nơi xuất phát
  const fromGroup = page.locator(
    'div[role="radiogroup"][aria-label="Nơi xuất phát"]',
  );
  if (await fromGroup.count()) {
    await scrollTo(page, 'div[role="radiogroup"][aria-label="Nơi xuất phát"]');
    await caption(page, "Chọn nơi xuất phát — cảng nhà hoặc chỗ tàu đang đứng", 2500);
  }

  // khai thông số tàu
  const speed = page.locator('input[inputmode="decimal"], input[inputmode="numeric"]').first();
  if (await speed.count()) {
    await caption(page, "Khai tàu chạy mấy hải lý/giờ, máy ăn bao nhiêu lít dầu/giờ", 2500);
  }

  // tính đường
  const calc = page.locator('button:has-text("Tính đường đỡ tốn dầu")').first();
  await calc.scrollIntoViewIfNeeded();
  await caption(page, 'Bấm "Tính đường đỡ tốn dầu" — app tự né chỗ sóng to gió lớn', 2200);
  await calc.hover();
  await page.waitForTimeout(500);
  await calc.click();

  // chờ kết quả (worker Dijkstra + thời tiết tuyến — có thể vài chục giây)
  const fuel = page.getByText(/lít/).first();
  const err = page.getByText(/quá gần|Chưa tính được|không tính được/i).first();
  await Promise.race([
    fuel.waitFor({ timeout: 120_000 }),
    err.waitFor({ timeout: 120_000 }),
  ]).catch(() => {});

  if (await fuel.count()) {
    await caption(page, "Ra kết quả: quãng đường, giờ chạy máy và SỐ LÍT DẦU ước tính", 3500);
    await page.waitForTimeout(1000);
    await caption(page, "Tuyến vẽ trên bản đồ đã né vùng sóng gió theo từng giờ chạy", 3200);
    await page.waitForTimeout(1500);
  } else {
    await caption(page, "Chỗ này chưa tính được — thử chọn điểm xa hơn ngoài khơi", 2500);
  }

  await caption(page, "Con số tham khảo — bà con vẫn quyết theo kinh nghiệm của mình", 3000);
  await hideCaption(page);
  await page.waitForTimeout(800);
});
