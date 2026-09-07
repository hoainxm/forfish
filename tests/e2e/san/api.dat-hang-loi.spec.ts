import { expect, test } from "@playwright/test";
import type { Order, ProductCard } from "@/lib/market/types";
import {
  ADDRESS, PERSONA, SEED, devLogin, expectedTotalFor, findOwnProduct, findProduct, get,
  listProducts, patch, placeOneOrder, placeOrders, post, priceOf, stockOf,
} from "./helpers";

// TÁM CA LỖI BẮT BUỘC (12 §10.2): hết hàng lúc đặt · giá đổi · huỷ trùng/bấm đúp ·
// mất mạng lúc đặt · shop bị khoá giữa chừng · shop tạm nghỉ · huỷ CK ⇒ needsRefund
// (+ ép COD khi shop không có STK). Ca "ảnh > 500 KB" ở api.ban-hang.spec.ts.
test.describe("Chợ — ca lỗi khi đặt hàng (API)", () => {
  let ba = "";
  let tu = "";
  let sdvico = "";
  let haidang = "";
  let admin = "";
  let daCay: ProductCard;
  let aoPhao: ProductCard;

  test.beforeAll(async ({ request }) => {
    ba = await devLogin(request, PERSONA.buyerBa);
    tu = await devLogin(request, PERSONA.buyerTu);
    sdvico = await devLogin(request, PERSONA.sellerSdvico);
    haidang = await devLogin(request, PERSONA.sellerHaiDang);
    admin = await devLogin(request, PERSONA.admin);
    daCay = await findProduct(request, SEED.pDaCay);
    aoPhao = await findProduct(request, SEED.pAoPhao);
  });

  test("AC-18 giá đổi: expectedTotalVnd lệch ⇒ price_changed, KHÔNG tạo đơn, tồn không đổi", async ({ request }) => {
    const items = [{ productId: aoPhao.id, qty: 1 }];
    const stock0 = await stockOf(request, aoPhao.id);
    const res = await placeOrders(request, ba, [
      { shopId: aoPhao.shopId, items, expectedTotalVnd: 1 }, // tổng sai hẳn
    ], { buyerNote: "ca gia doi" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const r = res.body.results[0];
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("price_changed");
    expect((r as { quote?: { totalVnd: number } }).quote?.totalVnd, "trả tổng mới để client cập nhật").toBeGreaterThan(0);
    expect(await stockOf(request, aoPhao.id), "không đụng kho").toBe(stock0);
  });

  test("AC-22 một shop hỏng không kéo shop kia: A đặt được, B hết hàng", async ({ request }) => {
    // đặt 1 món SDVICO (được) + 1 món Hải Đăng với qty VƯỢT TỒN (hỏng)
    const luoi = await findProduct(request, "Lưới rê 3 lớp");
    expect(luoi.stock, "món dùng cho ca này phải có tồn < 999").toBeLessThan(999);
    const okItems = [{ productId: aoPhao.id, qty: 1 }];
    const badItems = [{ productId: luoi.id, qty: 999 }];
    const tOk = await expectedTotalFor(request, aoPhao.shopId, okItems, ba);
    const res = await placeOrders(request, ba, [
      { shopId: aoPhao.shopId, items: okItems, expectedTotalVnd: tOk },
      { shopId: luoi.shopId, items: badItems, expectedTotalVnd: 999 * priceOf(luoi) },
    ], { buyerNote: "ca mot phan hong" });
    expect(res.status).toBe(200);
    const okRes = res.body.results.find((r) => r.shopId === aoPhao.shopId);
    const badRes = res.body.results.find((r) => r.shopId === luoi.shopId);
    expect(okRes?.ok, "shop A vẫn tạo được đơn").toBe(true);
    expect(badRes?.ok).toBe(false);
    expect((badRes as { code: string }).code).toBe("line_unavailable");
    expect((badRes as { productIds: string[] }).productIds).toContain(luoi.id);
  });

  test("AC-21 ca đua hết hàng: tồn 1, hai người mua cùng lúc ⇒ đúng 1 đơn", async ({ request }) => {
    const own = await findOwnProduct(request, sdvico, SEED.pLocDau);
    const restore = own.stock;
    const set1 = await patch(request, `/api/ban-hang/san-pham/${own.id}`, { stock: 1 }, sdvico);
    expect(set1.status, JSON.stringify(set1.body)).toBe(200);

    const items = [{ productId: own.id, qty: 1 }];
    const total = await expectedTotalFor(request, own.shopId, items, ba);
    const basket = [{ shopId: own.shopId, items, expectedTotalVnd: total }];
    // hai NGƯỜI MUA khác nhau ⇒ clientRef không chặn, chỉ tồn kho chặn
    const [a, b] = await Promise.all([
      placeOrders(request, ba, basket, { buyerNote: "dua-1" }),
      placeOrders(request, tu, basket, { buyerNote: "dua-2", address: { ...ADDRESS, name: "Trần Thị Tư" } }),
    ]);
    const results = [a.body.results[0], b.body.results[0]];
    const wins = results.filter((r) => r.ok);
    const loses = results.filter((r) => !r.ok);
    expect(wins.length, `phải đúng 1 người mua được: ${JSON.stringify(results)}`).toBe(1);
    expect(loses.length).toBe(1);
    expect((loses[0] as { code: string }).code).toBe("line_unavailable");
    expect((loses[0] as { available?: Record<string, number> }).available?.[own.id], "còn 0").toBe(0);
    expect(await stockOf(request, own.id), "tồn cuối = 0").toBe(0);

    // trả kho về như cũ cho các ca sau
    const back = await patch(request, `/api/ban-hang/san-pham/${own.id}`, { stock: restore }, sdvico);
    expect(back.status).toBe(200);
  });

  test("AC-26/R6 bấm đúp Đặt hàng (2 request song song, cùng clientRef) ⇒ 1 đơn", async ({ request }) => {
    const items = [{ productId: daCay.id, qty: 2 }];
    const total = await expectedTotalFor(request, daCay.shopId, items, ba);
    const basket = [{ shopId: daCay.shopId, items, expectedTotalVnd: total }];
    const opts = { buyerNote: "ca bam dup" };
    const stock0 = await stockOf(request, daCay.id);
    const [a, b] = await Promise.all([
      placeOrders(request, ba, basket, opts),
      placeOrders(request, ba, basket, opts),
    ]);
    const oks = [a.body.results[0], b.body.results[0]].filter((r) => r.ok) as { order: Order }[];
    expect(oks.length, "cả hai lần đều trả OK (lần sau là duplicate)").toBe(2);
    expect(oks[0].order.id, "cùng một đơn").toBe(oks[1].order.id);
    expect(await stockOf(request, daCay.id), "chỉ trừ kho một lần").toBe(stock0 - 2);
  });

  test("mất mạng giữa lúc gửi: bấm Đặt hàng lần nữa cùng nội dung ⇒ KHÔNG tạo đơn đôi", async ({ request }) => {
    const items = [{ productId: daCay.id, qty: 1 }];
    const total = await expectedTotalFor(request, daCay.shopId, items, ba);
    const basket = [{ shopId: daCay.shopId, items, expectedTotalVnd: total }];
    const opts = { buyerNote: "ca mat song" };
    const first = await placeOrders(request, ba, basket, opts);
    const id1 = (first.body.results[0] as { order: Order }).order.id;
    // máy khách không nhận được trả lời (timeout) và bấm lại — cùng nội dung
    const again = await placeOrders(request, ba, basket, opts);
    const r2 = again.body.results[0] as { order: Order; duplicate: boolean };
    expect(r2.duplicate).toBe(true);
    expect(r2.order.id).toBe(id1);
  });

  test("AC-53b shop tạm nghỉ: món vẫn hiện (shopPaused) nhưng KHÔNG đặt được", async ({ request }) => {
    const on = await patch(request, "/api/ban-hang/shop", { paused: true }, haidang);
    expect(on.status, JSON.stringify(on.body)).toBe(200);
    try {
      const list = await listProducts(request, { q: SEED.pDaCay, pageSize: 50 });
      const card = list.body.items.find((p) => p.title === SEED.pDaCay);
      expect(card, "shop tạm nghỉ vẫn hiện món").toBeTruthy();
      expect(card?.shopPaused).toBe(true);

      const items = [{ productId: daCay.id, qty: 1 }];
      const res = await placeOrders(request, ba, [
        { shopId: daCay.shopId, items, expectedTotalVnd: priceOf(daCay) + 30_000 },
      ], { buyerNote: "ca tam nghi" });
      expect(res.status).toBe(200);
      const r = res.body.results[0];
      expect(r.ok).toBe(false);
      expect((r as { code: string }).code).toBe("shop_paused");
    } finally {
      const off = await patch(request, "/api/ban-hang/shop", { paused: false }, haidang);
      expect(off.status).toBe(200);
    }
  });

  test("AC-23/AC-55 shop bị khoá giữa chừng: món biến khỏi chợ, đặt ⇒ shop_not_active", async ({ request }) => {
    const shopRes = await get<{ shop: { id: string } }>(request, `/api/cho/shop/${SEED.shopHaiDang}`);
    expect(shopRes.status).toBe(200);
    const shopId = shopRes.body.shop.id;

    const lock = await patch(
      request, `/api/admin/cho/shops/${shopId}`,
      { status: "tam_khoa", statusNote: "Kiểm tra giấy tờ đại lý" }, admin,
    );
    expect(lock.status, JSON.stringify(lock.body)).toBe(200);
    try {
      const list = await listProducts(request, { q: SEED.pDaCay, pageSize: 50 });
      expect(
        list.body.items.map((p) => p.title),
        "shop bị khoá ⇒ món biến khỏi chợ ngay",
      ).not.toContain(SEED.pDaCay);

      const page = await get(request, `/api/cho/shop/${SEED.shopHaiDang}`);
      expect(page.status, "trang shop ⇒ 403 shop_not_active").toBe(403);
      expect(page.body.code).toBe("shop_not_active");

      const items = [{ productId: daCay.id, qty: 1 }];
      const res = await placeOrders(request, ba, [
        { shopId: daCay.shopId, items, expectedTotalVnd: priceOf(daCay) },
      ], { buyerNote: "ca khoa shop" });
      const r = res.body.results[0];
      expect(r.ok).toBe(false);
      expect(["shop_not_active", "line_unavailable"]).toContain((r as { code: string }).code);
      expect((r as { code: string }).code, "đúng mã theo 12 §7.1").toBe("shop_not_active");
    } finally {
      const back = await patch(request, `/api/admin/cho/shops/${shopId}`, { status: "hoat_dong" }, admin);
      expect(back.status, "mở khoá lại cho các ca sau").toBe(200);
    }
  });

  test("AC-24 chuyển khoản mà có shop không có STK ⇒ 400 invalid, nói rõ shop nào", async ({ request }) => {
    const items = [{ productId: aoPhao.id, qty: 1 }]; // SDVICO — KHÔNG có STK
    const total = await expectedTotalFor(request, aoPhao.shopId, items, ba);
    const res = await placeOrders(request, ba, [
      { shopId: aoPhao.shopId, items, expectedTotalVnd: total },
    ], { paymentMethod: "chuyen_khoan", buyerNote: "ca ep cod" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid");
    expect(res.body.message ?? "").toContain("chỉ nhận tiền mặt");
  });

  test("AC-36 huỷ đơn chuyển khoản sau khi đã báo chuyển ⇒ needsRefund", async ({ request }) => {
    const items = [{ productId: daCay.id, qty: 2 }];
    const order = await placeOneOrder(request, ba, daCay.shopId, items, {
      paymentMethod: "chuyen_khoan",
      buyerNote: "ca needsRefund",
    });
    expect(order.paymentMethod).toBe("chuyen_khoan");
    expect(order.bankSnapshot?.bankAccount, "STK chụp vào đơn lúc đặt (R11)").toBeTruthy();

    const bao = await post<{ order: Order }>(request, `/api/cho/don/${order.id}/bao-chuyen`, {}, ba);
    expect(bao.status, JSON.stringify(bao.body)).toBe(200);
    expect(bao.body.order.paymentStatus).toBe("bao_da_chuyen");

    const huy = await patch<{ order: Order }>(
      request, `/api/ban-hang/don/${order.id}`,
      { status: "da_huy", note: "Hết hàng, shop xin lỗi bà con" }, haidang,
    );
    expect(huy.status, JSON.stringify(huy.body)).toBe(200);
    expect(huy.body.order.status).toBe("da_huy");
    expect(huy.body.order.needsRefund, "huỷ đơn CK đã báo chuyển ⇒ cần hoàn tiền").toBe(true);
    expect(huy.body.order.cancelBy).toBe("seller");
  });

  test("AC-35 báo chuyển khoản trên đơn COD ⇒ 400", async ({ request }) => {
    const order = await placeOneOrder(request, ba, aoPhao.shopId, [{ productId: aoPhao.id, qty: 1 }], {
      buyerNote: "ca P1 tren COD",
    });
    const res = await post(request, `/api/cho/don/${order.id}/bao-chuyen`, {}, ba);
    expect(res.status, "COD không có bước báo chuyển").toBe(400);
  });

  test("AC-25 trần: 21 dòng một shop ⇒ 400; 6 shop ⇒ 400", async ({ request }) => {
    const many = Array.from({ length: 21 }, () => ({ productId: aoPhao.id, qty: 1 }));
    const r1 = await placeOrders(request, ba, [
      { shopId: aoPhao.shopId, items: many, expectedTotalVnd: 21 * priceOf(aoPhao) },
    ]);
    expect(r1.status).toBe(400);
    expect(r1.body.message ?? "").toContain("tối đa 20 món");

    const sixShops = Array.from({ length: 6 }, (_, i) => ({
      shopId: `00000000-0000-4000-8000-00000000000${i}`,
      items: [{ productId: aoPhao.id, qty: 1 }],
      expectedTotalVnd: priceOf(aoPhao),
    }));
    const r2 = await placeOrders(request, ba, sixShops);
    expect(r2.status).toBe(400);
    expect(r2.body.message ?? "").toContain("tối đa 5 shop");
  });

  test("Món bị admin gỡ / đã xoá không đặt được (giỏ tra lại báo dropped)", async ({ request }) => {
    // món adminHidden không tra được id qua chợ ⇒ dùng id lạ để chắc chắn dropped
    const q = await post<{ quote: { dropped: { productId: string; reason: string }[] } }>(
      request, "/api/cho/gio/tinh",
      { items: [{ productId: "00000000-0000-4000-8000-000000000000", qty: 1 }] },
    );
    expect(q.status).toBe(200);
    expect(q.body.quote.dropped.length, "món không còn ⇒ dropped, không tính tổng").toBe(1);
  });
});
