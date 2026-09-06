import { expect, test, type Page } from "@playwright/test";
import { PERSONA, SEED, addToCartViaUi, findProduct, loginViaDevPage } from "./helpers";

/*  Ô CHỌN TRONG GIỎ (F-05, vòng fix UX 2026-09-06) + LỜI MỜI ĐĂNG NHẬP (F-01).

    Ca thật của bà con: giỏ đang có dầu của shop A và đá của shop B, hôm nay chỉ
    muốn đặt đá — bỏ chọn shop A rồi đặt. Cái phải đúng là BA thứ, và cả ba đều
    là chuyện mất tiền/mất hàng nếu sai:
      1. Nhãn nút đếm đúng số món ĐANG CHỌN — "Đặt hàng (1)", không phải (2).
      2. Đặt xong ra ĐÚNG 1 đơn, không phải 2.
      3. Dòng bỏ chọn VẪN NẰM TRONG GIỎ — xoá nó đi là bà con mất công chọn lại.

    Giỏ được dựng qua MÀN HÌNH (`addToCartViaUi`), không nhét thẳng localStorage:
    nếu đường lưu giỏ hỏng thì ca này phải thấy.  */

/** Điền địa chỉ nhận lần đầu — máy chưa có địa chỉ nào thì sheet form tự mở. */
async function fillFirstAddress(page: Page): Promise<void> {
  const sheet = page.getByRole("dialog");
  await expect(sheet, "chưa có địa chỉ nào ⇒ sheet form tự mở (F-02)").toBeVisible();
  await sheet.getByLabel("Tên người nhận").fill("Nguyễn Văn Ba");
  await sheet.getByLabel("Số điện thoại nhận hàng").fill(PERSONA.buyerBa);
  // Tỉnh là `<select>` NỀN TẢNG từ 2026-09-06 (F-11) — chọn bằng selectOption,
  // không phải bấm chip.
  await sheet.getByLabel("Tỉnh").selectOption("Khánh Hòa");
  await sheet.getByLabel(/Tên cảng \/ bến/).fill("Cảng Hòn Rớ, tàu KH-91234");
  await sheet.getByRole("button", { name: "Lưu địa chỉ này" }).click();
  await expect(sheet).toBeHidden();
}

test.describe("Chợ vật tư — ô chọn trong giỏ", () => {
  test("Giỏ 2 shop, bỏ chọn 1 shop ⇒ 'Đặt hàng (1)', đặt ra ĐÚNG 1 đơn, dòng bỏ chọn còn nguyên trong giỏ", async ({
    page,
    request,
  }) => {
    const aoPhao = await findProduct(request, SEED.pAoPhao); // shop SDVICO
    const daCay = await findProduct(request, SEED.pDaCay); // shop Đại lý Hải Đăng
    expect(aoPhao.shopId, "hai món phải của HAI shop khác nhau").not.toBe(daCay.shopId);

    await loginViaDevPage(page, PERSONA.buyerBa);
    await addToCartViaUi(page, aoPhao.id);
    await addToCartViaUi(page, daCay.id);

    await page.goto("/cho/gio");
    const dat = page.getByRole("button", { name: /^Đặt hàng/ });
    await expect(dat, "mặc định chọn hết ⇒ đếm cả 2 dòng").toHaveText(/^Đặt hàng \(2\)$/);
    await expect(page.getByRole("checkbox", { name: "Chọn tất cả" })).toBeChecked();

    // ── bỏ chọn CẢ SHOP của Áo phao ────────────────────────────────────────
    const boShop = page.getByRole("checkbox", { name: `Chọn cả shop ${aoPhao.shopName}` });
    await expect(boShop).toBeChecked();
    await boShop.click();
    await expect(boShop).not.toBeChecked();
    await expect(dat, "tổng + nhãn nút chỉ tính dòng đang chọn").toHaveText(/^Đặt hàng \(1\)$/);
    // "Chọn tất cả" phải sang trạng thái nửa vời, không phải bỏ trắng
    await expect(page.getByRole("checkbox", { name: "Chọn tất cả" })).toHaveAttribute("aria-checked", "mixed");

    // ── đặt ────────────────────────────────────────────────────────────────
    await dat.click();
    await expect(page).toHaveURL(/\/cho\/thanh-toan$/);
    await fillFirstAddress(page);
    await expect(
      page.getByText("Sẽ tạo 1 đơn cho 1 shop"),
      "màn Đặt hàng chỉ mang dòng ĐANG CHỌN đi (F-05)",
    ).toBeVisible();

    await page.getByRole("button", { name: "Đặt hàng", exact: true }).click();
    await expect(page.getByText("Đã đặt 1 đơn")).toBeVisible();
    await expect(page.getByText(/SD\d{6}[A-Z0-9]{4}/).first()).toBeVisible();

    // ── giỏ sau khi đặt ────────────────────────────────────────────────────
    await page.goto("/cho/gio");
    await expect(
      page.getByText(aoPhao.title).first(),
      "dòng BỎ CHỌN phải còn nguyên trong giỏ — xoá là bà con mất công chọn lại",
    ).toBeVisible();
    await expect(page.getByText(daCay.title)).toHaveCount(0);
    // vẫn đang bỏ chọn ⇒ chưa đặt được tiếp, và màn nói rõ vì sao
    await expect(page.getByRole("checkbox", { name: `Chọn ${aoPhao.title}` })).not.toBeChecked();
    await expect(page.getByText("Chọn ít nhất một món để đặt.")).toBeVisible();
  });

  test("Khách lạ bấm Đặt hàng: lời mời đăng nhập hiện NGAY TRONG TẦM MẮT (F-01 — sheet, không phải thẻ dưới đáy)", async ({
    page,
    request,
  }) => {
    const daCay = await findProduct(request, SEED.pDaCay);
    await addToCartViaUi(page, daCay.id);

    await page.goto("/cho/gio");
    const dat = page.getByRole("button", { name: /^Đặt hàng/ });
    await expect(dat).toHaveText(/^Đặt hàng \(1\)$/);
    await dat.click();

    /*  BẢN CŨ vẽ thẻ mời INLINE dưới danh sách: bấm xong màn không đổi gì trong
        tầm mắt ⇒ bà con tưởng nút hỏng, bấm tiếp. `toBeInViewport` là đúng cái
        ca này phải đo — "có trong DOM" không cứu được ai. */
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet).toBeInViewport();
    await expect(sheet.getByText("Đăng nhập để đặt hàng")).toBeInViewport();
    expect(new URL(page.url()).pathname, "mời tại chỗ, không đá sang /login").toBe("/cho/gio");

    // "Để sau" đóng lại và trả bà con về đúng giỏ đang xem.
    await sheet.getByRole("button", { name: "Để sau" }).click();
    await expect(sheet).toBeHidden();
    await expect(dat).toBeVisible();
  });
});
