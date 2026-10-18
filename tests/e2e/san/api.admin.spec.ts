import { expect, test } from "@playwright/test";
import type { AdminOverview, Order, Product, Review, Shop } from "@/lib/market/types";
import {
  PERSONA, SEED, devLogin, findProduct, get, listProducts, patch, post,
} from "./helpers";

// ADMIN SÀN — 11 §7, AC-37, AC-43, AC-54…AC-58. Mọi route `requireAdmin`.
test.describe.configure({ mode: "serial" });

test.describe("Chợ — admin sàn (API)", () => {
  let admin = "";
  let ba = "";
  let phuongnam = "";
  let haidang = "";

  const findOrderByCode = async (
    request: Parameters<typeof get>[0],
    code: string,
  ): Promise<Order | undefined> => {
    const res = await get<{ items: Order[] }>(request, `/api/admin/cho/don?code=${code}`, admin);
    expect(res.status, `GET /api/admin/cho/don?code=${code} → ${JSON.stringify(res.body)}`).toBe(200);
    return res.body.items.find((o) => o.code === code);
  };

  test.beforeAll(async ({ request }) => {
    admin = await devLogin(request, PERSONA.admin);
    ba = await devLogin(request, PERSONA.buyerBa);
    phuongnam = await devLogin(request, PERSONA.sellerPhuongNam);
    haidang = await devLogin(request, PERSONA.sellerHaiDang);
  });

  test("AC-54 chỉ admin vào được /api/admin/cho/*", async ({ request }) => {
    const khongChuoi = await get(request, "/api/admin/cho/tong-quan");
    expect(khongChuoi.status, "không có chuỗi ⇒ 401").toBe(401);

    const chuoiLa = await get(request, "/api/admin/cho/tong-quan", "sdf_chuoi-la-khong-co-trong-so-persona-000000000");
    expect(chuoiLa.status, "chuỗi lạ ⇒ 401").toBe(401);

    const nguoiMua = await get(request, "/api/admin/cho/tong-quan", ba);
    expect(nguoiMua.status, "người mua ⇒ 403").toBe(403);

    const nguoiBan = await get(request, "/api/admin/cho/shops", haidang);
    expect(nguoiBan.status, "người bán ⇒ 403").toBe(403);
  });

  test("KPI sàn: /api/admin/cho/tong-quan trả đủ khối", async ({ request }) => {
    const res = await get<{ overview: AdminOverview }>(request, "/api/admin/cho/tong-quan", admin);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const ov = res.body.overview;
    expect(ov.shops, "đếm shop theo trạng thái").toBeTruthy();
    expect(ov.productsOnSale).toBeGreaterThan(0);
    expect(ov.gmvVnd).toBeTruthy();
    expect(ov.cancelRate30d).toBeGreaterThanOrEqual(0);
    expect(ov.cancelRate30d).toBeLessThanOrEqual(1);
  });

  test("AC-56/AC-44b từ chối shop phải có lý do; shop bị từ chối gửi lại ⇒ cùng id, về chờ duyệt", async ({ request }) => {
    const ds = await get<{ items: (Shop & { productCount: number })[] }>(
      request, "/api/admin/cho/shops?status=cho_duyet", admin,
    );
    expect(ds.status, JSON.stringify(ds.body)).toBe(200);
    const pn = ds.body.items.find((s) => s.slug === SEED.shopPhuongNam);
    expect(pn, "shop Phương Nam đang chờ duyệt trong seed").toBeTruthy();
    expect(pn?.ownerPhone, "danh sách admin có SĐT chủ shop").toBeTruthy();

    const thieuLyDo = await patch(request, `/api/admin/cho/shops/${pn!.id}`, { status: "tu_choi" }, admin);
    expect(thieuLyDo.status, "từ chối không lý do ⇒ 400").toBe(400);
    expect(thieuLyDo.body.code).toBe("invalid");

    const ngan = await patch(
      request, `/api/admin/cho/shops/${pn!.id}`, { status: "tu_choi", statusNote: "sai" }, admin,
    );
    expect(ngan.status, "lý do < 5 chữ ⇒ 400").toBe(400);

    const tuChoi = await patch<{ shop: Shop }>(
      request, `/api/admin/cho/shops/${pn!.id}`,
      { status: "tu_choi", statusNote: "Thiếu ảnh giấy phép kinh doanh, gửi lại giúp." }, admin,
    );
    expect(tuChoi.status, JSON.stringify(tuChoi.body)).toBe(200);
    expect(tuChoi.body.shop.status).toBe("tu_choi");

    // AC-44b — gửi lại đăng ký = CÙNG shop, về cho_duyet
    const guiLai = await post<{ shop: Shop }>(
      request, "/api/ban-hang/shop",
      {
        name: "Đại lý Phương Nam", province: "An Giang", address: "Cảng Tắc Cậu",
        description: "Vật tư tàu cá vùng Rạch Giá.", shippingFlatVnd: 50_000,
      }, phuongnam,
    );
    expect(guiLai.status, JSON.stringify(guiLai.body)).toBe(201);
    expect(guiLai.body.shop.id, "cùng shop, không tạo hàng mới").toBe(pn!.id);
    expect(guiLai.body.shop.status).toBe("cho_duyet");
  });

  test("AC-56b gán chủ shop: SĐT đã có shop khác ⇒ 400; gán xong trả lại chủ cũ", async ({ request }) => {
    const shops = await get<{ items: Shop[] }>(request, "/api/admin/cho/shops?status=hoat_dong", admin);
    expect(shops.status).toBe(200);
    const sdvicoShop = shops.body.items.find((s) => s.slug === SEED.shopSdvico);
    expect(sdvicoShop, "shop SDVICO").toBeTruthy();
    const chuCu = sdvicoShop!.ownerPhone;

    const trung = await patch(
      request, `/api/admin/cho/shops/${sdvicoShop!.id}`, { ownerPhone: PERSONA.sellerHaiDang }, admin,
    );
    expect(trung.status, "SĐT đã là chủ shop khác ⇒ 400").toBe(400);
    expect(trung.body.code).toBe("invalid");

    const gan = await patch<{ shop: Shop }>(
      request, `/api/admin/cho/shops/${sdvicoShop!.id}`, { ownerPhone: PERSONA.buyerTu }, admin,
    );
    expect(gan.status, JSON.stringify(gan.body)).toBe(200);
    expect(gan.body.shop.ownerPhone).toBe(PERSONA.buyerTu);

    const traLai = await patch<{ shop: Shop }>(
      request, `/api/admin/cho/shops/${sdvicoShop!.id}`, { ownerPhone: chuCu }, admin,
    );
    expect(traLai.status).toBe(200);
    expect(traLai.body.shop.ownerPhone).toBe(chuCu);
  });

  test("AC-56c admin xử lý đơn THAY shop: timeline ghi admin:<sđt>", async ({ request }) => {
    const don = await findOrderByCode(request, SEED.orderChoXacNhanCk);
    expect(don, `đơn seed ${SEED.orderChoXacNhanCk}`).toBeTruthy();
    expect(don!.status).toBe("cho_xac_nhan");

    const t1 = await patch<{ order: Order }>(
      request, `/api/admin/cho/don/${don!.id}`, { status: "da_xac_nhan" }, admin,
    );
    expect(t1.status, JSON.stringify(t1.body)).toBe(200);
    expect(t1.body.order.status).toBe("da_xac_nhan");
    const last = t1.body.order.timeline[t1.body.order.timeline.length - 1];
    expect(last.by, "by = admin:<sđt> để shop biết SDVICO đã xử lý thay").toBe(`admin:${PERSONA.admin}`);

    // P2 — admin xác nhận đã nhận tiền chuyển khoản
    const p2 = await patch<{ order: Order }>(
      request, `/api/admin/cho/don/${don!.id}`, { paymentStatus: "da_thanh_toan" }, admin,
    );
    expect(p2.status, JSON.stringify(p2.body)).toBe(200);
    expect(p2.body.order.paymentStatus).toBe("da_thanh_toan");
  });

  test("AC-37 admin huỷ được tới dang_giao (hoàn kho), KHÔNG huỷ được da_giao", async ({ request }) => {
    const dangGiao = await findOrderByCode(request, SEED.orderDangGiao);
    expect(dangGiao, `đơn seed ${SEED.orderDangGiao}`).toBeTruthy();
    expect(dangGiao!.status).toBe("dang_giao");
    const monId = dangGiao!.items[0].productId;
    const qty = dangGiao!.items[0].qty;
    const truoc = await get<{ product: Product }>(request, `/api/cho/san-pham/${monId}`);
    const stock0 = truoc.body.product.stock;

    const thieu = await patch(request, `/api/admin/cho/don/${dangGiao!.id}`, { status: "da_huy" }, admin);
    expect(thieu.status, "admin huỷ cũng phải có lý do").toBe(400);

    const huy = await patch<{ order: Order }>(
      request, `/api/admin/cho/don/${dangGiao!.id}`,
      { status: "da_huy", note: "Người mua gọi tổng đài xin huỷ, shop đồng ý" }, admin,
    );
    expect(huy.status, JSON.stringify(huy.body)).toBe(200);
    expect(huy.body.order.status).toBe("da_huy");
    expect(huy.body.order.cancelBy).toBe("admin");
    const sau = await get<{ product: Product }>(request, `/api/cho/san-pham/${monId}`);
    expect(sau.body.product.stock, "huỷ ⇒ hoàn kho").toBe(stock0 + qty);

    const daGiao = await findOrderByCode(request, SEED.orderDaGiao2Ngay);
    expect(daGiao, `đơn seed ${SEED.orderDaGiao2Ngay}`).toBeTruthy();
    const qua = await patch(
      request, `/api/admin/cho/don/${daGiao!.id}`, { status: "da_huy", note: "Thử huỷ sau khi đã giao" }, admin,
    );
    expect(qua.status, "sau da_giao chỉ còn điện thoại — không huỷ trong app").toBe(409);
    expect(qua.body.code).toBe("bad_transition");
  });

  test("Gỡ / trả lại sản phẩm: gỡ phải có lý do, món biến khỏi chợ", async ({ request }) => {
    const mon = await findProduct(request, SEED.pDaCay);

    const thieu = await patch(request, `/api/admin/cho/san-pham/${mon.id}`, { adminHidden: true }, admin);
    expect(thieu.status, "gỡ không lý do ⇒ 400").toBe(400);

    const go = await patch<{ product: Product }>(
      request, `/api/admin/cho/san-pham/${mon.id}`,
      { adminHidden: true, reason: "Đăng sai nhóm hàng, shop sửa lại rồi báo SDVICO" }, admin,
    );
    expect(go.status, JSON.stringify(go.body)).toBe(200);
    expect(go.body.product.adminHidden).toBe(true);

    const cho = await listProducts(request, { q: SEED.pDaCay, pageSize: 50 });
    expect(cho.body.items.map((p) => p.title), "món bị gỡ biến khỏi chợ").not.toContain(SEED.pDaCay);

    const tra = await patch<{ product: Product }>(
      request, `/api/admin/cho/san-pham/${mon.id}`, { adminHidden: false }, admin,
    );
    expect(tra.status).toBe(200);
    expect(tra.body.product.adminHidden).toBe(false);
    const lai = await listProducts(request, { q: SEED.pDaCay, pageSize: 50 });
    expect(lai.body.items.map((p) => p.title)).toContain(SEED.pDaCay);
  });

  test("AC-43 ẩn đánh giá ⇒ điểm món + shop tính lại từ đánh giá KHÔNG ẩn", async ({ request }) => {
    const gps = await findProduct(request, "Máy định vị GPS Garmin 585 Plus");
    expect(gps.ratingCount, "seed có 1 đánh giá 5★ cho GPS").toBe(1);
    expect(gps.ratingAvg).toBe(5);

    const ds = await get<{ items: Review[] }>(request, `/api/admin/cho/danh-gia?productId=${gps.id}`, admin);
    expect(ds.status, JSON.stringify(ds.body)).toBe(200);
    const rv = ds.body.items.find((r) => !r.hidden);
    expect(rv, "admin thấy cả đánh giá ẩn lẫn không ẩn").toBeTruthy();

    const an = await patch<{ review: Review }>(
      request, `/api/admin/cho/danh-gia/${rv!.id}`, { hidden: true }, admin,
    );
    expect(an.status, JSON.stringify(an.body)).toBe(200);
    expect(an.body.review.hidden).toBe(true);

    const sau = await get<{ product: Product; reviews: { count: number } }>(
      request, `/api/cho/san-pham/${gps.id}`,
    );
    expect(sau.body.product.ratingCount, "ẩn rồi ⇒ không tính điểm").toBe(0);
    expect(sau.body.reviews.count).toBe(0);

    const hien = await patch<{ review: Review }>(
      request, `/api/admin/cho/danh-gia/${rv!.id}`, { hidden: false }, admin,
    );
    expect(hien.status).toBe(200);
    const lai = await get<{ product: Product }>(request, `/api/cho/san-pham/${gps.id}`);
    expect(lai.body.product.ratingCount).toBe(1);
    expect(lai.body.product.ratingAvg).toBe(5);
  });

  test("AC-57 thông báo có ghi (kho dev thay push): chủ shop nhận tin đơn mới", async ({ request }) => {
    const res = await get<{ items: { phone: string; title: string; pushOs: boolean }[] }>(
      request, `/api/dev/notifications?phone=${PERSONA.sellerHaiDang}`, admin,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length, "seed đã có 1 tin đơn mới cho Hải Đăng").toBeGreaterThan(0);
    expect(res.body.items.some((n) => n.pushOs === true), "người bán được push OS (LEAD §4 #4)").toBe(true);
  });
});
