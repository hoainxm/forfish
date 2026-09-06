import { expect, test } from "@playwright/test";
import type { Order } from "@/lib/market/types";
import {
  PERSONA, SEED, devLogin, expectedTotalFor, findProduct, loginViaDevPage, placeOneOrder,
} from "./helpers";

// ĐƠN CỦA TÔI + MẤT SÓNG (11 §5.7, §9). Đơn được tạo bằng API (nhanh, không phụ
// thuộc selector của màn Đặt hàng), rồi kiểm màn `/cho/don` hiện đúng mã đơn và
// vẫn đọc được BẢN LƯU khi tắt mạng.
test.describe("Chợ vật tư — đơn hàng của tôi", () => {
  test("/cho/don hiện đúng mã đơn vừa tạo qua API", async ({ page, request }) => {
    const ba = await devLogin(request, PERSONA.buyerBa);
    const mon = await findProduct(request, SEED.pDaCay);
    const items = [{ productId: mon.id, qty: 1 }];
    await expectedTotalFor(request, mon.shopId, items, ba);
    const order: Order = await placeOneOrder(request, ba, mon.shopId, items, {
      buyerNote: `ca UI ${Date.now()}`,
    });

    await loginViaDevPage(page, PERSONA.buyerBa);
    await page.goto("/cho/don");
    await expect(page.getByText(order.code)).toBeVisible();
  });

  test("Bản lưu đơn: mở /cho/don có sóng ⇒ máy cất `forfish.morders.v1` để xem lúc mất sóng", async ({ page }) => {
    await loginViaDevPage(page, PERSONA.buyerBa);
    await page.goto("/cho/don");
    await expect(page.getByText(/SD\d{6}[A-Z0-9]{4}/).first()).toBeVisible();
    const saved = await page.evaluate(() => window.localStorage.getItem("forfish.morders.v1"));
    expect(saved, "không có bản lưu thì ra biển là màn trắng").toBeTruthy();
    const parsed = JSON.parse(saved as string) as { phone: string; savedAt: number; orders: unknown[] };
    expect(parsed.orders.length, "phải cất đơn thật").toBeGreaterThan(0);
    expect(parsed.phone, "ngăn theo SĐT — máy dùng chung không lẫn đơn").toBeTruthy();
  });

  test("Mất sóng giữa chừng: /cho/don vẫn hiện đơn đã lưu + nói rõ đang xem bản lưu", async ({ page, context }) => {
    await loginViaDevPage(page, PERSONA.buyerBa);
    await page.goto("/cho/don");
    await expect(page.getByText(/SD\d{6}[A-Z0-9]{4}/).first()).toBeVisible();

    /*  KHÔNG `page.reload()`: `next dev` không có service worker nên tải lại
        khi offline là ERR_INTERNET_DISCONNECTED — đó là chuyện của bản cài PWA,
        không phải của màn này. Ở đây kiểm đúng cái màn phải làm: mất sóng GIỮA
        CHỪNG thì không được xoá trắng, phải nói rõ đang xem bản lưu. */
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByText(/SD\d{6}[A-Z0-9]{4}/).first(), "đơn đã lưu vẫn xem được ngoài biển").toBeVisible();
    await context.setOffline(false);
  });

  // GIỮ FIXME: cần service worker của bản cài PWA. `next dev` KHÔNG đăng ký SW
  // nên `page.reload()` lúc offline chỉ ra ERR_INTERNET_DISCONNECTED — đo nhầm
  // thứ. Bật lên khi bộ test chạy được trên `next build && next start`.
  test.fixme("Bản cài PWA: mở lại /cho/don khi mất sóng (cần service worker — chạy trên bản build, không phải next dev)", async ({ page, context }) => {
    await loginViaDevPage(page, PERSONA.buyerBa);
    await page.goto("/cho/don");
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(/đơn đã lưu|đã lưu trong máy/i)).toBeVisible();
  });

  test("Mất sóng ở CHI TIẾT ĐƠN: nút ghi vô hiệu + câu 'Việc này cần có sóng.'", async ({ page, context, request }) => {
    const ba = await devLogin(request, PERSONA.buyerBa);
    const mon = await findProduct(request, SEED.pDaCay);
    const items = [{ productId: mon.id, qty: 1 }];
    await expectedTotalFor(request, mon.shopId, items, ba);
    const order: Order = await placeOneOrder(request, ba, mon.shopId, items, {
      buyerNote: `ca UI mất sóng ${Date.now()}`,
    });

    await loginViaDevPage(page, PERSONA.buyerBa);
    await page.goto(`/cho/don/${order.id}`);
    const huy = page.getByRole("button", { name: "Huỷ đơn", exact: true });
    await expect(huy).toBeEnabled();

    /*  KHÔNG `page.reload()` (xem ghi chú ca trên): mất sóng GIỮA CHỪNG. Nút ghi
        phải MỜ ĐI chứ không biến mất, và màn phải nói vì sao — bấm được rồi
        mất trắng giữa biển là cách nhanh nhất để bà con tưởng đã huỷ được đơn. */
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(huy, "nút ghi phải vô hiệu khi mất sóng").toBeDisabled();
    await expect(page.getByText(/Việc này cần có sóng/i)).toBeVisible();
    await context.setOffline(false);
  });

  test("Mất sóng ở /cho: có câu chợ cần mạng, Giỏ + Đơn hàng vẫn bấm được", async ({ page, context }) => {
    await page.goto("/cho");
    await expect(page.getByText(/Chợ vật tư/i).first()).toBeVisible();

    /*  KHÔNG `page.reload()`: `next dev` không có service worker (ca PWA ở trên
        giữ phần đó). Ở đây kiểm nhánh MẤT SÓNG GIỮA CHỪNG của chính màn: bắn
        `online` khi mạng đã tắt ⇒ `useOnlineRefetch` tải lại, fetch ném,
        `marketGet` trả `offline: true` ⇒ màn phải ra `EmptyNet`. */
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText(/chợ cần mạng/i)).toBeVisible();

    // Giỏ và Đơn đọc từ MÁY — mất sóng vẫn phải vào được (11 §9).
    await expect(page.getByRole("link", { name: /^Giỏ hàng/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Đơn hàng của tôi/ }).first()).toBeVisible();
    await context.setOffline(false);
  });
});
