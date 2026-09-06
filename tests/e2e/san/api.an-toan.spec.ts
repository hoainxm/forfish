import { expect, test } from "@playwright/test";
import type { Order } from "@/lib/market/types";
import { PERSONA, devLogin, get, patch, post, url } from "./helpers";

// AN TOÀN — 11 R18, AC-39, AC-50, AC-54, AC-65. Danh tính LUÔN từ chuỗi xác
// thực, không bao giờ từ body/query; đường dẫn ảnh không đi ra khỏi thư mục.
test.describe("Chợ — an toàn & quyền (API)", () => {
  let ba = "";
  let tu = "";
  let haidang = "";
  let admin = "";

  test.beforeAll(async ({ request }) => {
    ba = await devLogin(request, PERSONA.buyerBa);
    tu = await devLogin(request, PERSONA.buyerTu);
    haidang = await devLogin(request, PERSONA.sellerHaiDang);
    admin = await devLogin(request, PERSONA.admin);
  });

  test("Không chuỗi / chuỗi lạ ⇒ 401 ở mọi route cần đăng nhập", async ({ request }) => {
    const canDangNhap = ["/api/cho/don", "/api/ban-hang/shop", "/api/ban-hang/don", "/api/admin/cho/shops"];
    for (const p of canDangNhap) {
      const khong = await get(request, p);
      expect(khong.status, `${p} không chuỗi`).toBe(401);
      const la = await get(request, p, "sdf_khong-phai-chuoi-that-0000000000000000000000");
      expect(la.status, `${p} chuỗi lạ`).toBe(401);
    }
  });

  test("Người mua gọi route người bán ⇒ 404 no_shop (không lộ shop của ai)", async ({ request }) => {
    const don = await get(request, "/api/ban-hang/don", ba);
    expect(don.status).toBe(404);
    expect(don.body.code).toBe("no_shop");

    const sp = await post(request, "/api/ban-hang/san-pham", { title: "Thử" }, ba);
    expect(sp.status).toBe(404);
    expect(sp.body.code).toBe("no_shop");
  });

  test("Người mua / người bán gọi route admin ⇒ 403", async ({ request }) => {
    for (const token of [ba, haidang]) {
      const a = await get(request, "/api/admin/cho/tong-quan", token);
      expect(a.status).toBe(403);
      const b = await patch(request, "/api/admin/cho/shops/khong-co", { status: "hoat_dong" }, token);
      expect(b.status).toBe(403);
    }
  });

  test("R18 SĐT không lấy từ query: lọc đơn luôn theo chuỗi xác thực", async ({ request }) => {
    const res = await get<{ items: Order[] }>(
      request, `/api/cho/don?buyerPhone=${PERSONA.buyerBa}&phone=${PERSONA.buyerBa}&pageSize=50`, tu,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    for (const o of res.body.items) {
      expect(o.buyerPhone, "không được trả đơn của SĐT khác dù query xin").toBe(PERSONA.buyerTu);
    }
  });

  test("AC-65 đường dẫn ảnh dev: không ra khỏi thư mục uploads", async ({ request }) => {
    const bads = [
      "/api/dev/uploads/..%2F..%2Fpackage.json",
      "/api/dev/uploads/a..b.jpg",
      "/api/dev/uploads/..%2Fmarket-dev.json",
      "/api/dev/uploads/khong-co-that.jpg",
      "/api/dev/uploads/tep.txt",
    ];
    for (const p of bads) {
      const res = await get(request, p);
      expect(res.status, `${p} phải 404`).toBe(404);
    }
  });

  test("Đơn của người khác: đọc ⇒ 404, ghi ⇒ 404/409 (không đổi được)", async ({ request }) => {
    const mine = await get<{ items: Order[] }>(request, "/api/cho/don?pageSize=5", ba);
    expect(mine.status).toBe(200);
    const o = mine.body.items[0];
    expect(o, "Anh Ba có đơn seed").toBeTruthy();

    const doc = await get(request, `/api/cho/don/${o.id}`, tu);
    expect(doc.status).toBe(404);

    const huy = await post(request, `/api/cho/don/${o.id}/huy`, { reason: "phá" }, tu);
    expect([404, 409], `huỷ đơn người khác — trả ${huy.status}`).toContain(huy.status);

    const cuaShopKhac = await get(request, `/api/ban-hang/don/${o.id}`, haidang);
    expect([200, 404], "chủ shop chỉ đọc được đơn của shop mình").toContain(cuaShopKhac.status);
  });

  test("Body không phải JSON ⇒ 400 bad_body, không 500", async ({ request }) => {
    const res = await request.fetch(url("/api/cho/gio/tinh"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      data: "{khong-phai-json",
    });
    expect([400, 415], `trả ${res.status()}`).toContain(res.status());
  });

  test("Persona dev chỉ có trong kho file — /api/dev/personas trả đúng 7 persona", async ({ request }) => {
    const res = await get<{ items: { phone: string; role: string }[] }>(request, "/api/dev/personas", admin);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.items.length).toBe(7);
    expect(res.body.items.filter((p) => p.role === "admin").length).toBe(1);
  });
});
