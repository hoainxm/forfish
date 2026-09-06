import { expect, test } from "@playwright/test";
import { PERSONA, loginViaDevPage } from "./helpers";

// MÀN HÌNH NGƯỜI MUA (chromium đội lốt iPhone 402×874, KHÔNG quay video).
// Chỉ những ca KHÔNG phụ thuộc selector chi tiết chạy thật; ca cần selector của
// UI chưa dựng xong để `test.fixme` — giữ nguyên để bật lên khi màn có thật,
// KHÔNG xoá (mất ca là mất trí nhớ của bộ test).

test.describe("Chợ vật tư — màn người mua", () => {
  test("Khách lạ mở /cho: trang lên được, có tiêu đề chợ", async ({ page }) => {
    const res = await page.goto("/cho");
    expect(res?.status(), "/cho phải trả 200 cho khách lạ (LEAD §5 #8)").toBe(200);
    await expect(page.getByText(/Chợ vật tư/i).first()).toBeVisible();
  });

  test("Khách lạ mở /cho/tim: trang lên được, có ô tìm", async ({ page }) => {
    const res = await page.goto("/cho/tim");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("searchbox").or(page.getByRole("textbox")).first()).toBeVisible();
  });

  test("Giỏ trống: có câu 'Giỏ đang trống' + lối đi chợ", async ({ page }) => {
    const res = await page.goto("/cho/gio");
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/Giỏ đang trống/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Đi chợ/i }).or(page.getByRole("button", { name: /Đi chợ/i })).first())
      .toBeVisible();
  });

  test("/dev: đăng nhập persona bằng nút rồi vào được /cho", async ({ page }) => {
    await loginViaDevPage(page, PERSONA.buyerBa);
    await page.goto("/cho");
    await expect(page.getByText(/Chợ vật tư/i).first()).toBeVisible();
  });

  test.fixme("Chip nhóm hàng: đúng 9 nhãn, đúng thứ tự PRODUCT_CATEGORIES", async ({ page }) => {
    await page.goto("/cho");
    const chips = page.getByRole("link", { name: /Máy|Điện tử|Ngư cụ|Dầu|Đá|Nhu yếu|An toàn|Phụ tùng|Khác/ });
    await expect(chips).toHaveCount(9);
  });

  test.fixme("LoginGate: khách lạ bấm Đặt hàng ở giỏ ⇒ lời mời đăng nhập tại chỗ, KHÔNG chuyển trang", async ({ page }) => {
    await page.goto("/cho/gio");
    await page.getByRole("button", { name: /Đặt hàng/i }).click();
    await expect(page.getByText(/Cần tài khoản để đặt hàng/i)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/cho/gio");
  });

  test.fixme("Ảnh sản phẩm hiện thật trên bản cài PWA (LEAD §5 #10 — SW không chặn ảnh)", async ({ page }) => {
    await page.goto("/cho");
    const img = page.locator("img").first();
    await expect(img).toBeVisible();
    const w = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(w, "ảnh phải tải được, không phải ô trống").toBeGreaterThan(0);
  });

  test.fixme("Nút Gọi shop KHÔNG ẩn khi mất sóng (LEAD §4 #10)", async ({ page, context }) => {
    await page.goto("/cho/sp/thay-bang-id-that");
    await context.setOffline(true);
    await expect(page.getByRole("link", { name: /Gọi/i }).first()).toBeVisible();
  });

  test.fixme("Tap ≥ 56px và chữ ≥ 18px ở gốc 16px (03 §design-system)", async ({ page }) => {
    await page.goto("/cho");
    const buttons = await page.getByRole("button").all();
    for (const b of buttons) {
      const box = await b.boundingBox();
      if (box) expect(box.height, "tap target").toBeGreaterThanOrEqual(56);
    }
  });
});
