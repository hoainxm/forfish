import { expect, test } from "@playwright/test";
import type { Order, Product, ProductDraftM, Review, Shop, ShopStats } from "@/lib/market/types";
import {
  PERSONA, devLogin, expectedTotalFor, fakeJpeg, fakePng, findOwnProduct, get,
  listProducts, patch, placeOneOrder, post, del, reviewsOf, sellerShop, uploadImage, url,
} from "./helpers";

// KÊNH NGƯỜI BÁN — 11 §6, AC-31, AC-33/34, AC-42/43, AC-44…AC-53.
// Chạy tuần tự: các ca sau dựa trên shop + món do ca đầu tạo.
test.describe.configure({ mode: "serial" });

test.describe("Chợ — kênh người bán (API)", () => {
  let nam = "";      // Cô Năm — persona chưa có shop
  let ba = "";       // người mua
  let admin = "";
  let sdvico = "";
  let shop: Shop | null = null;
  let productId = "";
  let orderId = "";

  const draft = {
    name: "Đại lý Cô Năm QA",
    province: "Khánh Hòa",
    address: "Cảng Hòn Rớ, lô B12",
    description: "Đại lý thử nghiệm của bộ test QA.",
    shippingFlatVnd: 20_000,
    freeShipFromVnd: 1_000_000,
  };

  const productDraft: ProductDraftM = {
    title: "Can nhựa đựng dầu 30L",
    category: "dau-nhot-nhien-lieu",
    priceVnd: 120_000,
    unit: "cái",
    stock: 10,
    images: [],
    variants: [],
    status: "dang_ban",
  };

  test.beforeAll(async ({ request }) => {
    nam = await devLogin(request, PERSONA.buyerNam);
    ba = await devLogin(request, PERSONA.buyerBa);
    admin = await devLogin(request, PERSONA.admin);
    sdvico = await devLogin(request, PERSONA.sellerSdvico);
  });

  test("AC-44 đăng ký shop: trùng tên ⇒ slug_taken; đăng ký lần 2 cùng SĐT ⇒ 409", async ({ request }) => {
    const before = await get<{ shop: Shop | null }>(request, "/api/ban-hang/shop", nam);
    expect(before.status).toBe(200);
    expect(before.body.shop, "Cô Năm chưa có shop").toBeNull();

    // tên trùng shop có sẵn, khác hoa/thường + dấu ⇒ cùng slug
    const taken = await post(request, "/api/ban-hang/shop", { ...draft, name: "sdvico" }, nam);
    expect(taken.status, JSON.stringify(taken.body)).toBe(409);
    expect(taken.body.code).toBe("slug_taken");

    const created = await post<{ shop: Shop }>(request, "/api/ban-hang/shop", draft, nam);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    shop = created.body.shop;
    expect(shop.status, "shop mới ⇒ chờ duyệt").toBe("cho_duyet");
    expect(shop.ownerPhone).toBe(PERSONA.buyerNam);

    const again = await post(request, "/api/ban-hang/shop", { ...draft, name: "Đại lý Cô Năm QA 2" }, nam);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("invalid");
    expect(again.body.message ?? "").toContain("đã có shop");
  });

  test("AC-46/AC-67 validate sản phẩm ở SERVER (không tin máy khách)", async ({ request }) => {
    const bads: [string, Partial<ProductDraftM>][] = [
      ["tên 2 chữ", { title: "Ca" }],
      ["giá 999", { priceVnd: 999 }],
      ["giá gạch ≤ giá bán", { compareAtVnd: 100_000 }],
      ["1 biến thể", { variants: [{ label: "5L" }] }],
      ["11 biến thể", { variants: Array.from({ length: 11 }, (_, i) => ({ label: `L${i}` })) }],
      ["2 biến thể trùng nhãn (khác dấu)", { variants: [{ label: "loại a" }, { label: "Loại A" }] }],
      ["7 ảnh", { images: Array.from({ length: 7 }, (_, i) => `/api/dev/uploads/x${i}.jpg`) }],
      ["danh mục gạch dưới", { category: "may_dong_co" as ProductDraftM["category"] }],
    ];
    for (const [ten, over] of bads) {
      const res = await post(request, "/api/ban-hang/san-pham", { ...productDraft, ...over }, nam);
      expect(res.status, `${ten} phải bị chặn — trả về ${JSON.stringify(res.body)}`).toBe(400);
      expect(res.body.code).toBe("invalid");
      expect(res.body.message, `${ten} phải kèm câu tiếng Việt`).toBeTruthy();
    }
  });

  test("AC-45 shop chờ duyệt vẫn soạn món; món CHƯA lên chợ; duyệt xong thì hiện", async ({ request }) => {
    const created = await post<{ product: Product }>(request, "/api/ban-hang/san-pham", productDraft, nam);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    productId = created.body.product.id;

    const chua = await listProducts(request, { q: productDraft.title, pageSize: 50 });
    expect(
      chua.body.items.map((p) => p.title),
      "shop chờ duyệt ⇒ món KHÔNG lên chợ",
    ).not.toContain(productDraft.title);

    const duyet = await patch<{ shop: Shop }>(
      request, `/api/admin/cho/shops/${shop?.id}`, { status: "hoat_dong" }, admin,
    );
    expect(duyet.status, JSON.stringify(duyet.body)).toBe(200);
    expect(duyet.body.shop.status).toBe("hoat_dong");
    expect(duyet.body.shop.approvedAt, "lần đầu hoạt động ⇒ approvedAt").toBeTruthy();

    const roi = await listProducts(request, { q: productDraft.title, pageSize: 50 });
    expect(
      roi.body.items.map((p) => p.title),
      "duyệt xong ⇒ món hiện, seller không phải làm gì thêm",
    ).toContain(productDraft.title);
  });

  test("AC-47 upload ảnh: JPEG hợp lệ 200 · > 500 KB 413 · không phải ảnh 415", async ({ request }) => {
    const ok = await uploadImage(request, nam, {
      name: "anh-mon.jpg", mimeType: "image/jpeg", buffer: fakeJpeg(2048),
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.url, "trả URL để gắn vào món").toMatch(/^\/api\/dev\/uploads\//);

    // AC-65 nhánh hợp lệ: đọc lại đúng Content-Type
    const back = await request.fetch(url(ok.body.url));
    expect(back.status(), "ảnh vừa tải lên phải đọc được").toBe(200);
    expect(back.headers()["content-type"]).toContain("image/jpeg");

    const big = await uploadImage(request, nam, {
      name: "to-qua.jpg", mimeType: "image/jpeg", buffer: fakeJpeg(600 * 1024),
    });
    expect(big.status, "ảnh > 500 KB").toBe(413);
    expect(big.body.code).toBe("bad_size");

    const notImage = await uploadImage(request, nam, {
      name: "gia-danh.jpg", mimeType: "image/jpeg", buffer: Buffer.from("day khong phai anh, chi la chu"),
    });
    expect(notImage.status, "file chữ đội lốt ảnh").toBe(415);
    expect(notImage.body.code).toBe("bad_type");

    // PNG thật đội tên .jpg nhưng khai đúng image/png ⇒ vẫn nhận
    const png = await uploadImage(request, nam, {
      name: "that-ra-la-png.jpg", mimeType: "image/png", buffer: fakePng(1024),
    });
    expect(png.status, "PNG thật ⇒ nhận").toBe(200);
  });

  test("AC-48/AC-49 sửa giá không đổi đơn cũ; xoá mềm; xoá lần 2 ⇒ 404", async ({ request }) => {
    // đơn tham chiếu cho AC-48
    const order = await placeOneOrder(request, ba, shop!.id, [{ productId, qty: 2 }], {
      buyerNote: "ca snapshot gia",
    });
    orderId = order.id;
    const giaCu = order.items[0].priceVnd;

    const up = await patch<{ product: Product }>(
      request, `/api/ban-hang/san-pham/${productId}`, { priceVnd: giaCu + 50_000 }, nam,
    );
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    expect(up.body.product.priceVnd).toBe(giaCu + 50_000);

    const donCu = await get<{ order: Order }>(request, `/api/cho/don/${orderId}`, ba);
    expect(donCu.status).toBe(200);
    expect(donCu.body.order.items[0].priceVnd, "R3 — đơn giữ giá lúc đặt").toBe(giaCu);

    // món phụ để xoá (không đụng món đang có đơn treo)
    const tmp = await post<{ product: Product }>(
      request, "/api/ban-hang/san-pham", { ...productDraft, title: "Món tạm để xoá QA" }, nam,
    );
    expect(tmp.status).toBe(201);
    const tmpId = tmp.body.product.id;
    const d1 = await del(request, `/api/ban-hang/san-pham/${tmpId}`, nam);
    expect(d1.status, JSON.stringify(d1.body)).toBe(200);
    const list = await get<{ items: Product[] }>(request, "/api/ban-hang/san-pham?pageSize=50", nam);
    expect(list.body.items.map((p) => p.id), "món đã xoá không còn trong danh sách shop").not.toContain(tmpId);
    const d2 = await del(request, `/api/ban-hang/san-pham/${tmpId}`, nam);
    expect(d2.status, "xoá lần 2 ⇒ 404").toBe(404);
  });

  /*  MÓN LIÊN HỆ BÁO GIÁ (ADR 0011) — đăng được VÀ SỬA ĐƯỢC.
      Ca này sinh ra từ một lỗi thật: đường PATCH biến `priceVnd: null` thành 0
      rồi validate chặn, nên 6 món của SDVICO chuyển sang chợ KHÔNG SỬA NỔI, kể
      cả khi chỉ sửa mô tả (form luôn gửi cả draft). Đường POST thì đúng — nên
      test phải đi qua CẢ HAI, và phải sửa một trường KHÁC giá để bắt đúng bệnh. */
  test("ADR 0011 món liên hệ báo giá: đăng được, sửa mô tả vẫn giữ null, đặt giá rồi bỏ giá lại", async ({ request }) => {
    const tao = await post<{ product: Product }>(
      request, "/api/ban-hang/san-pham",
      { ...productDraft, title: "Máy lọc nước biển QA báo giá", priceVnd: null, stock: 0, variants: [] },
      nam,
    );
    expect(tao.status, JSON.stringify(tao.body)).toBe(201);
    expect(tao.body.product.priceVnd, "đăng mới: giữ null").toBeNull();
    const id = tao.body.product.id;

    // sửa MÔ TẢ (không đụng giá) — form gửi cả draft nên priceVnd null đi kèm
    const suaMoTa = await patch<{ product: Product }>(
      request, `/api/ban-hang/san-pham/${id}`,
      { ...productDraft, title: "Máy lọc nước biển QA báo giá", priceVnd: null, stock: 0, variants: [], description: "Báo giá theo từng tàu." },
      nam,
    );
    expect(suaMoTa.status, `sửa món liên hệ báo giá phải được — ${JSON.stringify(suaMoTa.body)}`).toBe(200);
    expect(suaMoTa.body.product.priceVnd, "sửa xong vẫn là liên hệ báo giá").toBeNull();
    expect(suaMoTa.body.product.description).toContain("Báo giá theo từng tàu");

    // đặt giá thật ⇒ thành món bán thẳng
    const datGia = await patch<{ product: Product }>(
      request, `/api/ban-hang/san-pham/${id}`, { priceVnd: 1_500_000, stock: 3 }, nam,
    );
    expect(datGia.status, JSON.stringify(datGia.body)).toBe(200);
    expect(datGia.body.product.priceVnd).toBe(1_500_000);

    // bỏ giá lại ⇒ về liên hệ báo giá
    const boGia = await patch<{ product: Product }>(
      request, `/api/ban-hang/san-pham/${id}`, { priceVnd: null }, nam,
    );
    expect(boGia.status, JSON.stringify(boGia.body)).toBe(200);
    expect(boGia.body.product.priceVnd, "bỏ giá ⇒ null, KHÔNG phải 0").toBeNull();

    await del(request, `/api/ban-hang/san-pham/${id}`, nam);
  });

  test("AC-31/AC-50 chuyển trạng thái đơn: sai bước 409, huỷ thiếu lý do 400, đơn shop khác 404", async ({ request }) => {
    const donShop = await get<{ order: Order }>(request, `/api/ban-hang/don/${orderId}`, nam);
    expect(donShop.status).toBe(200);
    expect(donShop.body.order.status).toBe("cho_xac_nhan");

    // AC-50 — chủ shop khác đọc đơn này ⇒ 404 (không lộ tồn tại)
    const nguoiLa = await get(request, `/api/ban-hang/don/${orderId}`, sdvico);
    expect(nguoiLa.status).toBe(404);

    // nhảy cóc cho_xac_nhan → da_giao
    const nhayCoc = await patch(request, `/api/ban-hang/don/${orderId}`, { status: "da_giao" }, nam);
    expect(nhayCoc.status, "bước không có trong bảng ⇒ 409").toBe(409);
    expect(nhayCoc.body.code).toBe("bad_transition");

    // huỷ thiếu lý do
    const huyThieu = await patch(request, `/api/ban-hang/don/${orderId}`, { status: "da_huy" }, nam);
    expect(huyThieu.status, "seller huỷ phải có lý do 5–200").toBe(400);
    expect(huyThieu.body.code).toBe("invalid");

    const t1 = await patch<{ order: Order }>(request, `/api/ban-hang/don/${orderId}`, { status: "da_xac_nhan" }, nam);
    expect(t1.status, JSON.stringify(t1.body)).toBe(200);
    expect(t1.body.order.status).toBe("da_xac_nhan");

    // AC-32 — buyer chỉ huỷ được ở cho_xac_nhan
    const buyerHuy = await post(request, `/api/cho/don/${orderId}/huy`, {}, ba);
    expect(buyerHuy.status, "buyer huỷ ở da_xac_nhan ⇒ 409").toBe(409);

    const t2 = await patch<{ order: Order }>(
      request, `/api/ban-hang/don/${orderId}`,
      { status: "dang_giao", carrier: "Gửi xe Phương Trang", trackingCode: "PT-77120" }, nam,
    );
    expect(t2.status, JSON.stringify(t2.body)).toBe(200);
    expect(t2.body.order.carrier).toBe("Gửi xe Phương Trang");
    expect(t2.body.order.trackingCode).toBe("PT-77120");

    const note = await patch<{ order: Order }>(
      request, `/api/ban-hang/don/${orderId}`, { sellerNote: "Xe chạy 5h sáng mai, bà con để ý điện thoại." }, nam,
    );
    expect(note.status, JSON.stringify(note.body)).toBe(200);

    const t3 = await patch<{ order: Order }>(request, `/api/ban-hang/don/${orderId}`, { status: "da_giao" }, nam);
    expect(t3.status).toBe(200);
    expect(t3.body.order.deliveredAt, "T3 đặt deliveredAt").toBeTruthy();
  });

  test("AC-42 đánh giá khi chưa nhận hàng ⇒ 409 review_not_allowed", async ({ request }) => {
    const res = await post(request, `/api/cho/don/${orderId}/danh-gia`, { productId, rating: 5 }, ba);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("review_not_allowed");
  });

  test("AC-33/34/53 buyer bấm Đã nhận ⇒ hoàn thành, COD ⇒ đã thanh toán, ghi chú shop hiện với buyer", async ({ request }) => {
    const nhan = await post<{ order: Order }>(request, `/api/cho/don/${orderId}/da-nhan`, {}, ba);
    expect(nhan.status, JSON.stringify(nhan.body)).toBe(200);
    const o = nhan.body.order;
    expect(o.status).toBe("hoan_thanh");
    expect(o.completedAt).toBeTruthy();
    expect(o.paymentStatus, "COD hoàn thành ⇒ đã thanh toán").toBe("da_thanh_toan");
    expect(o.sellerNote, "AC-53 buyer thấy ghi chú của shop").toContain("Xe chạy 5h sáng");
    expect(o.timeline.some((t) => t.status === "hoan_thanh" && t.by === "buyer")).toBe(true);

    const lan2 = await post(request, `/api/cho/don/${orderId}/da-nhan`, {}, ba);
    expect(lan2.status, "bấm lần 2 ⇒ 409").toBe(409);
  });

  test("AC-42/AC-43 đánh giá: 1 lần/món/đơn, sao cập nhật lên món và shop", async ({ request }) => {
    const first = await post<{ review: Review }>(
      request, `/api/cho/don/${orderId}/danh-gia`,
      { productId, rating: 4, comment: "Hàng chắc, giao đúng hẹn." }, ba,
    );
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.review.rating).toBe(4);
    expect(first.body.review.buyerPhoneMasked ?? "", "SĐT người đánh giá phải che").not.toBe(PERSONA.buyerBa);

    const again = await post(request, `/api/cho/don/${orderId}/danh-gia`, { productId, rating: 5 }, ba);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("already_reviewed");

    const detail = await get<{ product: Product; shop: Shop }>(request, `/api/cho/san-pham/${productId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.product.ratingCount).toBe(1);
    expect(detail.body.product.ratingAvg).toBe(4);
    expect(detail.body.shop.ratingAvg, "điểm shop tính từ đánh giá không ẩn").toBe(4);

    const ds = await reviewsOf(request, productId);
    expect(ds.status).toBe(200);
    expect(ds.body.items.length).toBe(1);

    const saoLoi = await post(request, `/api/cho/don/${orderId}/danh-gia`, { productId, rating: 9 }, ba);
    expect(saoLoi.status, "sao ngoài 1..5 ⇒ 400").toBe(400);
  });

  test("AC-52 thống kê: doanh thu tính theo đơn hoàn thành", async ({ request }) => {
    const res = await get<{ stats: ShopStats }>(request, "/api/ban-hang/thong-ke?range=7d", nam);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.stats.revenueVnd, "đơn vừa hoàn thành phải vào doanh thu").toBeGreaterThan(0);
    expect(res.body.stats.byStatus, "có bảng đếm theo trạng thái").toBeTruthy();
  });

  test("AC-51 shop bị tạm khoá: KHÔNG thêm món (403), nhưng vẫn xử lý được đơn treo", async ({ request }) => {
    // đơn treo trước khi khoá
    const p = await findOwnProduct(request, nam, productDraft.title);
    const total = await expectedTotalFor(request, p.shopId, [{ productId: p.id, qty: 1 }], ba);
    expect(total).toBeGreaterThan(0);
    const treo = await placeOneOrder(request, ba, p.shopId, [{ productId: p.id, qty: 1 }], {
      buyerNote: "ca shop bi khoa",
    });

    const khoa = await patch(
      request, `/api/admin/cho/shops/${shop?.id}`,
      { status: "tam_khoa", statusNote: "Xác minh giấy phép kinh doanh" }, admin,
    );
    expect(khoa.status, JSON.stringify(khoa.body)).toBe(200);
    try {
      const themMon = await post(request, "/api/ban-hang/san-pham", { ...productDraft, title: "Món khi bị khoá" }, nam);
      expect(themMon.status, "tam_khoa ⇒ không thêm món").toBe(403);
      expect(themMon.body.code).toBe("shop_not_active");

      const xuLy = await patch<{ order: Order }>(request, `/api/ban-hang/don/${treo.id}`, { status: "da_xac_nhan" }, nam);
      expect(xuLy.status, "vẫn xử lý được đơn đang treo — không bỏ rơi người mua").toBe(200);
      expect(xuLy.body.order.status).toBe("da_xac_nhan");

      const huy = await patch<{ order: Order }>(
        request, `/api/ban-hang/don/${treo.id}`, { status: "da_huy", note: "Shop đang tạm khoá, xin lỗi bà con" }, nam,
      );
      expect(huy.status).toBe(200);
      expect(huy.body.order.needsRefund, "đơn COD ⇒ không cần hoàn tiền").toBe(false);
    } finally {
      const mo = await patch(request, `/api/admin/cho/shops/${shop?.id}`, { status: "hoat_dong" }, admin);
      expect(mo.status).toBe(200);
    }
  });

  test("Cờ có shop: GET /api/ban-hang/shop trả shop của chính SĐT (AC-53c nguồn dữ liệu)", async ({ request }) => {
    const mine = await sellerShop(request, nam);
    expect(mine?.slug).toBe("dai-ly-co-nam-qa");
    const chuaCo = await sellerShop(request, await devLogin(request, PERSONA.buyerTu));
    expect(chuaCo, "persona chưa có shop ⇒ null (sheet Tài khoản hiện dòng mời đăng ký)").toBeNull();
  });

  test("AC-53b bật/tắt Tạm nghỉ bán qua PATCH shop", async ({ request }) => {
    const on = await patch<{ shop: Shop }>(request, "/api/ban-hang/shop", { paused: true }, nam);
    expect(on.status, JSON.stringify(on.body)).toBe(200);
    expect(on.body.shop.paused).toBe(true);
    const off = await patch<{ shop: Shop }>(request, "/api/ban-hang/shop", { paused: false }, nam);
    expect(off.status).toBe(200);
    expect(off.body.shop.paused).toBe(false);
  });
});
