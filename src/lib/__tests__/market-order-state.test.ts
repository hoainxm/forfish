import { describe, it, expect } from "vitest";
import {
  AUTO_COMPLETE_MS,
  applyPaymentTransition,
  applyTransition,
  canReview,
  canTransitionOrder,
  canTransitionPayment,
  isPendingTooLong,
  ORDER_STATUS_CHIP,
  ORDER_STATUSES,
  settleOverdue,
  timelineBy,
  TRANSITIONS,
} from "@/lib/market/order-state";
import type { Actor, Order, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/market/types";

const ACTORS: Actor[] = ["buyer", "seller", "admin", "system"];

function order(p: Partial<Order> = {}): Order {
  return {
    id: "o1", code: "SD260906K7PQ", buyerPhone: "0901000001", shopId: "s1",
    items: [{ productId: "p1", title: "Đá cây", unit: "cây", priceVnd: 35000, qty: 10, lineTotalVnd: 350000 }],
    subtotalVnd: 350000, shippingVnd: 30000, totalVnd: 380000,
    paymentMethod: "cod", paymentStatus: "chua_thanh_toan", needsRefund: false,
    status: "cho_xac_nhan",
    address: { name: "Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true },
    timeline: [], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    ...p,
  };
}

describe("TRANSITIONS — bảng chân trị theo actor (11 §4.1)", () => {
  it("mọi cặp hợp lệ đúng như bảng, và KHÔNG có cặp nào ngoài bảng", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        for (const actor of ACTORS) {
          const expected = (TRANSITIONS[from][actor] ?? []).includes(to);
          expect(canTransitionOrder(from, to, actor), `${from}→${to} bởi ${actor}`).toBe(expected);
        }
      }
    }
  });
  it("hoan_thanh / da_huy là đích — không đi đâu", () => {
    for (const to of ORDER_STATUSES) for (const a of ACTORS) {
      expect(canTransitionOrder("hoan_thanh", to, a)).toBe(false);
      expect(canTransitionOrder("da_huy", to, a)).toBe(false);
    }
  });
  it("buyer chỉ huỷ ở cho_xac_nhan; seller không huỷ từ dang_giao; admin huỷ được dang_giao", () => {
    expect(canTransitionOrder("cho_xac_nhan", "da_huy", "buyer")).toBe(true);
    expect(canTransitionOrder("da_xac_nhan", "da_huy", "buyer")).toBe(false);
    expect(canTransitionOrder("dang_giao", "da_huy", "seller")).toBe(false);
    expect(canTransitionOrder("dang_giao", "da_huy", "admin")).toBe(true);
    expect(canTransitionOrder("da_giao", "hoan_thanh", "system")).toBe(true);
    expect(canTransitionOrder("da_giao", "hoan_thanh", "seller")).toBe(false);
  });
});

describe("applyTransition — tác dụng phụ", () => {
  const NOW = "2026-09-06T03:00:00.000Z";
  it("da_giao ⇒ deliveredAt; hoan_thanh COD ⇒ completedAt + da_thanh_toan; CK KHÔNG tự da_thanh_toan", () => {
    const p1 = applyTransition(order({ status: "dang_giao" }), "da_giao", "seller", undefined, NOW)!;
    expect(p1.deliveredAt).toBe(NOW);
    expect(p1.status).toBe("da_giao");
    const p2 = applyTransition(order({ status: "da_giao" }), "hoan_thanh", "buyer", undefined, NOW)!;
    expect(p2.completedAt).toBe(NOW);
    expect(p2.paymentStatus).toBe("da_thanh_toan");
    const p3 = applyTransition(order({ status: "da_giao", paymentMethod: "chuyen_khoan" }), "hoan_thanh", "buyer", undefined, NOW)!;
    expect(p3.paymentStatus).toBeUndefined();
  });
  it("huỷ bởi seller thiếu note ⇒ null; có note ⇒ cancelBy/cancelReason; buyer không cần note", () => {
    expect(applyTransition(order(), "da_huy", "seller", undefined, NOW)).toBeNull();
    expect(applyTransition(order(), "da_huy", "seller", "   ", NOW)).toBeNull();
    const p = applyTransition(order(), "da_huy", "seller", "Hết hàng rồi", NOW)!;
    expect(p.cancelBy).toBe("seller");
    expect(p.cancelReason).toBe("Hết hàng rồi");
    const b = applyTransition(order(), "da_huy", "buyer", undefined, NOW)!;
    expect(b.cancelBy).toBe("buyer");
    expect(b.cancelReason).toBeUndefined();
  });
  it("needsRefund = CK ∧ paymentStatus ∈ {bao_da_chuyen, da_thanh_toan} — mọi actor; COD / chua_thanh_toan ⇒ false", () => {
    const cases: [PaymentMethod, PaymentStatus, boolean][] = [
      ["chuyen_khoan", "bao_da_chuyen", true],
      ["chuyen_khoan", "da_thanh_toan", true],
      ["chuyen_khoan", "chua_thanh_toan", false],
      ["cod", "chua_thanh_toan", false],
      ["cod", "da_thanh_toan", false],
    ];
    for (const [pm, ps, want] of cases) {
      for (const actor of ["buyer", "seller", "admin"] as Actor[]) {
        const p = applyTransition(order({ paymentMethod: pm, paymentStatus: ps }), "da_huy", actor, "Lý do đủ dài", NOW)!;
        expect(p.needsRefund, `${pm}/${ps}/${actor}`).toBe(want);
      }
    }
  });
  it("by = admin:<sđt> khi admin; timelineAppend luôn có", () => {
    const p = applyTransition(order(), "da_xac_nhan", "admin", undefined, NOW, "0909000000")!;
    expect(p.timelineAppend).toEqual({ status: "da_xac_nhan", at: NOW, by: "admin:0909000000" });
    expect(timelineBy("seller")).toBe("seller");
    expect(timelineBy("admin", "0909000000")).toBe("admin:0909000000");
  });
  it("không được phép ⇒ null", () => {
    expect(applyTransition(order({ status: "hoan_thanh" }), "da_huy", "admin", "x".repeat(10), NOW)).toBeNull();
  });
});

describe("canTransitionPayment — P1..P3", () => {
  const ck = (ps: PaymentStatus, status: OrderStatus = "cho_xac_nhan") =>
    order({ paymentMethod: "chuyen_khoan", paymentStatus: ps, status });
  it("8 ca", () => {
    expect(canTransitionPayment(ck("chua_thanh_toan"), "bao_da_chuyen", "buyer")).toBe(true); // P1
    expect(canTransitionPayment(order({ paymentStatus: "chua_thanh_toan" }), "bao_da_chuyen", "buyer")).toBe(false); // COD
    expect(canTransitionPayment(ck("chua_thanh_toan", "da_huy"), "bao_da_chuyen", "buyer")).toBe(false);
    expect(canTransitionPayment(ck("chua_thanh_toan", "hoan_thanh"), "bao_da_chuyen", "buyer")).toBe(false);
    expect(canTransitionPayment(ck("bao_da_chuyen"), "da_thanh_toan", "seller")).toBe(true); // P2
    expect(canTransitionPayment(ck("chua_thanh_toan"), "da_thanh_toan", "admin")).toBe(true); // nhận tiền không qua báo
    expect(canTransitionPayment(ck("bao_da_chuyen"), "chua_thanh_toan", "seller")).toBe(true); // P3
    expect(canTransitionPayment(ck("bao_da_chuyen"), "da_thanh_toan", "buyer")).toBe(false); // buyer không tự xác nhận
  });
  it("applyPaymentTransition: P3 thiếu note ⇒ null; có note ⇒ patch với timeline", () => {
    expect(applyPaymentTransition(ck("bao_da_chuyen"), "chua_thanh_toan", "seller", undefined, "2026-09-06T00:00:00Z")).toBeNull();
    const p = applyPaymentTransition(ck("bao_da_chuyen"), "chua_thanh_toan", "seller", "Chưa thấy tiền về", "2026-09-06T00:00:00Z")!;
    expect(p.paymentStatus).toBe("chua_thanh_toan");
    expect(p.timelineAppend?.note).toBe("Chưa thấy tiền về");
    const p1 = applyPaymentTransition(ck("chua_thanh_toan"), "bao_da_chuyen", "buyer", undefined, "2026-09-06T00:00:00Z")!;
    expect(p1.timelineAppend?.status).toBe("bao_da_chuyen");
  });
});

describe("canReview", () => {
  it("4 ca", () => {
    expect(canReview(order({ status: "hoan_thanh" }), "p1", [])).toBe(true);
    expect(canReview(order({ status: "da_giao" }), "p1", [])).toBe(false);
    expect(canReview(order({ status: "hoan_thanh" }), "p9", [])).toBe(false);
    expect(canReview(order({ status: "hoan_thanh" }), "p1", ["p1"])).toBe(false);
  });
});

describe("settleOverdue — tự hoàn thành LƯỜI 7 ngày", () => {
  const delivered = "2026-08-30T10:00:00.000Z";
  it("6d23h ⇒ null; đúng 7d ⇒ patch với completedAt = deliveredAt + 7d, by system, COD ⇒ da_thanh_toan", () => {
    const o = order({ status: "da_giao", deliveredAt: delivered });
    const almost = new Date(Date.parse(delivered) + AUTO_COMPLETE_MS - 3600 * 1000).toISOString();
    expect(settleOverdue(o, almost)).toBeNull();
    const exactly = new Date(Date.parse(delivered) + AUTO_COMPLETE_MS).toISOString();
    const p = settleOverdue(o, exactly)!;
    expect(p.status).toBe("hoan_thanh");
    expect(p.completedAt).toBe("2026-09-06T10:00:00.000Z");
    expect(p.timelineAppend?.by).toBe("system");
    expect(p.timelineAppend?.at).toBe("2026-09-06T10:00:00.000Z");
    expect(p.timelineAppend?.note).toBe("Tự hoàn thành sau 7 ngày");
    expect(p.paymentStatus).toBe("da_thanh_toan");
    // đọc muộn 20 ngày vẫn lấy MỐC ĐẾN HẠN
    const late = settleOverdue(o, "2026-09-26T00:00:00.000Z")!;
    expect(late.completedAt).toBe("2026-09-06T10:00:00.000Z");
  });
  it("không phải da_giao / thiếu deliveredAt ⇒ null", () => {
    expect(settleOverdue(order({ status: "dang_giao", deliveredAt: delivered }), "2026-10-01T00:00:00Z")).toBeNull();
    expect(settleOverdue(order({ status: "da_giao" }), "2026-10-01T00:00:00Z")).toBeNull();
  });
});

describe("isPendingTooLong — biên 48h", () => {
  const created = "2026-09-01T00:00:00.000Z";
  it("47h59 ⇒ false; 48h ⇒ true; không phải cho_xac_nhan ⇒ false", () => {
    const o = order({ createdAt: created });
    expect(isPendingTooLong(o, "2026-09-02T23:59:00.000Z")).toBe(false);
    expect(isPendingTooLong(o, "2026-09-03T00:00:00.000Z")).toBe(true);
    expect(isPendingTooLong(order({ createdAt: created, status: "da_xac_nhan" }), "2026-09-10T00:00:00Z")).toBe(false);
  });
});

describe("ORDER_STATUS_CHIP", () => {
  it("chỉ token var(--…), không hex", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_STATUS_CHIP[s].bg).toMatch(/^var\(--[a-z-]+\)$/);
      expect(ORDER_STATUS_CHIP[s].fg).toMatch(/^var\(--[a-z-]+\)$/);
      expect(ORDER_STATUS_CHIP[s].bg).not.toContain("#");
    }
  });
});
