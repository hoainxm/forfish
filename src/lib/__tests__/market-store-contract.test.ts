import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileStore, DEV_FILE_NAME, type FileMarketStore } from "@/lib/market/file-store";
import { isMarketError, MarketError, marketErrorStatus } from "@/lib/market/errors";
import { settleOverdue } from "@/lib/market/order-state";
import { buildMarketLines, computeTotals } from "@/lib/market/pricing";
import type { PreparedShopOrder } from "@/lib/market/store";
import { foldVn } from "@/lib/market/text";
import type { Address, Order, Product, ProductStatusFilter, Shop } from "@/lib/market/types";

/*  HỢP ĐỒNG CHUNG cho cả hai adapter (12 §3.6) — chạy trên file-store với thư
    mục tạm. supabase-store không chạy được ở máy này (không có DB); bảng hành vi
    này là thứ Buyer/Seller/Admin dựa vào, nên phải xanh trước khi họ code. */

vi.stubEnv("MARKET_STORE", "file");
vi.stubEnv("VERCEL", "");

const NOW = new Date("2026-09-06T08:00:00.000Z");
const addr: Address = { name: "Nguyễn Văn Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true };
const common = { address: addr, paymentMethod: "cod" as const };

let dir: string;
let store: FileMarketStore;
let sdvico: Shop;
let haidang: Shop;
let phuongnam: Shop;

const code = (e: unknown) => (isMarketError(e) ? e.code : `KHÔNG PHẢI MarketError: ${String(e)}`);
const expectCode = async (p: Promise<unknown>, c: string) => {
  try {
    await p;
    throw new Error(`mong ${c} nhưng không ném`);
  } catch (e) {
    expect(code(e)).toBe(c);
  }
};
const byTitle = async (t: string): Promise<Product> => {
  const s = await store.readState(); // object SỐNG trong RAM — phải sao chép để so trước/sau
  const p = s.products.find((x) => x.title === t)!;
  expect(p, t).toBeTruthy();
  return structuredClone(p);
};
const prepared = (shop: Shop, products: Product[], items: { productId: string; qty: number; variantLabel?: string }[], clientRef: string): PreparedShopOrder => {
  const { lines, dropped } = buildMarketLines(items, products, shop);
  expect(dropped).toEqual([]);
  const t = computeTotals(lines, shop);
  return {
    shopId: shop.id, clientRef, lines, ...t,
    ...(shop.bankAccount ? { bankSnapshot: { bankName: shop.bankName!, bankAccount: shop.bankAccount, bankHolder: shop.bankHolder! } } : {}),
  };
};

beforeAll(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "sdfish-market-"));
  store = createFileStore({ dir, now: () => NOW });
  sdvico = (await store.getShopBySlug("sdvico"))!;
  haidang = (await store.getShopBySlug("dai-ly-hai-dang"))!;
  phuongnam = (await store.getShopBySlug("dai-ly-phuong-nam"))!;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("isMarketError — nhận theo hình dạng (singleton globalThis qua nhiều bundle)", () => {
  it("instance thật, object cùng hình dạng từ 'bundle khác' ⇒ true; lỗi thường / mã lạ ⇒ false", () => {
    expect(isMarketError(new MarketError("not_found"))).toBe(true);
    const fromOtherBundle = Object.assign(new Error("not_found"), { name: "MarketError", code: "not_found", productIds: [] });
    expect(isMarketError(fromOtherBundle)).toBe(true);
    expect(marketErrorStatus(fromOtherBundle as unknown as MarketError)).toBe(404);
    expect(isMarketError(Object.assign(new Error("x"), { name: "MarketError", code: "khong_co" }))).toBe(false);
    expect(isMarketError(new Error("not_found"))).toBe(false);
    expect(isMarketError(null)).toBe(false);
  });
});

describe("khởi tạo + ghi an toàn", () => {
  it("seed lần đầu sinh file JSON hợp lệ; không để lại .tmp", () => {
    const raw = readFileSync(path.join(dir, DEV_FILE_NAME), "utf8");
    expect(JSON.parse(raw).version).toBe(1);
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
  it("assertDevFileMode: sai điều kiện ⇒ ném ngay lúc tạo", () => {
    vi.stubEnv("VERCEL", "1");
    expect(() => createFileStore({ dir })).toThrow(/file-store/);
    vi.stubEnv("VERCEL", "");
  });
  it("JSON hỏng ⇒ unavailable, KHÔNG đè file", async () => {
    const d2 = mkdtempSync(path.join(os.tmpdir(), "sdfish-market-bad-"));
    writeFileSync(path.join(d2, DEV_FILE_NAME), "{hỏng", "utf8");
    const bad = createFileStore({ dir: d2 });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expectCode(bad.getShop("x"), "unavailable");
    quiet.mockRestore();
    expect(readFileSync(path.join(d2, DEV_FILE_NAME), "utf8")).toBe("{hỏng");
    rmSync(d2, { recursive: true, force: true });
  });
});

describe("listProducts / getProduct / getProductsByIds", () => {
  it("buyer mặc định: dang_ban|het_hang, !adminHidden, !deleted, shop hoat_dong ⇒ 23 món (có 1 món liên hệ báo giá); shop paused vẫn hiện", async () => {
    const page = await store.listProducts({ pageSize: 50 });
    expect(page.total).toBe(23);
    expect(page.items).toHaveLength(23);
    for (const p of page.items) {
      expect(["dang_ban", "het_hang"]).toContain(p.status);
      expect(p.adminHidden).toBe(false);
      expect(p.deletedAt).toBeUndefined();
      expect(p.shopName).toBeTruthy();
      expect(p.shopSlug).toBeTruthy();
    }
    expect(page.items.some((p) => p.status === "het_hang")).toBe(true);
  });
  it("includeHidden: có an + adminHidden, vẫn không deleted", async () => {
    const page = await store.listProducts({ includeHidden: true, pageSize: 50 });
    expect(page.total).toBe(25);
    expect(page.items.some((p) => p.adminHidden)).toBe(true);
    expect(page.items.some((p) => p.status === "an")).toBe(true);
    expect(page.items.some((p) => p.deletedAt)).toBe(false);
  });
  it("q so foldVn; province lọc shop; category; sort; pageSize trần 50", async () => {
    const q = await store.listProducts({ q: "ĐÁ CÂY" });
    expect(q.items.map((p) => p.title)).toEqual(["Đá cây 50kg"]);
    const prov = await store.listProducts({ province: "gia lai", pageSize: 50 });
    expect(prov.items.every((p) => p.shopProvince === "Gia Lai")).toBe(true);
    expect(prov.total).toBeGreaterThan(0);
    const cat = await store.listProducts({ category: "an-toan" });
    expect(cat.items.every((p) => p.category === "an-toan")).toBe(true);
    expect(cat.total).toBe(3);
    const bc = await store.listProducts({ sort: "ban_chay", pageSize: 3 });
    expect(bc.items.map((p) => p.soldCount)).toEqual([120, 110, 100]);
    const gt = await store.listProducts({ sort: "gia_tang", pageSize: 50 });
    /*  Món LIÊN HỆ BÁO GIÁ (priceVnd null) phải nằm CUỐI, phần có giá thì tăng
        dần — hai adapter phải cùng luật (ADR 0014). */
    const gtPrices = gt.items.map((p) => p.priceVnd);
    const firstNull = gtPrices.findIndex((v) => v == null);
    if (firstNull >= 0) expect(gtPrices.slice(firstNull).every((v) => v == null)).toBe(true);
    for (let i = 1; i < gtPrices.length; i++) {
      const before = gtPrices[i - 1];
      const now = gtPrices[i];
      if (before != null && now != null) expect(now).toBeGreaterThanOrEqual(before);
    }
    const gg = await store.listProducts({ sort: "gia_giam", pageSize: 2 });
    expect(gg.items[0].priceVnd).toBe(185_000_000);
    const big = await store.listProducts({ pageSize: 999 });
    expect(big.pageSize).toBe(50);
    const p2 = await store.listProducts({ pageSize: 10, page: 3 });
    expect(p2.items).toHaveLength(3);   // 23 món ⇒ trang 3 còn 3
    expect(p2.page).toBe(3);
    const shopOnly = await store.listProducts({ shopId: haidang.id, pageSize: 50 });
    expect(shopOnly.items.every((p) => p.shopId === haidang.id)).toBe(true);
  });
  it("getProduct: deleted ⇒ null; adminHidden ⇒ trả kèm cờ; getProductsByIds trả an/het_hang/hidden, không deleted", async () => {
    const del = await byTitle("Bạt cũ thanh lý");
    const hid = await byTitle("Lưới kéo mắt nhỏ 2a=10mm");
    const an = await byTitle("Mì gói thùng 30 gói");
    const het = await byTitle("Bộ đàm hàng hải Icom IC-M25");
    expect(await store.getProduct(del.id)).toBeNull();
    expect((await store.getProduct(hid.id))?.adminHidden).toBe(true);
    expect((await store.getProduct(hid.id))?.adminHiddenReason).toBe("Ngư cụ cấm");
    const many = await store.getProductsByIds([del.id, hid.id, an.id, het.id, "khong-co"]);
    expect(many.map((p) => p.id).sort()).toEqual([hid.id, an.id, het.id].sort());
  });
});

describe("shop", () => {
  it("getShopByOwner / createShop: owner trùng ⇒ invalid; slug trùng ⇒ slug_taken; tạo mới cho_duyet", async () => {
    expect((await store.getShopByOwner("0902000001"))?.slug).toBe("sdvico");
    expect(await store.getShopByOwner("0901000003")).toBeNull();
    const draft = { name: "Đại lý Cô Năm", province: "Khánh Hòa", shippingFlatVnd: 0 };
    await expectCode(store.createShop("0902000001", draft, "dai-ly-co-nam"), "invalid");
    await expectCode(store.createShop("0901000003", { ...draft, name: "SDVICO" }, "sdvico"), "slug_taken");
    const s = await store.createShop("0901000003", draft, "dai-ly-co-nam");
    expect(s.status).toBe("cho_duyet");
    expect(s.ownerPhone).toBe("0901000003");
    expect(s.phone).toBe("0901000003");
    expect(s.approvedAt).toBeUndefined();
  });
  it("setShopStatus hoat_dong lần đầu ⇒ approvedAt; updateShop paused/slug; setShopOwner trùng ⇒ invalid; listShops lọc status", async () => {
    const s = (await store.getShopByOwner("0901000003"))!;
    const ok = await store.setShopStatus(s.id, "hoat_dong", null);
    expect(ok.approvedAt).toBe(NOW.toISOString());
    const locked = await store.setShopStatus(s.id, "tam_khoa", "Thiếu giấy phép");
    expect(locked.statusNote).toBe("Thiếu giấy phép");
    expect(locked.approvedAt).toBe(NOW.toISOString());
    const up = await store.updateShop(s.id, { paused: true, name: "Đại lý Năm" }, "dai-ly-nam");
    expect(up.paused).toBe(true);
    expect(up.slug).toBe("dai-ly-nam");
    await expectCode(store.updateShop(s.id, { name: "SDVICO" }, "sdvico"), "slug_taken");
    await expectCode(store.updateShop("khong-co", {}), "not_found");
    await expectCode(store.setShopOwner(s.id, "0902000002"), "invalid");
    expect((await store.setShopOwner(s.id, "0901000002")).ownerPhone).toBe("0901000002");
    expect((await store.listShops({ status: "hoat_dong" })).items.map((x) => x.slug).sort()).toEqual(["dai-ly-hai-dang", "sdvico"]);
    expect((await store.listShops({})).total).toBe(4);
    expect((await store.listProducts({ shopId: phuongnam.id })).total).toBe(0);
  });
});

describe("sản phẩm (người bán)", () => {
  it("createProduct/updateProduct normalize status, bỏ qua adminHidden; deleteProduct 2 lần ⇒ not_found; ẩn khỏi list/byIds", async () => {
    const draft = { title: "Máy bơm tay", category: "phu-tung" as const, priceVnd: 120000, unit: "cái", stock: 0, images: [], variants: [], status: "dang_ban" as const };
    const p = await store.createProduct(sdvico.id, draft, "may bom tay");
    expect(p.status).toBe("het_hang");
    const up = await store.updateProduct(sdvico.id, p.id, { stock: 4, adminHidden: true } as never, "may bom tay moi");
    expect(up.status).toBe("dang_ban");
    expect(up.adminHidden).toBe(false);
    expect((await store.listShopProducts(sdvico.id, { q: "bom tay" })).items.map((x) => x.id)).toEqual([p.id]);
    await expectCode(store.updateProduct(haidang.id, p.id, { stock: 1 }), "not_found");
    await store.deleteProduct(sdvico.id, p.id);
    await expectCode(store.deleteProduct(sdvico.id, p.id), "not_found");
    expect(await store.getProduct(p.id)).toBeNull();
    expect(await store.getProductsByIds([p.id])).toEqual([]);
    expect((await store.listShopProducts(sdvico.id, { q: "bom tay" })).total).toBe(0);
    await expectCode(store.createProduct("khong-co", draft, ""), "not_found");
  });
  it("setProductAdminHidden đặt 2 trường; listShopProducts (seller) thấy adminHidden", async () => {
    const p = await byTitle("Phao tròn cứu sinh");
    const h = await store.setProductAdminHidden(p.id, true, "Hàng giả");
    expect(h.adminHidden).toBe(true);
    expect(h.adminHiddenReason).toBe("Hàng giả");
    expect((await store.listProducts({ q: "phao tron" })).total).toBe(0);
    expect((await store.listShopProducts(sdvico.id, { q: "phao tron" })).items[0].adminHidden).toBe(true);
    const u = await store.setProductAdminHidden(p.id, false, null);
    expect(u.adminHidden).toBe(false);
    expect(u.adminHiddenReason).toBeUndefined();
  });
  it("listShopProducts ?status: dang_ban|an|het_hang KHÔNG kèm món bị gỡ · bi_go = món bị gỡ · all/bỏ trống = tất cả", async () => {
    const base = { category: "phu-tung" as const, priceVnd: 90000, unit: "cái", images: [], variants: [], compareAtVnd: undefined };
    const mk = async (title: string, stock: number, status: "dang_ban" | "an") =>
      store.createProduct(phuongnam.id, { ...base, title, stock, status }, `loctrangthai ${foldVn(title)}`);
    const ban = await mk("Ốc siết A", 5, "dang_ban");
    const an = await mk("Ốc siết B", 5, "an");
    const het = await mk("Ốc siết C", 0, "dang_ban");        // normalize ⇒ het_hang
    const go = await mk("Ốc siết D", 5, "dang_ban");
    await store.setProductAdminHidden(go.id, true, "Hàng giả");
    expect(het.status).toBe("het_hang");

    const ids = async (status?: ProductStatusFilter) =>
      (await store.listShopProducts(phuongnam.id, { q: "loctrangthai", pageSize: 50, ...(status ? { status } : {}) }))
        .items.map((x) => x.id).sort();
    expect(await ids("dang_ban")).toEqual([ban.id].sort());
    expect(await ids("an")).toEqual([an.id].sort());
    expect(await ids("het_hang")).toEqual([het.id].sort());
    expect(await ids("bi_go")).toEqual([go.id].sort());
    expect(await ids("all")).toEqual([ban.id, an.id, het.id, go.id].sort());
    expect(await ids()).toEqual([ban.id, an.id, het.id, go.id].sort());
    // chợ KHÔNG đọc `status` — vẫn là danh sách công khai (shop chờ duyệt ⇒ rỗng)
    expect((await store.listProducts({ q: "loctrangthai", status: "an", pageSize: 50 })).total).toBe(0);
    for (const p2 of [ban, an, het, go]) await store.deleteProduct(phuongnam.id, p2.id);
  });
});

describe("placeOrders — nguyên tử trong shop, độc lập giữa shop", () => {
  it("2 shop: một ok + một line_unavailable (đúng id, available); kho/soldCount đổi đúng; bankSnapshot khi CK", async () => {
    const da = await byTitle("Đá cây 50kg");
    const loc = await byTitle("Lọc dầu diesel máy tàu"); // stock 2
    const bugi = await byTitle("Bugi máy tàu NGK");
    // (a) CK riêng Hải Đăng (có STK) ⇒ bankSnapshot ghi vào đơn
    const ck = await store.placeOrders("0901000001", [prepared(haidang, [da], [{ productId: da.id, qty: 10 }], "m1-test-hd-1")], { ...common, paymentMethod: "chuyen_khoan", buyerNote: "Giao sáng" });
    expect(ck[0].ok).toBe(true);
    if (ck[0].ok) {
      expect(ck[0].duplicate).toBe(false);
      expect(ck[0].order.status).toBe("cho_xac_nhan");
      expect(ck[0].order.paymentMethod).toBe("chuyen_khoan");
      expect(ck[0].order.bankSnapshot?.bankAccount).toBe(haidang.bankAccount);
      expect(ck[0].order.timeline).toEqual([{ status: "cho_xac_nhan", at: NOW.toISOString(), by: "buyer" }]);
      expect(ck[0].order.shopName).toBe(haidang.name);
      expect(ck[0].order.buyerNote).toBe("Giao sáng");
      expect(ck[0].order.code).toMatch(/^SD260906[A-HJ-NP-Z2-9]{4}$/);
    }
    // (b) COD 2 shop: Hải Đăng ok, SDVICO thiếu hàng (lọc dầu 5 > 2) ⇒ độc lập
    const preHd = prepared(haidang, [da], [{ productId: da.id, qty: 5 }], "m1-test-hd-2");
    const { lines } = buildMarketLines([{ productId: bugi.id, qty: 4 }], [bugi], sdvico);
    const locPrice = loc.priceVnd;
    if (locPrice == null) throw new Error("seed: món lọc dầu phải có giá");
    const badLine = { productId: loc.id, title: loc.title, unit: loc.unit, priceVnd: locPrice, qty: 5, lineTotalVnd: locPrice * 5 };
    const preSd: PreparedShopOrder = { shopId: sdvico.id, clientRef: "m1-test-sd-1", lines: [...lines, badLine], ...computeTotals([...lines, badLine], sdvico) };
    const res = await store.placeOrders("0901000001", [preHd, preSd], common);
    expect(res.map((r) => r.shopId)).toEqual([haidang.id, sdvico.id]);
    expect(res[0]).toMatchObject({ ok: true, duplicate: false });
    if (res[0].ok) expect(res[0].order.bankSnapshot).toBeUndefined();
    expect(res[1]).toMatchObject({ ok: false, code: "line_unavailable", productIds: [loc.id], available: { [loc.id]: 2 } });
    const da2 = await byTitle("Đá cây 50kg");
    expect(da2.stock).toBe(da.stock - 15);
    expect(da2.soldCount).toBe(da.soldCount + 15);
    expect((await byTitle("Bugi máy tàu NGK")).stock).toBe(bugi.stock); // shop lỗi KHÔNG đụng kho
  });
  it("client_ref trùng ⇒ duplicate:true, KHÔNG trừ kho lần 2", async () => {
    const da = await byTitle("Đá cây 50kg");
    const pre = prepared(haidang, [da], [{ productId: da.id, qty: 10 }], "m1-test-hd-1");
    const res = await store.placeOrders("0901000001", [pre], common);
    expect(res[0]).toMatchObject({ ok: true, duplicate: true });
    expect((await byTitle("Đá cây 50kg")).stock).toBe(da.stock);
    // cùng client_ref nhưng buyer khác ⇒ đơn mới
    const res2 = await store.placeOrders("0901000002", [pre], common);
    expect(res2[0]).toMatchObject({ ok: true, duplicate: false });
    expect((await byTitle("Đá cây 50kg")).stock).toBe(da.stock - 10);
  });
  it("shop paused ⇒ shop_paused; shop ≠ hoat_dong ⇒ shop_not_active; sai giá ⇒ line_unavailable; CK shop không STK ⇒ shop_not_active", async () => {
    const da = await byTitle("Đá cây 50kg");
    await store.updateShop(haidang.id, { paused: true });
    const r1 = await store.placeOrders("0901000001", [prepared(haidang, [da], [{ productId: da.id, qty: 1 }], "m1-p1")], common);
    expect(r1[0]).toMatchObject({ ok: false, code: "shop_paused" });
    await store.updateShop(haidang.id, { paused: false });
    const r2 = await store.placeOrders("0901000001", [{ shopId: phuongnam.id, clientRef: "m1-p2", lines: [], subtotalVnd: 0, shippingVnd: 0, totalVnd: 0 }], common);
    expect(r2[0]).toMatchObject({ ok: false, code: "shop_not_active" });
    const pre = prepared(haidang, [da], [{ productId: da.id, qty: 1 }], "m1-p3");
    pre.lines[0].priceVnd = 1;
    const r3 = await store.placeOrders("0901000001", [pre], common);
    expect(r3[0]).toMatchObject({ ok: false, code: "line_unavailable", productIds: [da.id] });
    const ao = await byTitle("Áo phao cứu sinh");
    const r4 = await store.placeOrders("0901000001", [prepared(sdvico, [ao], [{ productId: ao.id, qty: 1 }], "m1-p4")], { ...common, paymentMethod: "chuyen_khoan" });
    expect(r4[0]).toMatchObject({ ok: false, code: "shop_not_active" });
    expect((await byTitle("Đá cây 50kg")).stock).toBe(da.stock);
  });
  it("ghi chú THEO SHOP: prepared.buyerNote thắng ghi chú chung; thiếu thì rơi về chung (11 §5.6)", async () => {
    const da = await byTitle("Đá cây 50kg");
    const bugi = await byTitle("Bugi máy tàu NGK");
    const preHd = prepared(haidang, [da], [{ productId: da.id, qty: 1 }], "m1-note-hd");
    preHd.buyerNote = "Giao trước 6h sáng";
    const preSd = prepared(sdvico, [bugi], [{ productId: bugi.id, qty: 1 }], "m1-note-sd"); // KHÔNG có ghi chú riêng
    const res = await store.placeOrders("0901000001", [preHd, preSd], { ...common, buyerNote: "Gọi trước khi tới" });
    expect(res.every((r) => r.ok)).toBe(true);
    if (res[0].ok) expect(res[0].order.buyerNote).toBe("Giao trước 6h sáng");
    if (res[1].ok) expect(res[1].order.buyerNote).toBe("Gọi trước khi tới");
  });
  it("biến thể: giá riêng khớp ⇒ ok; nhãn lạ ⇒ line_unavailable", async () => {
    const led = await byTitle("Đèn LED pha tàu cá");
    const ok = await store.placeOrders("0901000001", [prepared(sdvico, [led], [{ productId: led.id, qty: 2, variantLabel: "100W" }], "m1-led-1")], common);
    expect(ok[0].ok).toBe(true);
    if (ok[0].ok) expect(ok[0].order.items[0]).toMatchObject({ variantLabel: "100W", priceVnd: 1_450_000, lineTotalVnd: 2_900_000 });
    const bad: PreparedShopOrder = { shopId: sdvico.id, clientRef: "m1-led-2", lines: [{ productId: led.id, variantLabel: "999W", title: led.title, unit: led.unit, priceVnd: 850000, qty: 1, lineTotalVnd: 850000 }], subtotalVnd: 850000, shippingVnd: 0, totalVnd: 850000 };
    expect((await store.placeOrders("0901000001", [bad], common))[0]).toMatchObject({ ok: false, code: "line_unavailable" });
  });
  it("CA ĐUA: 2 lệnh đặt song song cùng món còn 1 ⇒ đúng 1 thành công, kho về 0, status het_hang", async () => {
    const loc = await byTitle("Lọc dầu diesel máy tàu");
    await store.updateProduct(sdvico.id, loc.id, { stock: 1 });
    const fresh = await byTitle("Lọc dầu diesel máy tàu");
    const mk = (ref: string) => prepared(sdvico, [fresh], [{ productId: fresh.id, qty: 1 }], ref);
    const [a, b] = await Promise.all([
      store.placeOrders("0901000001", [mk("m1-race-a")], common),
      store.placeOrders("0901000002", [mk("m1-race-b")], common),
    ]);
    const oks = [a[0], b[0]].filter((r) => r.ok);
    const fails = [a[0], b[0]].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(fails[0]).toMatchObject({ ok: false, code: "line_unavailable", available: { [fresh.id]: 0 } });
    const after = await byTitle("Lọc dầu diesel máy tàu");
    expect(after.stock).toBe(0);
    expect(after.status).toBe("het_hang");
  });
  it("mã đơn không trùng qua nhiều đơn", async () => {
    const s = await store.readState();
    expect(new Set(s.orders.map((o) => o.code)).size).toBe(s.orders.length);
  });
});

describe("đơn: đọc + transitionOrder", () => {
  it("listBuyerOrders/listShopOrders/listAllOrders lọc đúng + shopName đính kèm; getOrderByClientRef", async () => {
    const mine = await store.listBuyerOrders("0901000001", { pageSize: 50 });
    expect(mine.items.every((o) => o.buyerPhone === "0901000001")).toBe(true);
    expect(mine.items.every((o) => !!o.shopName && !!o.shopPhone)).toBe(true);
    for (let i = 1; i < mine.items.length; i++) expect(mine.items[i].createdAt <= mine.items[i - 1].createdAt).toBe(true);
    const shopO = await store.listShopOrders(haidang.id, { status: "cho_xac_nhan" });
    expect(shopO.items.every((o) => o.shopId === haidang.id && o.status === "cho_xac_nhan")).toBe(true);
    const byCode = await store.listAllOrders({ code: "sd260906k7pq" });
    expect(byCode.items).toHaveLength(1);
    expect((await store.listAllOrders({ buyerPhone: "0901000002" })).items.every((o) => o.buyerPhone === "0901000002")).toBe(true);
    const ref = await store.getOrderByClientRef("0901000001", "m1-test-hd-1");
    expect(ref?.clientRef).toBe("m1-test-hd-1");
    expect(await store.getOrderByClientRef("0901000009", "m1-test-hd-1")).toBeNull();
    expect(await store.getOrder("khong-co")).toBeNull();
  });
  it("expectStatus lệch ⇒ bad_transition; ghi vá + timelineAppend nối cuối + needsRefund", async () => {
    const o = (await store.listAllOrders({ code: "SD260906K7PQ" })).items[0]; // cho_xac_nhan CK bao_da_chuyen
    await expectCode(store.transitionOrder(o.id, "da_xac_nhan", { status: "dang_giao" }), "bad_transition");
    await expectCode(store.transitionOrder("khong-co", "cho_xac_nhan", {}), "not_found");
    const noted = await store.transitionOrder(o.id, "cho_xac_nhan", { sellerNote: "Gọi trước khi giao" });
    expect(noted.sellerNote).toBe("Gọi trước khi giao");
    expect(noted.status).toBe("cho_xac_nhan");
    const t = await store.transitionOrder(o.id, "cho_xac_nhan", {
      status: "da_huy", cancelBy: "seller", cancelReason: "Hết hàng", needsRefund: true,
      timelineAppend: { status: "da_huy", at: NOW.toISOString(), by: "seller", note: "Hết hàng" },
    });
    expect(t.status).toBe("da_huy");
    expect(t.needsRefund).toBe(true);
    expect(t.timeline.at(-1)).toEqual({ status: "da_huy", at: NOW.toISOString(), by: "seller", note: "Hết hàng" });
    expect(t.timeline).toHaveLength(o.timeline.length + 1);
  });
  it("da_huy ⇒ hoàn kho + trừ soldCount ĐÚNG 1 LẦN (idempotent); het_hang ⇒ dang_ban", async () => {
    const loc = await byTitle("Lọc dầu diesel máy tàu"); // stock 0 het_hang sau ca đua
    const s = await store.readState();
    const raceOrder = s.orders.find((o) => o.items.some((l) => l.productId === loc.id) && o.status === "cho_xac_nhan" && o.clientRef?.startsWith("m1-race"))!;
    const c1 = await store.transitionOrder(raceOrder.id, "cho_xac_nhan", { status: "da_huy", cancelBy: "buyer" });
    expect(c1.status).toBe("da_huy");
    const after1 = await byTitle("Lọc dầu diesel máy tàu");
    expect(after1.stock).toBe(1);
    expect(after1.status).toBe("dang_ban");
    expect(after1.soldCount).toBe(loc.soldCount - 1);
    // gọi lại đường "vá" trên đơn đã da_huy với expect da_huy ⇒ KHÔNG hoàn kho lần 2
    await store.transitionOrder(raceOrder.id, "da_huy", { sellerNote: "đã huỷ" });
    const after2 = await byTitle("Lọc dầu diesel máy tàu");
    expect(after2.stock).toBe(1);
    expect(after2.soldCount).toBe(after1.soldCount);
  });
  it("listOverdueDelivered: chỉ da_giao có deliveredAt ≤ mốc; settleOverdue trên đơn seed 9 ngày ⇒ hoan_thanh + COD da_thanh_toan", async () => {
    const before = new Date(NOW.getTime() - 7 * 86400000).toISOString();
    const due = await store.listOverdueDelivered(before);
    expect(due).toHaveLength(1);
    expect(due[0].status).toBe("da_giao");
    expect(await store.listOverdueDelivered(before, sdvico.id)).toEqual([]);
    const patch = settleOverdue(due[0], NOW.toISOString())!;
    const done = await store.transitionOrder(due[0].id, "da_giao", patch);
    expect(done.status).toBe("hoan_thanh");
    expect(done.paymentStatus).toBe("da_thanh_toan");
    expect(done.completedAt).toBe(new Date(Date.parse(due[0].deliveredAt!) + 7 * 86400000).toISOString());
    expect(done.timeline.at(-1)?.by).toBe("system");
    expect(await store.listOverdueDelivered(before)).toEqual([]);
  });
});

describe("đánh giá", () => {
  let done: Order;
  it("addReview: không phải đơn hoan_thanh/của buyer/món không có ⇒ review_not_allowed; trùng ⇒ already_reviewed; điểm cập nhật cả sản phẩm + shop", async () => {
    done = (await store.listBuyerOrders("0901000001", { status: "hoan_thanh", pageSize: 50 })).items.find((o) => o.shopId === haidang.id)!;
    expect(done).toBeTruthy();
    const thung = done.items[0].productId;
    await expectCode(store.addReview({ orderId: done.id, productId: thung, buyerPhone: "0901000002", rating: 5 }), "review_not_allowed");
    await expectCode(store.addReview({ orderId: done.id, productId: "khong-co", buyerPhone: "0901000001", rating: 5 }), "review_not_allowed");
    const pending = (await store.listBuyerOrders("0901000001", { status: "cho_xac_nhan" })).items[0];
    await expectCode(store.addReview({ orderId: pending.id, productId: pending.items[0].productId, buyerPhone: "0901000001", rating: 5 }), "review_not_allowed");
    const r = await store.addReview({ orderId: done.id, productId: thung, buyerPhone: "0901000001", rating: 4, comment: "Tốt" });
    expect(r.buyerPhoneMasked).toBe("0901***001");
    expect(r.hidden).toBe(false);
    await expectCode(store.addReview({ orderId: done.id, productId: thung, buyerPhone: "0901000001", rating: 1 }), "already_reviewed");
    const p = await store.getProduct(thung);
    expect(p?.ratingAvg).toBe(4);
    expect(p?.ratingCount).toBe(1);
    const hd = await store.getShop(haidang.id);
    expect(hd?.ratingAvg).toBe(4);
    expect(hd?.ratingCount).toBe(1);
    expect(await store.reviewedProductIds(done.id)).toEqual([thung]);
  });
  it("setReviewHidden: ẩn 1 trong 2 (4★/2★) ⇒ avg = điểm còn lại, count 1 — cả sản phẩm lẫn shop; listReviews mặc định không có hidden", async () => {
    const nuoc = done.items[1].productId;
    const r2 = await store.addReview({ orderId: done.id, productId: nuoc, buyerPhone: "0901000001", rating: 2 });
    expect((await store.getShop(haidang.id))?.ratingAvg).toBe(3);
    const hidden = await store.setReviewHidden(r2.id, true);
    expect(hidden.hidden).toBe(true);
    expect((await store.getProduct(nuoc))?.ratingAvg).toBe(0);
    expect((await store.getProduct(nuoc))?.ratingCount).toBe(0);
    const hd = await store.getShop(haidang.id);
    expect(hd?.ratingAvg).toBe(4);
    expect(hd?.ratingCount).toBe(1);
    expect((await store.listReviews({ productId: nuoc })).total).toBe(0);
    const withHidden = await store.listReviews({ productId: nuoc, includeHidden: true });
    expect(withHidden.total).toBe(1);
    expect(withHidden.items[0].hidden).toBe(true);
    await expectCode(store.setReviewHidden("khong-co", true), "not_found");
    // seed: 4★ + ẩn ⇒ shop SDVICO avg 4.5 count 2 (đã kiểm ở dev-seed); bỏ ẩn r2 ⇒ shop HĐ (4+2)/2
    await store.setReviewHidden(r2.id, false);
    expect((await store.getShop(haidang.id))?.ratingAvg).toBe(3);
  });
});

describe("thống kê + ảnh + dev", () => {
  it("stats 30d của Hải Đăng: có completed (đơn tự hoàn thành) + byStatus; overview đếm shop/món", async () => {
    const st = await store.stats(haidang.id, "30d");
    expect(st.range).toBe("30d");
    expect(st.completed).toBeGreaterThanOrEqual(1);
    expect(st.revenueVnd).toBeGreaterThan(0);
    expect(st.topProducts.length).toBeGreaterThan(0);
    expect(Object.values(st.byStatus).reduce((a, b) => a + b, 0)).toBe((await store.listShopOrders(haidang.id, { pageSize: 50 })).total);
    expect(st.pendingOrders).toBe(st.byStatus.cho_xac_nhan);
    const today = await store.stats(sdvico.id, "today");
    expect(today.orders).toBeGreaterThan(0);
    const ov = await store.overview();
    expect(ov.shops.hoat_dong).toBe(2);
    expect(ov.shops.cho_duyet).toBe(1);
    expect(ov.shops.tam_khoa).toBe(1);
    expect(ov.productsOnSale).toBeGreaterThan(10);
    expect(ov.cancelRate30d).toBeGreaterThanOrEqual(0);
    expect(ov.cancelRate30d).toBeLessThanOrEqual(1);
  });
  it("saveUpload: > 500 KB ⇒ bad_size; ok ⇒ url /api/dev/uploads/<tên>.<ext theo mime>", async () => {
    await expectCode(store.saveUpload(sdvico.id, new Uint8Array(500 * 1024 + 1), "image/jpeg"), "bad_size");
    const { url } = await store.saveUpload(sdvico.id, new Uint8Array([0xff, 0xd8, 0xff, 0]), "image/jpeg");
    expect(url).toMatch(new RegExp(`^/api/dev/uploads/${sdvico.id}-[0-9a-f-]+\\.jpg$`));
    const name = url.slice("/api/dev/uploads/".length);
    expect(readdirSync(path.join(dir, "market-uploads"))).toContain(name);
    const { url: png } = await store.saveUpload(sdvico.id, new Uint8Array([1]), "image/png");
    expect(png.endsWith(".png")).toBe(true);
  });
  it("devLogin cấp chuỗi đúng khuôn sdf_ + 43; devIdentity tra được; persona lạ ⇒ not_found; notifications", async () => {
    const { token, persona } = await store.devLogin("+84 901 000 001");
    expect(token).toMatch(/^sdf_[A-Za-z0-9_-]{43}$/);
    expect(persona.name).toBe("Anh Ba (mua)");
    expect((await store.devIdentity(token))?.phone).toBe("0901000001");
    expect(await store.devIdentity("sdf_khong-co")).toBeNull();
    await expectCode(store.devLogin("0999999999"), "not_found");
    expect((await store.devPersonas()).map((p) => p.role)).toContain("admin");
    await store.devPushNotification("0902000002", { title: "Thử", body: "x", pushOs: false });
    const n = await store.devNotifications("0902000002");
    expect(n[0]).toMatchObject({ title: "Thử", body: "x", pushOs: false });
    const raw = JSON.parse(readFileSync(path.join(dir, DEV_FILE_NAME), "utf8"));
    expect(raw.sessions[token].phone).toBe("0901000001");
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});

describe("yêu cầu đặt hàng — kho file (2026-10-18)", () => {
  it("gửi → báo giá → đồng ý ⇒ đơn đã xác nhận ở shop chủ sàn chọn, kho món không đổi", async () => {
    const { applyAccept, applyQuote, requestToOrder } = await import("@/lib/market/request-state");
    const before = (await store.readState()).products.reduce((t, p) => t + p.stock, 0);
    const r = await store.createRequest("0901000003", { title: "Lưới rê 3 phân", qty: 5, unit: "tấm", address: addr, paymentMethod: "cod" });
    expect(r.code).toMatch(/^YC\d{6}/);
    expect((await store.listBuyerRequests("0901000003")).items.map((x) => x.id)).toContain(r.id);
    expect((await store.listAllRequests({ status: "moi" })).items.some((x) => x.id === r.id)).toBe(true);
    const nowIso = NOW.toISOString();
    const quoted = await store.patchRequest(r.id, "moi", applyQuote(r, { goodsVnd: 2_500_000, shippingVnd: 0, etaFrom: "2026-09-08", etaTo: "2026-09-09" }, haidang.id, nowIso)!);
    expect(quoted.quoteShopName).toBe(haidang.name);
    await expectCode(store.patchRequest(r.id, "moi", { status: "da_huy" }), "bad_transition");
    const out = await store.acceptRequest(r.id, applyAccept(quoted, nowIso)!, requestToOrder(quoted, nowIso)!);
    expect(out.order.status).toBe("da_xac_nhan");
    expect(out.order.shopId).toBe(haidang.id);
    expect(out.order.etaTo).toBe("2026-09-09");
    expect(out.order.requestId).toBe(r.id);
    expect(out.request.status).toBe("da_dat");
    expect(out.request.orderId).toBe(out.order.id);
    // huỷ đơn sinh từ yêu cầu: hoàn kho không đụng món nào
    await store.transitionOrder(out.order.id, "da_xac_nhan", { status: "da_huy", cancelBy: "seller", cancelReason: "thử" });
    expect((await store.readState()).products.reduce((t, p) => t + p.stock, 0)).toBe(before);
  });
  it("quét đơn chờ quá hạn theo createdAt", async () => {
    const list = await store.listOverduePending("2100-01-01T00:00:00.000Z");
    expect(list.every((o) => o.status === "cho_xac_nhan")).toBe(true);
    expect(await store.listOverduePending("2000-01-01T00:00:00.000Z")).toEqual([]);
  });
});

