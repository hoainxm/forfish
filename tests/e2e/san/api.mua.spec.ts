import { expect, test } from "@playwright/test";
import type { Order, ProductCard } from "@/lib/market/types";
import {
  ADDRESS, PERSONA, SEED, devLogin, expectedTotalFor, findProduct, get, getBuyerOrder,
  listBuyerOrders, listProducts, placeOneOrder, placeOrders, post, quoteCart, shopBySlug,
  stockOf, soldOf,
} from "./helpers";

// VÒNG LÕI NGƯỜI MUA — 11 §11 AC-02…AC-05, AC-08, AC-13, AC-16, AC-19, AC-27,
// AC-28, AC-32, AC-39. Route theo 12 §7.1.
test.describe("Chợ — vòng lõi người mua (API)", () => {
  let ba = "";
  let daCay: ProductCard;
  let aoPhao: ProductCard;

  test.beforeAll(async ({ request }) => {
    ba = await devLogin(request, PERSONA.buyerBa);
    daCay = await findProduct(request, SEED.pDaCay);
    aoPhao = await findProduct(request, SEED.pAoPhao);
  });

  test("AC-02 danh sách chợ: khách lạ xem được, lọc đúng món không được lên chợ", async ({ request }) => {
    const res = await listProducts(request, { pageSize: 50 }); // KHÔNG gửi chuỗi — khách lạ
    expect(res.status).toBe(200);
    const titles = res.body.items.map((p) => p.title);
    expect(titles.length).toBeGreaterThan(0);
    // hết hàng VẪN hiện (mờ trên UI) — bà con cần biết shop có bán món đó
    expect(titles, "món tồn 0 phải còn trong danh sách").toContain(SEED.pHetHang);
    // ba loại KHÔNG bao giờ được xuất hiện
    expect(titles, "món bị admin gỡ").not.toContain(SEED.pAdminHidden);
    expect(titles, "món seller ẩn").not.toContain(SEED.pAn);
    expect(titles, "món đã xoá mềm").not.toContain(SEED.pDeleted);
    // món của shop chưa duyệt (Phương Nam) không bao giờ lên chợ; món bị gỡ cũng vậy
    for (const p of res.body.items) {
      expect(p.shopSlug, "shop chờ duyệt không được lên chợ").not.toBe(SEED.shopPhuongNam);
      expect(p.adminHidden).toBe(false);
      expect(p.deletedAt ?? null).toBeNull();
    }
  });

  test("AC-05 phân trang: 20/trang, pageSize 200 bị hạ về 50, trang quá xa trả rỗng", async ({ request }) => {
    const p1 = await listProducts(request, {});
    expect(p1.status).toBe(200);
    expect(p1.body.pageSize).toBe(20);
    expect(p1.body.items.length).toBeLessThanOrEqual(20);
    const big = await listProducts(request, { pageSize: 200 });
    expect(big.body.pageSize, "pageSize phải bị hạ về 50").toBe(50);
    const far = await listProducts(request, { page: 26 });
    expect(far.status, "trang quá xa không phải lỗi").toBe(200);
    expect(far.body.items).toEqual([]);
  });

  test("AC-03/AC-04 tìm không dấu + sắp xếp + nhóm hàng lạ", async ({ request }) => {
    const found = await listProducts(request, { q: "loc dau" });
    expect(found.status).toBe(200);
    expect(
      found.body.items.map((p) => p.title),
      'tìm "loc dau" (không dấu) phải ra "Lọc dầu diesel máy tàu"',
    ).toContain(SEED.pLocDau);

    const asc = await listProducts(request, { sort: "gia_tang", pageSize: 50 });
    /*  Món LIÊN HỆ BÁO GIÁ (priceVnd null, ADR 0014) luôn xuống CUỐI; phần có
        giá thì tăng dần. Sắp bằng `a - b` trên null cho kết quả vô nghĩa nên
        tách hai vế ra kiểm riêng. */
    const prices = asc.body.items.map((p) => p.priceVnd);
    const withPrice = prices.filter((v): v is number => v != null);
    const firstNull = prices.findIndex((v) => v == null);
    if (firstNull >= 0) {
      expect(prices.slice(firstNull).every((v) => v == null), "món chưa có giá phải nằm cuối").toBe(true);
    }
    expect(withPrice, "gia_tang phải tăng dần").toEqual([...withPrice].sort((a, b) => a - b));

    const hot = await listProducts(request, { sort: "ban_chay", pageSize: 50 });
    const sold = hot.body.items.map((p) => p.soldCount);
    expect(sold, "ban_chay phải giảm dần theo soldCount").toEqual([...sold].sort((a, b) => b - a));

    const bad = await listProducts(request, { category: "may_dong_co" }); // gạch dưới — sai
    expect(bad.status, "AC-67: id danh mục gạch dưới không hợp lệ").toBe(400);
    expect(bad.body.code).toBe("invalid");
    const ok = await listProducts(request, { category: "may-dong-co" });
    expect(ok.status).toBe(200);
  });

  test("AC-08 lọc theo tỉnh chỉ trả món của shop tỉnh đó", async ({ request }) => {
    const shop = await shopBySlug(request, SEED.shopHaiDang);
    const res = await listProducts(request, { province: shop.province ?? "", pageSize: 50 });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const p of res.body.items) expect(p.shopSlug).toBe(SEED.shopHaiDang);
  });

  test("AC-13 giỏ nhóm theo shop, phí giao đúng luật miễn phí từ ngưỡng", async ({ request }) => {
    const q1 = await quoteCart(request, [
      { productId: aoPhao.id, qty: 1 },
      { productId: daCay.id, qty: 10 },
    ]);
    expect(q1.status).toBe(200);
    const groups = q1.body.quote.groups;
    expect(groups.length, "hai shop ⇒ hai nhóm").toBe(2);
    const gHai = groups.find((g) => g.shop.slug === SEED.shopHaiDang);
    const gSd = groups.find((g) => g.shop.slug === SEED.shopSdvico);
    expect(gHai?.shippingVnd, "chưa tới ngưỡng miễn phí ⇒ tính phí giao").toBe(30_000);
    expect(gHai?.totalVnd).toBe((gHai?.subtotalVnd ?? 0) + 30_000);
    expect(gSd?.shippingVnd, "SDVICO phí giao 0").toBe(0);
    expect(gSd?.shop.acceptsBankTransfer, "SDVICO không có STK ⇒ ép COD").toBe(false);
    expect(gHai?.shop.acceptsBankTransfer, "Hải Đăng có STK").toBe(true);

    const q2 = await quoteCart(request, [{ productId: daCay.id, qty: 60 }]); // 2.100.000đ ≥ 2tr
    const gFree = q2.body.quote.groups[0];
    expect(gFree.subtotalVnd).toBeGreaterThanOrEqual(2_000_000);
    expect(gFree.shippingVnd, "qua ngưỡng ⇒ miễn phí giao").toBe(0);
  });

  test("AC-16/AC-27/AC-39 đặt 2 shop ⇒ 2 đơn riêng, hiện ở đơn của tôi", async ({ request }) => {
    const items1 = [{ productId: aoPhao.id, qty: 2 }];
    const items2 = [{ productId: daCay.id, qty: 4 }];
    const stockAoPhao = await stockOf(request, aoPhao.id);
    const soldAoPhao = await soldOf(request, aoPhao.id);

    const t1 = await expectedTotalFor(request, aoPhao.shopId, items1, ba);
    const t2 = await expectedTotalFor(request, daCay.shopId, items2, ba);
    const res = await placeOrders(request, ba, [
      { shopId: aoPhao.shopId, items: items1, expectedTotalVnd: t1 },
      { shopId: daCay.shopId, items: items2, expectedTotalVnd: t2 },
    ], { buyerNote: "Giao ra cảng giúp shop" });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.results.length).toBe(2);
    for (const r of res.body.results) expect(r.ok, JSON.stringify(r)).toBe(true);
    const orders = res.body.results.map((r) => (r as { order: Order }).order);
    expect(new Set(orders.map((o) => o.shopId)).size, "mỗi đơn một shop").toBe(2);
    for (const o of orders) {
      expect(o.code, "mã đơn SDyymmdd + 4 ký tự").toMatch(/^SD\d{6}[A-Z0-9]{4}$/);
      expect(o.status).toBe("cho_xac_nhan");
      expect(o.paymentStatus).toBe("chua_thanh_toan");
      expect(o.buyerPhone).toBe(PERSONA.buyerBa);
      expect(o.totalVnd).toBe(o.subtotalVnd + o.shippingVnd);
      expect(o.timeline.length, "T0 ghi 1 dòng timeline").toBeGreaterThanOrEqual(1);
      expect(o.timeline[0].by).toBe("buyer");
    }
    // R7 — tồn trừ + soldCount cộng ngay lúc ĐẶT
    expect(await stockOf(request, aoPhao.id)).toBe(stockAoPhao - 2);
    expect(await soldOf(request, aoPhao.id)).toBe(soldAoPhao + 2);

    const mine = await listBuyerOrders(request, ba, { pageSize: 50 });
    expect(mine.status).toBe(200);
    const codes = mine.body.items.map((o) => o.code);
    for (const o of orders) expect(codes).toContain(o.code);
    for (const o of mine.body.items) expect(o.buyerPhone).toBe(PERSONA.buyerBa);
  });

  test("AC-19 gửi lại y hệt (cùng clientRef) ⇒ 1 đơn, duplicate:true, tồn chỉ trừ 1 lần", async ({ request }) => {
    const items = [{ productId: daCay.id, qty: 3 }];
    const total = await expectedTotalFor(request, daCay.shopId, items, ba);
    const basket = [{ shopId: daCay.shopId, items, expectedTotalVnd: total }];
    const opts = { buyerNote: "ca chống đơn đôi" };

    const stock0 = await stockOf(request, daCay.id);
    const a = await placeOrders(request, ba, basket, opts);
    const b = await placeOrders(request, ba, basket, opts);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const ra = a.body.results[0];
    const rb = b.body.results[0];
    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    const oa = (ra as { order: Order; duplicate: boolean }).order;
    const ob = (rb as { order: Order; duplicate: boolean }).order;
    expect((rb as { duplicate: boolean }).duplicate, "lần 2 phải là duplicate").toBe(true);
    expect(ob.id, "cùng một đơn").toBe(oa.id);
    expect(await stockOf(request, daCay.id), "không trừ kho hai lần").toBe(stock0 - 3);
  });

  test("AC-28 buyerPhone lấy từ chuỗi xác thực, KHÔNG từ body", async ({ request }) => {
    const items = [{ productId: aoPhao.id, qty: 1 }];
    const total = await expectedTotalFor(request, aoPhao.shopId, items, ba);
    const res = await post<{ results: { ok: boolean; order: Order }[] }>(
      request,
      "/api/cho/don",
      {
        shops: [{ shopId: aoPhao.shopId, items, clientRef: `m1-spoof-${Date.now()}`, expectedTotalVnd: total }],
        address: { ...ADDRESS, phone: "0988888888" }, // SĐT NGƯỜI NHẬN — dữ liệu
        paymentMethod: "cod",
        buyerPhone: "0999999999", // kẻ gian nhét SĐT khác vào body
        phone: "0999999999",
      },
      ba,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const order = res.body.results[0].order;
    expect(order.buyerPhone, "đơn phải thuộc SĐT đã đăng nhập").toBe(PERSONA.buyerBa);
    expect(order.address.phone, "SĐT người nhận vẫn giữ nguyên trong địa chỉ").toBe("0988888888");
  });

  test("AC-32 buyer huỷ ở cho_xac_nhan ⇒ hoàn kho; huỷ lần 2 ⇒ 409", async ({ request }) => {
    const items = [{ productId: aoPhao.id, qty: 5 }];
    const stock0 = await stockOf(request, aoPhao.id);
    const sold0 = await soldOf(request, aoPhao.id);
    const order = await placeOneOrder(request, ba, aoPhao.shopId, items, { buyerNote: "ca huỷ" });
    expect(await stockOf(request, aoPhao.id)).toBe(stock0 - 5);

    const huy = await post<{ order: Order }>(request, `/api/cho/don/${order.id}/huy`, { reason: "Đặt nhầm" }, ba);
    expect(huy.status, JSON.stringify(huy.body)).toBe(200);
    expect(huy.body.order.status).toBe("da_huy");
    expect(huy.body.order.cancelBy).toBe("buyer");
    expect(huy.body.order.needsRefund, "đơn COD huỷ ⇒ không cần hoàn tiền").toBe(false);
    expect(await stockOf(request, aoPhao.id), "hoàn kho đúng số").toBe(stock0);
    expect(await soldOf(request, aoPhao.id), "trừ lại soldCount").toBe(sold0);

    const lai = await post(request, `/api/cho/don/${order.id}/huy`, { reason: "Đặt nhầm" }, ba);
    expect(lai.status, "huỷ trùng / bấm đúp ⇒ 409 bad_transition").toBe(409);
    expect(lai.body.code).toBe("bad_transition");
  });

  test("AC-39 đơn của người khác ⇒ 404 (không lộ tồn tại)", async ({ request }) => {
    const tu = await devLogin(request, PERSONA.buyerTu);
    const mine = await listBuyerOrders(request, ba, { pageSize: 5 });
    const someOrder = mine.body.items[0];
    expect(someOrder, "Anh Ba phải có ít nhất 1 đơn seed").toBeTruthy();
    const res = await getBuyerOrder(request, tu, someOrder.id);
    expect(res.status).toBe(404);
  });

  test("Trang sản phẩm trả kèm shop + đánh giá; món đã gỡ/xoá ⇒ 404", async ({ request }) => {
    const detail = await get<{ product: ProductCard; shop: { slug: string }; reviews: { avg: number; count: number } }>(
      request,
      `/api/cho/san-pham/${daCay.id}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.product.title).toBe(SEED.pDaCay);
    expect(detail.body.shop.slug).toBe(SEED.shopHaiDang);
    expect(detail.body.reviews).toBeTruthy();

    const ghost = await get(request, "/api/cho/san-pham/00000000-0000-4000-8000-000000000000");
    expect(ghost.status).toBe(404);
  });
});
