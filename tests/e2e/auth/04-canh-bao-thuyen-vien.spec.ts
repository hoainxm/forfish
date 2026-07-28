import { test, expect } from "@playwright/test";
import {
  installOverlay,
  caption,
  hideCaption,
  tap,
  typeSlow,
} from "../tutorial-helpers";
import { seedSession, installMocks, WARN_CCCD } from "../auth-mocks";

// VIDEO 4 — CẢNH BÁO THUYỀN VIÊN: thêm bạn thuyền có CCCD → app TỰ TRA kho
// cảnh báo chéo; gặp người có "phốt" thì hiện đỏ; nút Cảnh báo để báo cáo.
// (Máy chủ được mô phỏng trong test — dữ liệu cảnh báo là dữ liệu DỰNG SẴN.)
test("video 4 — sổ thuyền viên & cảnh báo chéo", async ({ page, context, baseURL }) => {
  await seedSession(context, baseURL!);
  await installMocks(page);
  await installOverlay(page);

  await page.goto("/nguoi");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  await caption(page, "SDFish — SỔ THUYỀN VIÊN + tra cảnh báo bạn thuyền", 2800);
  await caption(page, "Sổ ghi ai đang đi tàu mình, giấy tờ, bảo hiểm từng người", 2800);

  // THÊM NGƯỜI MỚI — CCCD sạch
  await tap(page, 'button:has-text("Thêm bạn thuyền")');
  await page.waitForTimeout(1000);
  await caption(page, "Thêm người mới: gõ tên rồi số CCCD", 2000);
  await typeSlow(page, 'input[placeholder="VD: Nguyễn Văn Hai"]', "Phạm Văn Sáu");
  await typeSlow(page, 'input[placeholder="VD: 079090001234"]', "079095123456");

  await caption(page, "Gõ đủ 12 số — app TỰ TRA kho cảnh báo toàn hệ thống", 2200);
  const clean = page.getByText("Không có cảnh báo — bạn thuyền ổn.");
  await expect(clean).toBeVisible({ timeout: 15_000 });
  await caption(page, "✓ Người này sạch — yên tâm nhận xuống tàu", 2800);

  const coRoi = page.locator('button:has-text("Có rồi")').first();
  if (await coRoi.count()) {
    await coRoi.scrollIntoViewIfNeeded();
    await coRoi.hover();
    await page.waitForTimeout(500);
    await coRoi.click();
    await page.waitForTimeout(600);
  }
  await tap(page, 'button[type="submit"]:has-text("Lưu lại")');
  await page.waitForTimeout(1500);
  await caption(page, "Đã vào sổ — hồ sơ lưu ngay trong máy", 2500);

  // THÊM NGƯỜI CÓ CẢNH BÁO
  await tap(page, 'button:has-text("Thêm bạn thuyền")');
  await page.waitForTimeout(1000);
  await caption(page, "Thử người khác — nếu người này từng bị báo cáo thì sao?", 2200);
  await typeSlow(page, 'input[placeholder="VD: Nguyễn Văn Hai"]', "Trần Văn Bảy");
  await typeSlow(page, 'input[placeholder="VD: 079090001234"]', WARN_CCCD);

  const warned = page.getByText("Có cảnh báo về người này:");
  await expect(warned).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const list = page.getByText(/cảnh báo đã kiểm duyệt/);
  if (await list.count()) await list.first().scrollIntoViewIfNeeded();
  await caption(page, "⚠ Hiện rõ từng vụ: bỏ tàu, ứng tiền rồi trốn… — cân nhắc kỹ", 3500);
  await tap(page, 'button:has-text("Hủy")');
  await page.waitForTimeout(1200);

  // BÁO CÁO một bạn thuyền
  await caption(page, 'Gặp chuyện xấu? Bấm "Cảnh báo" trên thẻ người đó để báo cáo', 2500);
  await tap(page, 'button:has-text("Cảnh báo")');
  await page.waitForTimeout(1500);

  const cat = page
    .locator('button:has-text("Bỏ tàu giữa chuyến / phá hợp đồng")')
    .first();
  await cat.scrollIntoViewIfNeeded();
  await caption(page, "Chọn loại vấn đề…", 1600);
  await cat.hover();
  await page.waitForTimeout(500);
  await cat.click();
  await page.waitForTimeout(600);

  const detail = page.locator('textarea[placeholder^="VD: Bỏ tàu"]').first();
  if (await detail.count()) {
    await caption(page, "…kể rõ sự việc — vui lòng ghi đúng sự thật", 1800);
    await detail.scrollIntoViewIfNeeded();
    await detail.click();
    await detail.pressSequentially("Bỏ tàu giữa chuyến ở ngư trường, không báo trước.", {
      delay: 60,
    });
  }
  await tap(page, 'button[type="submit"]:has-text("Gửi báo cáo")');
  await expect(page.getByText("Đã gửi báo cáo.")).toBeVisible({ timeout: 15_000 });
  await caption(page, "SDVICO kiểm duyệt xong cảnh báo mới hiện cho chủ tàu khác", 3200);
  await tap(page, 'button:has-text("Xong")');

  await caption(page, "Cả làng biển cùng nhau lọc người xấu — ai cũng đỡ rủi ro", 3000);
  await hideCaption(page);
  await page.waitForTimeout(800);
});
