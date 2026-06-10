import { describe, expect, it } from "vitest";
import {
  getServiceDueStatus,
  serviceKindLabel,
  type OwnedService,
} from "@/lib/owned-assets";
import {
  mapCrmAssets,
  type CrmOrderDebtRow,
  type CrmServiceRow,
  type CrmWarrantyRow,
} from "@/lib/sdwork-assets";

const TODAY = new Date("2026-06-10T05:00:00Z");

function svc(over: Partial<OwnedService>): OwnedService {
  return {
    id: "s1",
    name: "Bảo trì định kỳ 3 tháng",
    kind: "maintenance",
    active: true,
    ...over,
  };
}

describe("getServiceDueStatus", () => {
  it("dịch vụ ngưng → none, không nhắc", () => {
    const r = getServiceDueStatus(svc({ active: false, nextDueOn: "2026-06-01" }), TODAY);
    expect(r.level).toBe("none");
  });

  it("không có kỳ hẹn → none", () => {
    expect(getServiceDueStatus(svc({}), TODAY).level).toBe("none");
  });

  it("quá kỳ → overdue kèm số ngày", () => {
    const r = getServiceDueStatus(svc({ nextDueOn: "2026-06-01" }), TODAY);
    expect(r.level).toBe("overdue");
    expect(r.days).toBe(-9);
    expect(r.label).toContain("Quá kỳ 9 ngày");
  });

  it("đến kỳ hôm nay → soon", () => {
    const r = getServiceDueStatus(svc({ nextDueOn: "2026-06-10" }), TODAY);
    expect(r.level).toBe("soon");
    expect(r.label).toBe("Đến kỳ hôm nay");
  });

  it("trong 14 ngày → soon; xa hơn → ok", () => {
    expect(getServiceDueStatus(svc({ nextDueOn: "2026-06-24" }), TODAY).level).toBe("soon");
    expect(getServiceDueStatus(svc({ nextDueOn: "2026-06-25" }), TODAY).level).toBe("ok");
  });
});

describe("serviceKindLabel", () => {
  it("dịch tên loại sang tiếng đời thường", () => {
    expect(serviceKindLabel("maintenance")).toBe("Bảo trì định kỳ");
    expect(serviceKindLabel("subscription")).toBe("Thuê bao / cước");
    expect(serviceKindLabel("gì đó lạ")).toBe("Dịch vụ");
  });
});

describe("mapCrmAssets", () => {
  const warranties: CrmWarrantyRow[] = [
    {
      serial: "A281 2342",
      activated_at: "2025-11-30T00:00:00+00:00",
      expires_at: "2026-11-30T00:00:00+00:00",
      status: "active",
      order_id: "o1",
      products: { name: "Màng lọc RO nước biển 3040" },
      orders: { code: "DH03337" },
    },
    {
      serial: null,
      activated_at: null,
      expires_at: null,
      status: null,
      order_id: null,
      products: null,
      orders: null,
    },
  ];
  const services: CrmServiceRow[] = [
    {
      id: "s-far",
      service_name: "Bảo trì định kỳ 3 tháng",
      service_type: "maintenance",
      status: "active",
      start_date: "2025-11-30",
      next_due_date: "2026-08-28",
      end_date: null,
    },
    {
      id: "s-none",
      service_name: "Sửa chữa khi cần",
      service_type: "repair",
      status: "active",
      start_date: "2025-11-30",
      next_due_date: null,
      end_date: null,
    },
    {
      id: "s-near",
      service_name: "Cước giám sát hành trình",
      service_type: "subscription",
      status: "active",
      start_date: "2025-11-30",
      next_due_date: "2026-06-20",
      end_date: null,
    },
    // trùng id → bỏ
    {
      id: "s-near",
      service_name: "Cước giám sát hành trình",
      service_type: "subscription",
      status: "active",
      start_date: "2025-11-30",
      next_due_date: "2026-06-20",
      end_date: null,
    },
  ];
  const debts: CrmOrderDebtRow[] = [
    { code: "DH01081", debt_amount: 2500000, debt_due_date: "2026-06-15" },
    { code: "DH09999", debt_amount: 0, debt_due_date: null }, // hết nợ → bỏ
    { code: null, debt_amount: 100, debt_due_date: null }, // không mã → bỏ
  ];

  const out = mapCrmAssets(warranties, services, debts, "Lê Hữu Thắng");

  it("sản phẩm: lấy tên + serial + ngày mua + hạn bảo hành + mã đơn", () => {
    expect(out.products).toHaveLength(2);
    expect(out.products[0]).toMatchObject({
      name: "Màng lọc RO nước biển 3040",
      serial: "A281 2342",
      purchasedOn: "2025-11-30",
      warrantyUntil: "2026-11-30",
      orderCode: "DH03337",
    });
    // hàng thiếu dữ liệu vẫn không vỡ
    expect(out.products[1].name).toBe("Sản phẩm SDVICO");
    expect(out.products[1].warrantyUntil).toBeUndefined();
  });

  it("dịch vụ: khử trùng id, xếp kỳ gần nhất lên đầu, không kỳ xuống cuối", () => {
    expect(out.services.map((s) => s.id)).toEqual(["s-near", "s-far", "s-none"]);
    expect(out.services[0].kind).toBe("subscription");
  });

  it("công nợ: chỉ giữ khoản > 0 có mã đơn", () => {
    expect(out.payments).toEqual([
      { orderCode: "DH01081", amountVnd: 2500000, dueOn: "2026-06-15" },
    ]);
  });

  it("kèm tên khách để đối chiếu", () => {
    expect(out.customerName).toBe("Lê Hữu Thắng");
  });
});
