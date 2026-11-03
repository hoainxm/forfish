// ĐẠI LÝ TỰ BÁO GIÁ (17 §12.5) + bộ lọc "Sắp hết" — luật thuần dùng chung route/màn.
import { describe, expect, it } from "vitest";
import { isLowStock, LOW_STOCK_MAX } from "@/lib/market/pricing";
import { applyQuote, canRequestTransition, REQUEST_IDLE_MS } from "@/lib/market/request-state";
import {
  openRequestsSince, SELLER_QUOTE_BLOCK_TEXT, sellerQuoteBlock, sellerQuoteConflict, toSellerRequestView,
} from "@/lib/market/seller-requests";
import type { MarketRequest } from "@/lib/market/types";
import { readQuoteBody } from "@/lib/market/validate";

const TODAY = "2026-11-03";
const NOW_ISO = "2026-11-03T03:00:00.000Z";
const NOW = Date.parse(NOW_ISO);
const addr = { name: "Nguyễn Văn Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true };

function req(p: Partial<MarketRequest> = {}): MarketRequest {
  return {
    id: "11111111-1111-4111-8111-111111111111", code: "YC261103ABCD", buyerPhone: "0901000001",
    title: "Chân vịt inox 3 cánh 18 inch", qty: 2, unit: "cái", images: ["https://x/a.jpg"], address: addr, paymentMethod: "cod",
    description: "loại 18 inch", needBy: "2026-11-10",
    status: "moi", timeline: [{ status: "moi", at: "2026-11-02T01:00:00.000Z", by: "buyer" }],
    createdAt: "2026-11-02T01:00:00.000Z", updatedAt: "2026-11-02T01:00:00.000Z", ...p,
  };
}
const quote = { goodsVnd: 3_000_000, shippingVnd: 50_000, etaFrom: "2026-11-05", etaTo: "2026-11-06" };

describe("readQuoteBody — một hàm cho chủ sàn và đại lý", () => {
  it("đọc đủ: chip hẹn giao, tiền dạng chuỗi số, phí giao trống = 0, lời dặn trim", () => {
    const r = readQuoteBody({ goodsVnd: "2500000", etaPreset: "ngay_mai", note: "  hàng Đài Loan " }, "shop-1", TODAY);
    expect(r).toEqual({ ok: true, quote: { goodsVnd: 2_500_000, shippingVnd: 0, etaFrom: "2026-11-04", etaTo: "2026-11-04", note: "hàng Đài Loan" } });
  });
  it("khoảng ngày tay: etaTo trống = etaFrom; lời dặn rỗng bỏ hẳn", () => {
    const r = readQuoteBody({ goodsVnd: 10_000, shippingVnd: 0, etaFrom: "2026-11-05", note: "  " }, "s", TODAY);
    expect(r).toEqual({ ok: true, quote: { goodsVnd: 10_000, shippingVnd: 0, etaFrom: "2026-11-05", etaTo: "2026-11-05" } });
  });
  it("sai thì trả câu đời thường: thiếu shop, tiền ngoài khoảng, phí giao quá trần, ngày quá khứ, lời dặn dài", () => {
    expect(readQuoteBody({ goodsVnd: 10_000, etaPreset: "hom_nay" }, "", TODAY)).toEqual({ ok: false, message: "Chọn shop lo hàng." });
    expect(readQuoteBody({ goodsVnd: 500, etaPreset: "hom_nay" }, "s", TODAY)).toMatchObject({ ok: false, message: expect.stringMatching(/Tiền hàng/) });
    expect(readQuoteBody({ goodsVnd: "abc", etaPreset: "hom_nay" }, "s", TODAY)).toMatchObject({ ok: false });
    expect(readQuoteBody({ goodsVnd: 10_000, shippingVnd: 6_000_000, etaPreset: "hom_nay" }, "s", TODAY)).toMatchObject({ ok: false, message: expect.stringMatching(/Phí giao/) });
    expect(readQuoteBody({ goodsVnd: 10_000, etaFrom: "2026-11-01" }, "s", TODAY)).toMatchObject({ ok: false, message: expect.stringMatching(/trước hôm nay/) });
    expect(readQuoteBody({ goodsVnd: 10_000, etaPreset: "sai" }, "s", TODAY)).toEqual({ ok: false, message: "Chọn ngày giao hàng." });
    expect(readQuoteBody({ goodsVnd: 10_000, etaPreset: "hom_nay", note: "x".repeat(301) }, "s", TODAY)).toMatchObject({ ok: false, message: expect.stringMatching(/300/) });
  });
});

describe("applyQuote — đại lý chỉ báo giá yêu cầu còn mới", () => {
  it("đại lý báo giá `moi` ⇒ da_bao_gia, gắn shop, timeline ghi seller", () => {
    const p = applyQuote(req(), quote, "shop-hd", NOW_ISO, "0902000002", "seller")!;
    expect(p.status).toBe("da_bao_gia");
    expect(p.quoteShopId).toBe("shop-hd");
    expect(p.timelineAppend).toMatchObject({ status: "da_bao_gia", by: "seller" });
    expect(Date.parse(p.quote!.expiresAt) - NOW).toBe(3 * 24 * 3600 * 1000);
  });
  it("đại lý KHÔNG đè báo giá có sẵn, KHÔNG báo không tìm được; chủ sàn vẫn sửa giá được", () => {
    const quoted = req({ status: "da_bao_gia", quoteShopId: "shop-sdvico" });
    expect(applyQuote(quoted, quote, "shop-hd", NOW_ISO, undefined, "seller")).toBeNull();
    expect(applyQuote(req({ quoteShopId: "x" }), quote, "shop-hd", NOW_ISO, undefined, "seller")).toBeNull();
    expect(canRequestTransition("moi", "khong_tim_duoc", "seller")).toBe(false);
    expect(applyQuote(quoted, quote, "shop-sdvico", NOW_ISO, "0909")!.timelineAppend!.by).toBe("admin:0909");
  });
});

describe("đại lý thấy gì · ai báo giá được", () => {
  it("toSellerRequestView KHÔNG có SĐT, tên, địa chỉ chi tiết — chỉ tỉnh", () => {
    const v = toSellerRequestView(req({ status: "da_bao_gia", quoteShopId: "other", quote: { ...quote, quotedAt: NOW_ISO, expiresAt: NOW_ISO } }), "mine");
    const json = JSON.stringify(v);
    expect(json).not.toContain("0901000001");
    expect(json).not.toContain("Nguyễn Văn Ba");
    expect(json).not.toContain("Hòn Rớ");
    expect(v.province).toBe("Khánh Hòa");
    expect(v.mine).toBe(false);
    expect(v.quote).toBeUndefined(); // giá shop khác báo không lộ
  });
  it("báo giá của shop mình thì thấy giá + đơn", () => {
    const v = toSellerRequestView(req({ status: "da_dat", quoteShopId: "mine", orderId: "o1", quote: { ...quote, quotedAt: NOW_ISO, expiresAt: NOW_ISO } }), "mine");
    expect(v).toMatchObject({ mine: true, orderId: "o1", quote: { goodsVnd: 3_000_000 } });
  });
  it("sellerQuoteBlock: chỉ hoat_dong + không tạm nghỉ mới báo giá; mỗi lý do có câu", () => {
    expect(sellerQuoteBlock({ status: "hoat_dong", paused: false })).toBeNull();
    expect(sellerQuoteBlock({ status: "hoat_dong", paused: true })).toBe("tam_nghi");
    expect(sellerQuoteBlock({ status: "cho_duyet", paused: false })).toBe("cho_duyet");
    expect(sellerQuoteBlock({ status: "tu_choi", paused: true })).toBe("tu_choi");
    expect(sellerQuoteBlock({ status: "tam_khoa", paused: false })).toBe("tam_khoa");
    for (const t of Object.values(SELLER_QUOTE_BLOCK_TEXT)) expect(t.length).toBeGreaterThan(10);
  });
  it("sellerQuoteConflict: yêu cầu của chính mình · đã có báo giá · quá 7 ngày", () => {
    const shop = { ownerPhone: "0902000002" };
    expect(sellerQuoteConflict(req(), shop, NOW)).toBeNull();
    expect(sellerQuoteConflict(req({ buyerPhone: "0902000002" }), shop, NOW)).toBe("own_request");
    expect(sellerQuoteConflict(req({ status: "da_bao_gia", quoteShopId: "x" }), shop, NOW)).toBe("da_co_bao_gia");
    expect(sellerQuoteConflict(req({ status: "khong_tim_duoc" }), shop, NOW)).toBe("da_co_bao_gia");
    const old = new Date(NOW - REQUEST_IDLE_MS).toISOString();
    expect(sellerQuoteConflict(req({ createdAt: old }), shop, NOW)).toBe("da_co_bao_gia");
    expect(openRequestsSince(NOW)).toBe(old);
  });
});

describe("isLowStock — bộ lọc Sắp hết (?loc=sap-het)", () => {
  it("tồn ≤ 3 kể cả 0; trên 3 không tính", () => {
    expect(LOW_STOCK_MAX).toBe(3);
    for (const stock of [0, 1, 3]) expect(isLowStock({ stock, priceVnd: 100_000 })).toBe(true);
    expect(isLowStock({ stock: 4, priceVnd: 100_000 })).toBe(false);
  });
  it("bỏ món liên hệ báo giá (giá null) và món đã xoá", () => {
    expect(isLowStock({ stock: 0, priceVnd: null })).toBe(false);
    expect(isLowStock({ stock: 1, priceVnd: 100_000, deletedAt: "2026-11-01T00:00:00.000Z" })).toBe(false);
  });
});
