import { describe, expect, it } from "vitest";
import { ETA_PRESETS, etaLabel, isLate, presetRange, readEta, validateEta } from "@/lib/market/eta";
import { makeRequestCode } from "@/lib/market/order-code";
import { AUTO_CANCEL_MS, AUTO_CANCEL_REASON, msUntilAutoCancel, settleOverdue } from "@/lib/market/order-state";
import { requestNotice } from "@/lib/market/notice";
import {
  applyAccept, applyBuyerCancel, applyQuote, applyReject, canRequestTransition, patchRequest,
  QUOTE_VALID_MS, REQUEST_IDLE_MS, REQUEST_STATUSES, requestToOrder, settleRequest,
} from "@/lib/market/request-state";
import type { MarketRequest, Order } from "@/lib/market/types";
import { validateQuote, validateRequestDraft } from "@/lib/market/validate";

const TODAY = "2026-10-18"; // Chủ nhật
const addr = { name: "Nguyễn Văn Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true };

function req(p: Partial<MarketRequest> = {}): MarketRequest {
  return {
    id: "11111111-1111-4111-8111-111111111111", code: "YC261018ABCD", buyerPhone: "0901000001",
    title: "Chân vịt inox 3 cánh 18 inch", qty: 2, unit: "cái", images: [], address: addr, paymentMethod: "cod",
    status: "moi", timeline: [{ status: "moi", at: "2026-10-18T01:00:00.000Z", by: "buyer" }],
    createdAt: "2026-10-18T01:00:00.000Z", updatedAt: "2026-10-18T01:00:00.000Z", ...p,
  };
}
function order(p: Partial<Order> = {}): Order {
  return {
    id: "o1", code: "SD261018K7PQ", buyerPhone: "0901000001", shopId: "s1",
    items: [], subtotalVnd: 0, shippingVnd: 0, totalVnd: 0, paymentMethod: "cod", paymentStatus: "chua_thanh_toan",
    needsRefund: false, status: "cho_xac_nhan", address: addr, timeline: [],
    createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z", ...p,
  };
}

describe("hẹn giao (eta.ts)", () => {
  it("chip chọn nhanh ra đúng khoảng ngày", () => {
    expect(presetRange("hom_nay", TODAY)).toEqual({ etaFrom: TODAY, etaTo: TODAY });
    expect(presetRange("2_3_ngay", TODAY)).toEqual({ etaFrom: "2026-10-20", etaTo: "2026-10-21" });
    for (const p of ETA_PRESETS) expect(validateEta(presetRange(p.id, TODAY)!.etaFrom, presetRange(p.id, TODAY)!.etaTo, TODAY)).toBeNull();
  });
  it("chặn ngày quá khứ, ngược, quá 60 ngày, sai khuôn", () => {
    expect(validateEta("2026-10-17", "2026-10-18", TODAY)).toMatch(/trước hôm nay/);
    expect(validateEta("2026-10-20", "2026-10-19", TODAY)).toMatch(/sau ngày gần nhất/);
    expect(validateEta(TODAY, "2026-12-30", TODAY)).toMatch(/60 ngày/);
    expect(validateEta("18/10", "", TODAY)).toMatch(/Chọn ngày/);
  });
  it("readEta: preset, một ngày, rác", () => {
    expect(readEta({ etaPreset: "ngay_mai" }, TODAY)).toEqual({ etaFrom: "2026-10-19", etaTo: "2026-10-19" });
    expect(readEta({ etaFrom: "2026-10-22" }, TODAY)).toEqual({ etaFrom: "2026-10-22", etaTo: "2026-10-22" });
    expect(typeof readEta({ etaPreset: "mai_kia" }, TODAY)).toBe("string");
    expect(typeof readEta({}, TODAY)).toBe("string");
  });
  it("nhãn đọc được cho bà con", () => {
    expect(etaLabel(TODAY, TODAY, TODAY)).toBe("hôm nay");
    expect(etaLabel("2026-10-19", "2026-10-19", TODAY)).toBe("ngày mai");
    expect(etaLabel("2026-10-20", "2026-10-21", TODAY)).toBe("Thứ Ba 20/10 – Thứ Tư 21/10");
    expect(etaLabel("2026-11-02", undefined, TODAY)).toBe("2/11");
    expect(etaLabel(undefined, undefined, TODAY)).toBe("");
  });
  it("trễ hẹn chỉ khi còn đang chờ giao và đã qua etaTo", () => {
    expect(isLate({ status: "dang_giao", etaFrom: "2026-10-15", etaTo: "2026-10-17" }, TODAY)).toBe(true);
    expect(isLate({ status: "dang_giao", etaFrom: "2026-10-15", etaTo: TODAY }, TODAY)).toBe(false);
    expect(isLate({ status: "da_giao", etaFrom: "2026-10-15", etaTo: "2026-10-16" }, TODAY)).toBe(false);
    expect(isLate({ status: "da_xac_nhan" }, TODAY)).toBe(false);
  });
});

describe("tự huỷ đơn chờ xác nhận 72 giờ", () => {
  const o = order();
  it("chưa đủ 72 giờ thì không đụng, đủ thì system huỷ, mốc = lúc đến hạn", () => {
    expect(settleOverdue(o, new Date(Date.parse(o.createdAt) + AUTO_CANCEL_MS - 1).toISOString())).toBeNull();
    const p = settleOverdue(o, "2026-10-25T00:00:00.000Z")!;
    expect(p.status).toBe("da_huy");
    expect(p.cancelBy).toBe("system");
    expect(p.cancelReason).toBe(AUTO_CANCEL_REASON);
    expect(p.timelineAppend!.at).toBe("2026-10-21T00:00:00.000Z");
  });
  it("đếm ngược", () => {
    expect(msUntilAutoCancel(o, "2026-10-20T00:00:00.000Z")).toBe(24 * 3600 * 1000);
    expect(msUntilAutoCancel(o, "2026-10-30T00:00:00.000Z")).toBe(0);
    expect(msUntilAutoCancel(order({ status: "da_xac_nhan" }), TODAY)).toBeNull();
  });
});

describe("yêu cầu đặt hàng (request-state.ts)", () => {
  const now = "2026-10-18T02:00:00.000Z";
  const quote = { goodsVnd: 3_600_000, shippingVnd: 50_000, etaFrom: "2026-10-20", etaTo: "2026-10-21", note: "Hàng Đài Loan" };
  it("chỉ admin báo giá / từ chối; chủ tàu đồng ý hoặc huỷ; đích không đi đâu", () => {
    expect(canRequestTransition("moi", "da_bao_gia", "admin")).toBe(true);
    expect(canRequestTransition("moi", "da_bao_gia", "buyer")).toBe(false);
    expect(canRequestTransition("moi", "da_dat", "buyer")).toBe(false);
    expect(canRequestTransition("da_bao_gia", "da_dat", "buyer")).toBe(true);
    for (const to of REQUEST_STATUSES) for (const from of ["da_dat", "khong_tim_duoc", "da_huy", "het_han"] as const)
      expect(canRequestTransition(from, to, "admin") || canRequestTransition(from, to, "buyer")).toBe(false);
  });
  it("báo giá → đồng ý trong hạn → sinh đơn đã xác nhận kèm hẹn giao", () => {
    const p = applyQuote(req(), quote, "shop-1", now, "0909999999")!;
    expect(p.status).toBe("da_bao_gia");
    expect(Date.parse(p.quote!.expiresAt) - Date.parse(now)).toBe(QUOTE_VALID_MS);
    expect(p.timelineAppend!.by).toBe("admin:0909999999");
    const quoted = patchRequest(req(), p, now);
    expect(applyAccept(quoted, "2026-10-21T01:59:59.000Z")!.status).toBe("da_dat");
    expect(applyAccept(quoted, "2026-10-21T02:00:00.000Z")).toBeNull(); // hết hạn đúng mốc
    const o = requestToOrder(quoted, now)!;
    expect(o.shopId).toBe("shop-1");
    expect(o.lines).toEqual([{ productId: quoted.id, title: quoted.title, unit: "cái", priceVnd: 1_800_000, qty: 2, lineTotalVnd: 3_600_000 }]);
    expect(o.totalVnd).toBe(3_650_000);
    expect([o.etaFrom, o.etaTo]).toEqual(["2026-10-20", "2026-10-21"]);
    expect(o.timeline.map((t) => t.status)).toEqual(["cho_xac_nhan", "da_xac_nhan"]);
    expect(o.buyerNote).toMatch(/Chủ sàn: Hàng Đài Loan/);
  });
  it("từ chối bắt buộc lý do; huỷ chỉ trước khi đặt", () => {
    expect(applyReject(req(), "  ", now)).toBeNull();
    expect(applyReject(req(), "Hết hàng cả tỉnh", now)!.rejectReason).toBe("Hết hàng cả tỉnh");
    expect(applyBuyerCancel(req({ status: "da_dat" }), undefined, now)).toBeNull();
    expect(applyBuyerCancel(req(), "mua chỗ khác rồi", now)!.status).toBe("da_huy");
  });
  it("hết hạn lười: báo giá 3 ngày, yêu cầu treo 7 ngày", () => {
    const quoted = patchRequest(req(), applyQuote(req(), quote, "s", now)!, now);
    expect(settleRequest(quoted, "2026-10-20T00:00:00.000Z")).toBeNull();
    expect(settleRequest(quoted, "2026-10-30T00:00:00.000Z")!.status).toBe("het_han");
    const idle = req();
    expect(settleRequest(idle, new Date(Date.parse(idle.createdAt) + REQUEST_IDLE_MS - 1).toISOString())).toBeNull();
    expect(settleRequest(idle, "2026-11-01T00:00:00.000Z")!.timelineAppend!.at).toBe("2026-10-25T01:00:00.000Z");
  });
  it("mã YC và thông báo", () => {
    expect(makeRequestCode(new Date("2026-10-18T03:00:00Z"), () => 0)).toBe("YC261018AAAA");
    const quoted = patchRequest(req(), applyQuote(req(), quote, "s", now)!, now);
    expect(requestNotice("Y1", quoted).body).toMatch(/3\.650\.000/);
    expect(requestNotice("Y2", { ...req(), rejectReason: "Hết hàng" }).body).toBe("Hết hàng.");
  });
});

describe("validate yêu cầu + báo giá", () => {
  const draft = { title: "Chân vịt inox", qty: 2, unit: "cái", address: addr, paymentMethod: "cod" as const };
  it("draft", () => {
    expect(validateRequestDraft(draft, TODAY)).toBeNull();
    expect(validateRequestDraft({ ...draft, title: "ab" }, TODAY)).toMatch(/tên món/);
    expect(validateRequestDraft({ ...draft, qty: 0 }, TODAY)).toMatch(/Số lượng/);
    expect(validateRequestDraft({ ...draft, needBy: "2026-10-01" }, TODAY)).toMatch(/trước hôm nay/);
    expect(validateRequestDraft({ ...draft, images: ["http://x"] }, TODAY)).toMatch(/Ảnh/);
  });
  it("quote", () => {
    const q = { shopId: "s", goodsVnd: 100_000, shippingVnd: 0, etaFrom: TODAY, etaTo: TODAY };
    expect(validateQuote(q, TODAY)).toBeNull();
    expect(validateQuote({ ...q, shopId: "" }, TODAY)).toMatch(/shop/);
    expect(validateQuote({ ...q, goodsVnd: 500 }, TODAY)).toMatch(/Tiền hàng/);
    expect(validateQuote({ ...q, etaFrom: "2026-10-01" }, TODAY)).toMatch(/trước hôm nay/);
  });
});
