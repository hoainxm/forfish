import { describe, it, expect } from "vitest";
import { marketNotice, type MarketEvent } from "@/lib/market/notice";
import type { Order } from "@/lib/market/types";

const order: Order = {
  id: "o-1", code: "SD260906K7PQ", buyerPhone: "0901000001", shopId: "s-1", shopName: "Đại lý Hải Đăng", shopPhone: "0902000002",
  items: [
    { productId: "p1", title: "Đá cây 50kg", unit: "cây", priceVnd: 35000, qty: 10, lineTotalVnd: 350000 },
    { productId: "p2", title: "Dây thừng", unit: "kg", priceVnd: 45000, qty: 20, lineTotalVnd: 900000, variantLabel: "Ø12" },
  ],
  subtotalVnd: 1250000, shippingVnd: 30000, totalVnd: 1280000, paymentMethod: "chuyen_khoan", paymentStatus: "bao_da_chuyen",
  needsRefund: false, status: "cho_xac_nhan",
  address: { name: "Nguyễn Văn Ba", phone: "0901000001", province: "Khánh Hòa", detail: "Cảng Hòn Rớ", isPort: true },
  timeline: [], createdAt: "2026-09-06T00:00:00Z", updatedAt: "2026-09-06T00:00:00Z", carrier: "Gửi xe", trackingCode: "PT-1",
};
const shop = { id: "s-1", name: "Đại lý Hải Đăng" };
const product = { id: "p-9", title: "Lưới kéo mắt nhỏ" };
const ctx = { order, shop, product, reason: "Thiếu giấy tờ", hotline: "0939 243 222" };

/** Bảng 11 §8 — sự kiện → (pushOs, url) */
const TABLE: Record<MarketEvent, { push: boolean; url: string }> = {
  N1: { push: true, url: "/ban-hang/don/o-1" },
  N2: { push: false, url: "/cho/don/o-1" },
  N3: { push: true, url: "/cho/don/o-1" },
  N4: { push: true, url: "/cho/don/o-1" },
  N5: { push: false, url: "/ban-hang/don/o-1" },
  N6: { push: false, url: "/ban-hang/don/o-1" },
  N7: { push: true, url: "/cho/don/o-1" },
  N8: { push: true, url: "/ban-hang/don/o-1" },
  N9: { push: false, url: "/cho/don/o-1" },
  N9b: { push: true, url: "/cho/don/o-1" },
  N10: { push: true, url: "/ban-hang" },
  N11: { push: true, url: "/ban-hang" },
  N12: { push: true, url: "/ban-hang" },
  N13: { push: false, url: "/ban-hang/san-pham/p-9" },
};
const ORDER_EVENTS: MarketEvent[] = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N9b"];

describe("marketNotice — bảng 11 §8", () => {
  it("pushOs + url đúng bảng cho 14 sự kiện; tag mdon-/mshop-", () => {
    for (const ev of Object.keys(TABLE) as MarketEvent[]) {
      const n = marketNotice(ev, ctx);
      expect(n.pushOs, ev).toBe(TABLE[ev].push);
      expect(n.url, ev).toBe(TABLE[ev].url);
      expect(n.title.length, ev).toBeGreaterThan(0);
      expect(n.body.length, ev).toBeGreaterThan(0);
      expect(n.tag, ev).toBe(ORDER_EVENTS.includes(ev) ? "mdon-o-1" : "mshop-s-1");
    }
  });
  it("mọi sự kiện của đơn có MÃ ĐƠN trong title hoặc body", () => {
    for (const ev of ORDER_EVENTS) {
      const n = marketNotice(ev, ctx);
      expect(`${n.title} ${n.body}`, ev).toContain("SD260906K7PQ");
    }
  });
  it("N1: người nhận + số món + tổng + cách trả; N3: cách giao + mã + SĐT shop; N7 kèm câu hoàn tiền khi needsRefund", () => {
    const n1 = marketNotice("N1", ctx);
    expect(n1.title).toBe("Đơn mới SD260906K7PQ");
    expect(n1.body).toContain("Nguyễn Văn Ba");
    expect(n1.body).toContain("30 món");
    expect(n1.body).toContain("Chuyển khoản");
    expect(n1.body).toMatch(/1\.280\.000/);
    const n3 = marketNotice("N3", ctx);
    expect(n3.body).toBe("Gửi xe · mã vận đơn PT-1. Gọi shop: 0902000002");
    const n7 = marketNotice("N7", { ...ctx, reason: "Hết hàng", order: { ...order, needsRefund: true } });
    expect(n7.body).toBe("Lý do: Hết hàng. Shop sẽ hoàn tiền đã chuyển.");
    const n7b = marketNotice("N7", { ...ctx, reason: "Hết hàng" });
    expect(n7b.body).toBe("Lý do: Hết hàng.");
    const n8 = marketNotice("N8", ctx);
    expect(n8.title).toMatch(/1\.280\.000/);
    expect(n8.body).toContain("nội dung SD260906K7PQ");
  });
  it("N10–N13 shop/sản phẩm: tên shop, lý do, hotline", () => {
    expect(marketNotice("N10", ctx).title).toBe("Shop Đại lý Hải Đăng đã được duyệt");
    expect(marketNotice("N11", ctx).body).toBe("Thiếu giấy tờ. Sửa rồi gửi lại.");
    expect(marketNotice("N12", ctx).body).toBe("Thiếu giấy tờ. Gọi SDVICO 0939 243 222.");
    const n13 = marketNotice("N13", ctx);
    expect(n13.title).toBe("SDVICO đã gỡ món Lưới kéo mắt nhỏ");
    expect(n13.body).toBe("Thiếu giấy tờ.");
  });
  it("thiếu ngữ cảnh (không order) ⇒ không ném, vẫn có chuỗi", () => {
    for (const ev of Object.keys(TABLE) as MarketEvent[]) {
      expect(() => marketNotice(ev, { hotline: "0939" })).not.toThrow();
    }
    expect(marketNotice("N6", { hotline: "x", order }).body).toBe("Người mua không ghi lý do.");
  });
});
