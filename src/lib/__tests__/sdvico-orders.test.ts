import { describe, it, expect } from "vitest";
import { toCrmOrderRow, type WebhookEvent } from "@/lib/sdwork-webhook";
import { sdvicoTab, SDVICO_STATUS_CHIP, SDVICO_STATUS_CHIP_LABEL } from "@/lib/sdvico-orders/status";
import { isSdvicoOrderStatus, SDVICO_ORDER_STATUSES } from "@/lib/sdvico-orders/types";

/*  ĐƠN SDVICO (CRM → /cho/don, ADR 0018): map event `order` → hàng crm_orders + tab/nhãn. */

const ev = (data: Record<string, unknown>, ref = "o1"): WebhookEvent => ({
  entity: "order",
  action: "upsert",
  ref,
  data: {
    customerPhone: "0901234567",
    code: "DH75768",
    status: "dang_chuan_bi",
    snapshotAt: "2026-11-02T01:00:05Z",
    ...data,
  },
});

describe("toCrmOrderRow", () => {
  it("map đủ field, chuẩn hoá SĐT 84…, làm tròn VND", () => {
    const r = toCrmOrderRow(
      ev({
        customerPhone: "84901234567",
        customerName: "Khách A",
        orderedAt: "2026-11-02T00:00:00Z",
        items: [{ name: "Ắc quy", qty: 2, unit: "bình", unitPrice: 1234.6, lineTotal: 2469.2 }],
        services: [{ name: "Lắp đặt", qty: 1, unitPrice: 300000, lineTotal: 300000 }],
        subtotal: 2469.2, discount: 0, vat: 197.5, serviceTotal: 300000, total: 302666.7,
        carrierName: "VTP", trackingNumber: "VTP1", externalRef: "sdfish_order:SDF-1",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row).toMatchObject({
      sdwork_ref: "o1",
      customer_phone: "0901234567",
      customer_name: "Khách A",
      status: "dang_chuan_bi",
      subtotal_vnd: 2469,
      vat_vnd: 198,
      total_vnd: 302667,
      carrier_name: "VTP",
      tracking_number: "VTP1",
      external_ref: "sdfish_order:SDF-1",
    });
    expect(r.row.items).toEqual([{ name: "Ắc quy", qty: 2, unit: "bình", unitPriceVnd: 1235, lineTotalVnd: 2469 }]);
    expect(r.row.services).toEqual([{ name: "Lắp đặt", qty: 1, unitPriceVnd: 300000, lineTotalVnd: 300000 }]);
  });

  it("chỉ giữ field đã khai báo — field nội bộ gửi nhầm KHÔNG lọt vào hàng", () => {
    const r = toCrmOrderRow(
      ev({ costPrice: 1, notes: "nội bộ", items: [{ name: "X", qty: 1, unitPrice: 1, lineTotal: 1, cost: 9 }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.row)).not.toMatch(/cost|nội bộ|notes/);
  });

  it("bỏ dòng không tên / không phải object; số lạ → 0", () => {
    const r = toCrmOrderRow(ev({ items: [{ qty: 1 }, "rác", null, { name: "Y", qty: "2", unitPrice: "abc" }] }));
    expect(r.ok && r.row.items).toEqual([{ name: "Y", qty: 0, unit: null, unitPriceVnd: 0, lineTotalVnd: 0 }]);
  });

  it.each([
    [{ customerPhone: "" }, "missing_required"],
    [{ customerPhone: "02436000000" }, "missing_required"],
    [{ code: "" }, "missing_required"],
    [{ snapshotAt: "không phải ngày" }, "missing_required"],
    [{ status: "completed" }, "bad_status"],
    [{ status: undefined }, "bad_status"],
  ])("%o → %s", (over, code) => {
    expect(toCrmOrderRow(ev(over))).toEqual({ ok: false, code });
  });

  it("chuỗi dài quá CHECK của 0078 bị cắt (không để upsert_failed tới dead-letter)", () => {
    const r = toCrmOrderRow(ev({ customerName: "A".repeat(500), carrierName: "B".repeat(300), trackingNumber: "C".repeat(300) }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.customer_name).toHaveLength(200);
    expect(r.row.carrier_name).toHaveLength(120);
    expect(r.row.tracking_number).toHaveLength(120);
  });

  it("thiếu ref → missing_required", () => {
    expect(toCrmOrderRow(ev({}, ""))).toEqual({ ok: false, code: "missing_required" });
  });
});

describe("trạng thái đơn SDVICO", () => {
  it("4 mã, nhãn chip ≤2 chữ, có màu token (không hex)", () => {
    expect(SDVICO_ORDER_STATUSES).toEqual(["dang_chuan_bi", "dang_giao", "da_giao", "da_huy"]);
    for (const s of SDVICO_ORDER_STATUSES) {
      expect(SDVICO_STATUS_CHIP_LABEL[s].split(/\s+/).length).toBeLessThanOrEqual(2);
      expect(SDVICO_STATUS_CHIP[s].bg).toMatch(/^var\(--/);
      expect(SDVICO_STATUS_CHIP[s].fg).toMatch(/^var\(--/);
    }
    expect(isSdvicoOrderStatus("da_giao")).toBe(true);
    expect(isSdvicoOrderStatus("hoan_thanh")).toBe(false);
  });

  it("tab: chuẩn bị + đang giao → Đang xử lý; đã giao → Xong; huỷ → Đã huỷ; KHÔNG vào Chờ nhận", () => {
    expect(sdvicoTab("dang_chuan_bi")).toBe("dang_xu_ly");
    expect(sdvicoTab("dang_giao")).toBe("dang_xu_ly");
    expect(sdvicoTab("da_giao")).toBe("xong");
    expect(sdvicoTab("da_huy")).toBe("huy");
    expect(SDVICO_ORDER_STATUSES.map(sdvicoTab)).not.toContain("cho_nhan");
  });
});
