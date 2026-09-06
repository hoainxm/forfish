import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Order, Product } from "@/lib/market/types";
import {
  MIN_TAP, PERSONA, SEED, devLogin, findOwnProduct, findProduct, loginViaDevPage, placeOneOrder,
  sellerShop, tapViolationsOfPages,
} from "./helpers";

/*  MÀN HÌNH KÊNH NGƯỜI BÁN (11 §6, 12 §8.3) — chromium đội lốt iPhone.

    Ba mạch việc của chủ shop, đo trên MÀN chứ không trên route (route đã có
    `api.ban-hang.spec.ts`): sửa tồn kho, xác nhận đơn, và mở gian hàng lần đầu.
    Cái các ca này canh là chỗ MÀN có thể sai trong khi route vẫn đúng — nút Lưu
    không hiện, hộp hỏi lại không đóng, chip không đổi, không có đường quay lại.

    Đơn/món làm tiền đề đều dựng bằng API (nhanh, không phụ thuộc selector của
    màn khác); chỉ thao tác cần đo mới đi qua màn hình.  */

/** Chủ shop SDVICO — persona người bán của kho seed (12 §5.3). */
const SDVICO = PERSONA.sellerSdvico;

/** Mở /ban-hang/san-pham rồi lọc còn đúng một món bằng ô tìm trong shop. */
async function timMonTrongShop(page: Page, title: string): Promise<void> {
  await page.goto("/ban-hang/san-pham");
  const o = page.getByLabel("Tìm món trong shop");
  await expect(o).toBeVisible();
  await o.fill(title);
  // ô tìm chờ 400 ms mới gọi mạng — chờ đúng thẻ món hiện ra, không chờ giờ
  await expect(page.getByRole("link", { name: `Sửa ${title}` })).toBeVisible();
}

/**
 * Persona CHƯA CÓ GIAN HÀNG để đo màn đăng ký.
 *
 * Seed dành sẵn Cô Năm `0901000003` cho vai này, NHƯNG chạy cả bộ thì
 * `api.ban-hang.spec.ts` (project `api`, chạy trước) đã mở shop "Đại lý Cô Năm
 * QA" cho chính số đó — kho là một tệp dùng chung cho cả bộ. Nên hỏi máy chủ
 * xem số nào còn trống thay vì đoán: chạy `--project=mobile` một mình thì vẫn
 * đúng Cô Năm như đặc tả, chạy cả bộ thì rơi sang Chị Tư (số mà
 * `api.ban-hang.spec.ts` khẳng định là KHÔNG có shop).
 */
async function personaChuaCoShop(request: APIRequestContext): Promise<string> {
  for (const phone of [PERSONA.buyerNam, PERSONA.buyerTu] as const) {
    const token = await devLogin(request, phone);
    if ((await sellerShop(request, token)) === null) return phone;
  }
  throw new Error(
    "Không còn persona nào chưa có shop — kho e2e đã bẩn. Chạy lại từ kho sạch (global-setup xoá kho).",
  );
}

test.describe("Kênh người bán — chủ shop SDVICO", () => {
  test("Tổng quan /ban-hang: ba ô số việc-cần-làm + đường vào ba mục lớn", async ({ page }) => {
    await loginViaDevPage(page, SDVICO);
    await page.goto("/ban-hang");

    /*  BA Ô SỐ là thứ chủ shop nhìn đầu tiên mỗi sáng (11 §6.3). Tên của ô gồm
        cả CON SỐ ("3 Chờ xác nhận") — khớp theo nhãn, con số để `\d+` bắt: ca
        này đo "ô có hiện và dẫn đi đúng chỗ", không đo giá trị KPI (việc của
        `api.ban-hang.spec.ts`). */
    for (const [nhan, tab] of [
      ["Chờ xác nhận", "cho_xac_nhan"],
      ["Đang giao", "dang_giao"],
      ["Báo đã CK", "cho_xac_nhan"],
    ] as const) {
      const o = page.locator(`a[href="/ban-hang/don?tab=${tab}"]`).filter({ hasText: nhan });
      await expect(o, `ô số "${nhan}"`).toBeVisible();
      await expect(o, "ô phải có CON SỐ, không phải ô rỗng").toHaveText(/\d/);
    }

    for (const muc of ["Sản phẩm", "Đơn hàng", "Cài đặt shop"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${muc}`) })).toBeVisible();
    }
  });

  test("Sửa tồn kho ở màn món: lưu xong DANH SÁCH đổi theo, có dòng báo đã lưu", async ({ page, request }) => {
    const sdvico = await devLogin(request, SDVICO);
    const mon: Product = await findOwnProduct(request, sdvico, SEED.pAoPhao);
    const tonMoi = mon.stock + 7;

    await loginViaDevPage(page, SDVICO);
    await timMonTrongShop(page, mon.title);
    await page.getByRole("link", { name: `Sửa ${mon.title}` }).click();

    const oTon = page.getByLabel("Số lượng còn trong kho");
    await expect(oTon).toHaveValue(String(mon.stock));
    await oTon.fill(String(tonMoi));
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();

    // Về danh sách kèm `?luu=` ⇒ dòng báo "Đã lưu <tên món>" (không toast).
    await expect(page).toHaveURL(/\/ban-hang\/san-pham\?luu=/);
    await expect(page.getByText(`Đã lưu ${mon.title}`)).toBeVisible();

    /*  DANH SÁCH PHẢI ĐỔI THEO — không phải chỉ máy chủ đổi. Lọc lại bằng ô tìm
        vì sau khi lưu, danh sách quay về trang 1 của mục "Đang bán". */
    await timMonTrongShop(page, mon.title);
    await expect(page.getByText(new RegExp(`Tồn ${tonMoi} ${mon.unit}\\b`))).toBeVisible();
    // và máy chủ cũng phải đổi thật, không chỉ đổi trên màn
    expect((await findOwnProduct(request, sdvico, mon.title)).stock).toBe(tonMoi);
  });

  test("Xác nhận đơn: hộp hỏi lại một câu ⇒ chip đổi 'Đã xác nhận', nút chính thành 'Giao hàng'", async ({
    page,
    request,
  }) => {
    // Đơn tiền đề: người mua đặt qua API để ca này chỉ đo MÀN của người bán.
    const ba = await devLogin(request, PERSONA.buyerBa);
    const mon = await findProduct(request, SEED.pAoPhao);
    const don: Order = await placeOneOrder(request, ba, mon.shopId, [{ productId: mon.id, qty: 1 }], {
      buyerNote: `ca UI người bán ${Date.now()}`,
    });
    expect(don.status, "đơn mới luôn ở Chờ xác nhận").toBe("cho_xac_nhan");

    await loginViaDevPage(page, SDVICO);
    await page.goto("/ban-hang/don");
    // Tab mặc định là "Chờ xác nhận" — đơn vừa đặt phải nằm ngay đó.
    await page.getByRole("link", { name: new RegExp(don.code) }).click();
    await expect(page.getByText(don.code).first()).toBeVisible();

    await page.getByRole("button", { name: "Xác nhận đơn" }).click();
    /*  MỘT CÂU HỎI LẠI, KHÔNG PHẢI HAI (11 §6.5): `ConfirmDialog` role
        alertdialog, nút đồng ý ghi "Đồng ý". */
    const hoi = page.getByRole("alertdialog");
    await expect(hoi).toBeVisible();
    await expect(hoi.getByText("Xác nhận đơn này?")).toBeVisible();
    await hoi.getByRole("button", { name: "Đồng ý" }).click();

    await expect(page.getByText("Đã xác nhận", { exact: true }).first(), "chip trạng thái đổi").toBeVisible();
    await expect(page.getByRole("button", { name: "Giao hàng" }), "nút chính sang bước kế tiếp").toBeVisible();
    await expect(page.getByRole("button", { name: "Xác nhận đơn" })).toHaveCount(0);
  });

  test("Ghi chú cho người mua: nút Lưu CHỈ hiện khi ô đã đổi (F-26)", async ({ page, request }) => {
    const ba = await devLogin(request, PERSONA.buyerBa);
    const mon = await findProduct(request, SEED.pAoPhao);
    const don: Order = await placeOneOrder(request, ba, mon.shopId, [{ productId: mon.id, qty: 1 }], {
      buyerNote: `ca UI ghi chú ${Date.now()}`,
    });

    await loginViaDevPage(page, SDVICO);
    await page.goto(`/ban-hang/don/${don.id}`);
    const o = page.getByLabel("Ghi chú cho người mua");
    await expect(o).toBeVisible();
    /*  Chưa gõ gì thì KHÔNG có nút Lưu nằm chờ: nút mờ đứng sẵn làm bà con không
        biết mình đã gõ gì chưa lưu. */
    await expect(page.getByRole("button", { name: "Lưu ghi chú" })).toHaveCount(0);

    await o.fill("Xe chạy 5h sáng mai, bà con để ý điện thoại.");
    const luu = page.getByRole("button", { name: "Lưu ghi chú" });
    await expect(luu).toBeVisible();
    await luu.click();
    await expect(page.getByText("Đã lưu ghi chú.")).toBeVisible();
    await expect(luu, "lưu xong ô hết 'đang đổi' ⇒ nút rút đi").toHaveCount(0);
  });

  test("Mọi màn /ban-hang/** có nút Quay lại (dock chỉ về 5 trục, không về trang trước)", async ({ page }) => {
    await loginViaDevPage(page, SDVICO);
    for (const path of ["/ban-hang", "/ban-hang/san-pham", "/ban-hang/san-pham/moi", "/ban-hang/don", "/ban-hang/cai-dat"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Quay lại" }), `Quay lại ở ${path}`).toBeVisible();
    }
  });
});

test.describe("Kênh người bán — mở gian hàng lần đầu", () => {
  /*  THỨ TỰ CÓ Ý: ca ĐỎ đứng TRƯỚC ca đăng ký. Ca đăng ký dùng hết persona
      chưa-có-shop cuối cùng (chạy cả bộ thì Cô Năm đã bị `api.ban-hang.spec.ts`
      lấy mất), nên đảo lại là ca đỏ hết người để đo. */
  /*  ĐỎ CÓ CHỦ ĐÍCH — LỖI THẬT CỦA SẢN PHẨM, đừng nới ca này.

      11 §6.1 liệt kê ô "key" của màn đăng ký: *"tên shop · SĐT liên hệ (điền
      sẵn) · tỉnh · địa chỉ …"*. Trên màn, ô SĐT LUÔN TRỐNG.

      Gốc: `ShopRegister` dựng giá trị đầu bằng `useState(() => emptyShopForm(phone))`
      — hàm khởi tạo LƯỜI, chỉ chạy ở lần vẽ ĐẦU của chính component đó. Mà
      `useAuthUser().phone` đọc sổ danh tính TRONG effect (cố ý, để bản dựng máy
      chủ khớp bản vẽ đầu ở máy) nên lần vẽ đầu luôn trả `null`. Effect chạy
      xong thì `phone` có, nhưng `form` đã chốt rồi và không ai chép lại
      ⇒ `emptyShopForm(phone)` là mã chết, KHÔNG phải chuyện chạy đua thời gian.
      Bằng chứng: ca này đo lại 24 lượt trong 10 s, ô vẫn rỗng.

      Vì sao không phải chuyện nhỏ: `validateShopDraft` CHO PHÉP `phone` rỗng.
      Bà con để trống là shop lên sàn KHÔNG CÓ SỐ GỌI — trang món khi đó bỏ nút
      "Gọi shop", chỉ còn "Xem shop" (`product-detail`), tức cắt mất đường liên
      lạc thẳng giữa người mua và người bán, đúng thứ bán hàng ngoài bến sống
      bằng.

      Sửa ở Core/màn: chép SĐT xuống form khi `useAuthUser` báo `ready` mà ô còn
      rỗng (đừng đè lên số bà con đã tự gõ).  */
  test("SĐT liên hệ ở form đăng ký phải ĐIỀN SẴN theo tài khoản (11 §6.1 'SĐT liên hệ (điền sẵn)')", async ({
    page,
    request,
  }) => {
    const phone = await personaChuaCoShop(request);
    await loginViaDevPage(page, phone);
    await page.goto("/ban-hang/dang-ky");
    await expect(page.getByLabel("Tên gian hàng")).toBeVisible();
    await expect(
      page.getByLabel("Số điện thoại bà con gọi shop"),
      "để trống là shop lên sàn không có số gọi — trang món mất nút 'Gọi shop'",
    ).toHaveValue(phone);
  });

  test("Chưa có shop: /ban-hang mời đăng ký ⇒ điền form (tỉnh là ô chọn) ⇒ màn chờ duyệt", async ({ page, request }) => {
    const phone = await personaChuaCoShop(request);
    const ten = `Đại lý QA Màn ${Date.now().toString(36)}`;

    await loginViaDevPage(page, phone);
    await page.goto("/ban-hang");
    await expect(page.getByText("Mở gian hàng trên SDFish")).toBeVisible();
    await page.getByRole("link", { name: "Đăng ký gian hàng" }).click();
    await expect(page).toHaveURL(/\/ban-hang\/dang-ky$/);

    await page.getByLabel("Tên gian hàng").fill(ten);
    // ⚠️ SĐT lẽ ra ĐIỀN SẴN (11 §6.1) — đang trống, xem ca "SĐT liên hệ" bên dưới.
    await page.getByLabel("Số điện thoại bà con gọi shop").fill(phone);
    // Tỉnh là `<select>` NỀN TẢNG từ 2026-09-06 (F-11), không còn 22 chip cuộn ngang.
    await page.getByLabel("Tỉnh của shop").selectOption("Khánh Hòa");
    await page.getByLabel(/^Địa chỉ shop/).fill("Cảng cá Hòn Rớ, lô 7");

    await page.getByRole("button", { name: "Gửi đăng ký" }).click();

    // Gửi xong về Tổng quan với băng chờ duyệt — VẪN thêm món trước được (11 §6.2).
    await expect(page).toHaveURL(/\/ban-hang$/);
    await expect(page.getByText(new RegExp(`Shop ${ten} đang chờ SDVICO duyệt`))).toBeVisible();
    await expect(page.getByRole("link", { name: /Thêm món/ })).toBeVisible();
  });

});

// ═══ SÀN CHẠM 56px trên màn NGƯỜI BÁN ═════════════════════════════════════
// Cùng phép đo và cùng ba ngoại lệ với màn người mua (`helpers.tapViolations`).
test.describe("Kênh người bán — sàn chạm 56px", () => {
  test("Mọi nút/liên kết ở /ban-hang, /ban-hang/san-pham, /ban-hang/don, /ban-hang/cai-dat đều ≥ 56px", async ({
    page,
  }) => {
    await loginViaDevPage(page, SDVICO);
    const bad = await tapViolationsOfPages(page, [
      ["/ban-hang", /Chờ xác nhận/],
      ["/ban-hang/san-pham", /Đang bán/],
      ["/ban-hang/don", /Chờ xác nhận|Không có đơn/],
      ["/ban-hang/cai-dat", /Tên gian hàng/],
    ]);
    expect(bad, `dưới sàn ${MIN_TAP}px:\n${bad.join("\n")}`).toEqual([]);
  });
});
