import { expect, test, type Page } from "@playwright/test";
import { PERSONA, SEED, loginViaDevPage } from "./helpers";

/*  MA TRẬN VAI — cùng hai màn, đi lại bằng TỪNG persona (ui-ux-triage §4.2
    "Theo VAI TRÒ": defect hay chỉ hiện ở một vai). Ca nào cũng mở đúng màn đó
    như người dùng thật (đăng nhập qua /dev, KHÔNG gắn token tay), rồi khẳng định
    cái vai đó PHẢI thấy và cái nó KHÔNG được thấy.

    Persona + seed lấy từ kho file (12 §5.3), không tạo dữ liệu mới ⇒ không cần
    sổ ghi test-data: global-setup xoá kho mỗi lượt chạy.

    nợ: chưa có vai shop `tu_choi` / `tam_khoa` (seed không có sẵn, phải dựng qua
    route admin) và chưa có màn /quan-tri (đăng nhập Supabase, không chạy trên kho
    file). Nâng khi seed có hai trạng thái đó, hoặc khi có Supabase staging.  */

const DON = "/cho/don";
const BAN_HANG = "/ban-hang";

interface Vai {
  ten: string;
  phone: string | null; // null = khách lạ
  banHang: { thay: RegExp[]; khong: RegExp[] };
  don: { thay: RegExp[]; khong: RegExp[] };
}

const CAN_TK_BAN_HANG = /Cần tài khoản để mở kênh người bán/;
const CAN_TK_DON = /Cần tài khoản để mở đơn hàng/;
const MOI_MO_SHOP = /Mở gian hàng trên SDFish/;
const CHO_DUYET = /đang chờ SDVICO duyệt/;
const ma = (code: string) => new RegExp(code);

const MA_TRAN: Vai[] = [
  {
    ten: "khách lạ",
    phone: null,
    banHang: { thay: [CAN_TK_BAN_HANG], khong: [MOI_MO_SHOP, CHO_DUYET] },
    don: { thay: [CAN_TK_DON], khong: [ma(SEED.orderDangGiao)] },
  },
  {
    ten: "người mua có đơn (Anh Ba)",
    phone: PERSONA.buyerBa,
    banHang: { thay: [MOI_MO_SHOP], khong: [CAN_TK_BAN_HANG, CHO_DUYET] },
    don: { thay: [ma(SEED.orderDangGiao), ma(SEED.orderChoXacNhanCk)], khong: [CAN_TK_DON] },
  },
  {
    // cùng vai người mua nhưng KHÁC người: không được thấy đơn của Anh Ba
    ten: "người mua khác (Chị Tư)",
    phone: PERSONA.buyerTu,
    banHang: { thay: [MOI_MO_SHOP], khong: [CAN_TK_BAN_HANG] },
    don: { thay: [], khong: [CAN_TK_DON, ma(SEED.orderDangGiao), ma(SEED.orderChoXacNhanCk)] },
  },
  {
    ten: "chủ shop đang bán (Hải Đăng)",
    phone: PERSONA.sellerHaiDang,
    banHang: { thay: [/Đại lý Hải Đăng/], khong: [MOI_MO_SHOP, CHO_DUYET, CAN_TK_BAN_HANG] },
    don: { thay: [], khong: [CAN_TK_DON, ma(SEED.orderDangGiao)] },
  },
  {
    ten: "chủ shop chờ duyệt (Phương Nam)",
    phone: PERSONA.sellerPhuongNam,
    banHang: { thay: [/Đại lý Phương Nam/, CHO_DUYET], khong: [MOI_MO_SHOP, CAN_TK_BAN_HANG] },
    don: { thay: [], khong: [CAN_TK_DON] },
  },
];

async function khangDinh(page: Page, path: string, vai: Vai, mong: { thay: RegExp[]; khong: RegExp[] }) {
  const res = await page.goto(path);
  expect(res?.status(), `${vai.ten} mở ${path}`).toBe(200);
  // chờ màn qua trạng thái tải: một trong các câu "phải thấy" hiện ra; nếu vai này
  // không có câu nào phải thấy thì chờ tiêu đề màn
  const neo = mong.thay[0] ?? (path === DON ? /Đơn hàng của tôi/ : /Gian hàng của tôi/);
  await expect(page.getByText(neo).first(), `${vai.ten} @ ${path}: phải thấy ${neo}`).toBeVisible({ timeout: 30_000 });
  // đợi dữ liệu tải xong rồi mới khẳng định "không thấy" — không thì PASS oan khi màn còn trống
  await page.waitForLoadState("networkidle");
  for (const re of mong.thay) {
    await expect(page.getByText(re).first(), `${vai.ten} @ ${path}: phải thấy ${re}`).toBeVisible();
  }
  for (const re of mong.khong) {
    await expect(page.getByText(re), `${vai.ten} @ ${path}: KHÔNG được thấy ${re}`).toHaveCount(0);
  }
}

test.describe("Ma trận vai — /ban-hang + /cho/don theo từng persona", () => {
  for (const vai of MA_TRAN) {
    test(`${vai.ten}: kênh người bán + đơn hàng đúng vai`, async ({ page }) => {
      if (vai.phone) await loginViaDevPage(page, vai.phone);
      await khangDinh(page, BAN_HANG, vai, vai.banHang);
      await khangDinh(page, DON, vai, vai.don);
    });
  }

  test("Hai người mua cùng lúc (2 context): mỗi người chỉ thấy đơn của mình", async ({ browser }) => {
    const ctxBa = await browser.newContext();
    const ctxTu = await browser.newContext();
    try {
      const [pBa, pTu] = await Promise.all([ctxBa.newPage(), ctxTu.newPage()]);
      await loginViaDevPage(pBa, PERSONA.buyerBa);
      await loginViaDevPage(pTu, PERSONA.buyerTu);
      await Promise.all([pBa.goto(DON), pTu.goto(DON)]);
      await expect(pBa.getByText(ma(SEED.orderDangGiao)).first()).toBeVisible({ timeout: 30_000 });
      await pTu.waitForLoadState("networkidle");
      await expect(pTu.getByText(/Đơn hàng của tôi/).first()).toBeVisible();
      await expect(pTu.getByText(ma(SEED.orderDangGiao)), "Chị Tư thấy đơn của Anh Ba").toHaveCount(0);
      // Anh Ba vẫn là Anh Ba sau khi Chị Tư đăng nhập ở context khác (không rò token chéo)
      await pBa.reload();
      await expect(pBa.getByText(ma(SEED.orderDangGiao)).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await ctxBa.close();
      await ctxTu.close();
    }
  });
});
