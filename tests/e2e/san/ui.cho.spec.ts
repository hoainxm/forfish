import { expect, test } from "@playwright/test";
import {
  MIN_TAP, PERSONA, SEED, addToCartViaUi, findProduct, loginViaDevPage, tapViolationsOfPages,
} from "./helpers";

// MÀN HÌNH NGƯỜI MUA (chromium đội lốt iPhone 402×874, KHÔNG quay video).
// Ca nào cần service worker / bản cài PWA thì để `test.fixme` — `next dev`
// KHÔNG đăng ký SW nên chạy ở đây là đo nhầm thứ. Giữ nguyên, KHÔNG xoá
// (mất ca là mất trí nhớ của bộ test).

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

  test("Chip nhóm hàng: 'Tất cả' + đúng 9 nhãn, đúng thứ tự PRODUCT_CATEGORIES", async ({ page }) => {
    await page.goto("/cho");
    // `CategoryChips` → `ChipRow` dựng `role="group" aria-label="Nhóm hàng"`,
    // mỗi chip là BUTTON (đổi lọc tại chỗ), KHÔNG phải link.
    const chips = page.getByRole("group", { name: "Nhóm hàng" }).getByRole("button");
    await expect(chips).toHaveText([
      "Tất cả", "Máy & động cơ", "Điện tử hàng hải", "Ngư cụ", "Dầu nhớt & nhiên liệu",
      "Đá & bảo quản", "Nhu yếu phẩm", "An toàn", "Phụ tùng", "Khác",
    ]);
  });

  test("LoginGate: khách lạ bấm Đặt hàng ở giỏ ⇒ lời mời đăng nhập TẠI CHỖ, KHÔNG chuyển trang", async ({ page, request }) => {
    // Giỏ phải có món thật, không thì nút Đặt hàng bị `blocked` che mất ca này.
    const mon = await findProduct(request, SEED.pDaCay);
    await addToCartViaUi(page, mon.id);

    await page.goto("/cho/gio");
    /*  NHÃN NÚT CÓ SỐ MÓN ĐANG CHỌN — "Đặt hàng (1)" (F-05). Bản cũ khớp
        `{ name: "Đặt hàng", exact: true }` nên chỉ xanh trong lúc bản tra giá
        chưa về (pickedCount còn 0) — xanh vì đo nhầm khoảnh khắc, không phải vì
        UI đúng. Chờ đúng nhãn có số rồi mới bấm. */
    const dat = page.getByRole("button", { name: /^Đặt hàng/ });
    await expect(dat).toHaveText(/^Đặt hàng \(1\)$/);
    await expect(dat).toBeEnabled();
    await dat.click();

    // `LoginInvite` là BOTTOM SHEET (F-01) → role dialog; câu là "Đăng nhập để đặt hàng" (F-20).
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Đăng nhập để đặt hàng")).toBeVisible();
    await expect(sheet.getByText(/Tài khoản do SDVICO cấp/i)).toBeVisible();
    expect(new URL(page.url()).pathname, "mời tại chỗ, không đá sang /login").toBe("/cho/gio");
  });

  test.fixme("Ảnh sản phẩm hiện thật trên bản cài PWA (LEAD §5 #10 — SW không chặn ảnh)", async ({ page }) => {
    // CẦN BẢN BUILD + service worker: `next dev` không đăng ký SW nên ca này ở
    // đây chỉ đo `next/image`, không đo đúng thứ nó sinh ra để đo.
    await page.goto("/cho");
    const img = page.locator("img").first();
    await expect(img).toBeVisible();
    const w = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(w, "ảnh phải tải được, không phải ô trống").toBeGreaterThan(0);
  });

  test("Nút Gọi shop KHÔNG ẩn khi mất sóng (LEAD §4 #10)", async ({ page, context, request }) => {
    const mon = await findProduct(request, SEED.pDaCay);
    await page.goto(`/cho/sp/${mon.id}`);
    await expect(page.getByRole("link", { name: /Gọi shop/i }).first()).toBeVisible();
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    // `tel:` chạy được không cần sóng dữ liệu — ẩn nó đi là cắt đường gọi
    // người bán đúng lúc bà con cần nhất.
    await expect(page.getByRole("link", { name: /Gọi shop/i }).first()).toBeVisible();
    await context.setOffline(false);
  });
});

// ═══ SÀN CHẠM 56px (03 design-system, luật A5) ════════════════════════════
// Phép đo + ba ngoại lệ CÓ CHỦ ĐÍCH nằm ở `tapViolations` (helpers.ts) để ba bộ
// ca màn hình dùng chung MỘT luật. KHÔNG có ngoại lệ nào cho chip lọc: chip là ô
// bị chạm nhiều nhất của khu. Ca này ĐO, không nới; đỏ ở đây là vi phạm thật của
// UI, sửa UI chứ đừng sửa ca.
test.describe("Chợ vật tư — sàn chạm 56px", () => {
  test("Mọi nút/liên kết ở /cho, /cho/gio, /cho/sp/<id>, /cho/don đều ≥ 56px", async ({ page, request }) => {
    const mon = await findProduct(request, SEED.pDaCay);
    await loginViaDevPage(page, PERSONA.buyerBa);
    await addToCartViaUi(page, mon.id); // giỏ có hàng ⇒ đo cả ô chọn, bộ đếm, nút Bỏ

    const bad = await tapViolationsOfPages(page, [
      /*  MỐC CHỜ của /cho là TÊN MỘT MÓN THẬT, không phải tiêu đề màn: tiêu đề
          hiện ngay lúc còn khung xương ⇒ đo trước khi lưới món (và ♡ trên thẻ)
          kịp vẽ, tức là đo một màn trống. */
      ["/cho", new RegExp(mon.title)],
      [`/cho/sp/${mon.id}`, /Thêm vào giỏ|Hết hàng|Chọn loại/],
      ["/cho/gio", /Chọn tất cả/],
      ["/cho/don", /Đơn|SD\d{6}/],
    ]);
    expect(bad, `dưới sàn ${MIN_TAP}px:\n${bad.join("\n")}`).toEqual([]);
  });
});
