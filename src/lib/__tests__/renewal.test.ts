import { describe, it, expect } from "vitest";
import {
  RENEWAL_MONTH_OPTIONS,
  isValidRenewalMonths,
  renewalMonthsLabel,
  renewalTotal,
  renewalStatusView,
  chuanMaTau,
  daDoiHan,
  chonYeuCauDong,
  danhDauTenTrung,
  laYeuCauCuaMay,
  giaHanCuaTau,
  yeuCauDangMo,
  xacNhanGiaHan,
  hanMongDoi,
  renewalExtendedView,
  type RenewalRequestSummary,
} from "@/lib/renewal";

describe("kỳ hạn gia hạn — chỉ 3/6/12 (chủ dự án chốt)", () => {
  it("đúng bộ 3 mốc, không hơn không kém", () => {
    expect([...RENEWAL_MONTH_OPTIONS]).toEqual([3, 6, 12]);
  });

  it("isValidRenewalMonths chỉ nhận 3/6/12", () => {
    for (const n of [3, 6, 12]) expect(isValidRenewalMonths(n)).toBe(true);
    // số lạ / kiểu lạ / mốc cũ 1–24 đều bị chối
    for (const bad of [1, 2, 4, 5, 9, 18, 24, 0, -3, 3.5, "6", null, undefined, NaN]) {
      expect(isValidRenewalMonths(bad)).toBe(false);
    }
  });
});

describe("renewalMonthsLabel", () => {
  it("12 tháng nói '1 năm', còn lại 'N tháng'", () => {
    expect(renewalMonthsLabel(3)).toBe("3 tháng");
    expect(renewalMonthsLabel(6)).toBe("6 tháng");
    expect(renewalMonthsLabel(12)).toBe("1 năm");
  });
});

describe("renewalTotal", () => {
  it("tổng = số tháng × đơn giá", () => {
    expect(renewalTotal(3, 385000)).toBe(1155000);
    expect(renewalTotal(6, 385000)).toBe(2310000);
    expect(renewalTotal(12, 385000)).toBe(4620000);
  });
});

describe("renewalStatusView — giọng nói thật cho bà con", () => {
  it("chờ chuyển khoản = warn", () => {
    expect(renewalStatusView("pending_payment")).toEqual({
      label: "Chờ chuyển khoản",
      tone: "warn",
    });
  });
  it("đã nhận tiền chờ gia hạn = warn", () => {
    expect(renewalStatusView("pending_extension").tone).toBe("warn");
  });
  it("SDVICO báo đã gia hạn = ok, nhưng KHÔNG nói 'xong' (chưa đối chiếu S-Tracking)", () => {
    expect(renewalStatusView("extended")).toEqual({
      label: "SDVICO báo đã gia hạn",
      tone: "ok",
    });
  });
  it("hủy / hết hạn = neutral", () => {
    expect(renewalStatusView("cancelled").tone).toBe("neutral");
    expect(renewalStatusView("expired").tone).toBe("neutral");
  });
  it("trạng thái lạ → 'đang xử lý', không vỡ", () => {
    expect(renewalStatusView("wat_is_this")).toEqual({
      label: "Đang xử lý",
      tone: "neutral",
    });
  });
});

// ── Hứng luồng gia hạn từ thẻ S-Tracking (2026-11-05) ──
const NOW = Date.parse("2026-11-05T05:00:00Z");
function yc(p: Partial<RenewalRequestSummary>): RenewalRequestSummary {
  return {
    requestCode: "GH-1",
    status: "pending_payment",
    totalAmount: 0,
    transferNote: "",
    qrUrl: null,
    qrExpiresAt: null,
    createdAt: null,
    paidAt: null,
    extendedAt: null,
    vesselCode: "BV-1234-TS",
    monthsCount: 6,
    newExpiryDate: null,
    ...p,
  };
}

const MAY = { serial: "S1", tenTau: "BV-1234-TS", tenTrung: false };

describe("chuanMaTau", () => {
  it("bỏ khoảng trắng + chữ hoa; rỗng/null → ''", () => {
    expect(chuanMaTau(" bv-1234 -ts ")).toBe("BV-1234-TS");
    expect(chuanMaTau(null)).toBe("");
  });
});

describe("ghép yêu cầu ↔ máy — KHOÁ serial, chống nhầm tên trùng", () => {
  it("có serial ⇒ chỉ so serial (tên giống mà serial khác là máy khác)", () => {
    expect(laYeuCauCuaMay(yc({ serialNumber: "S1" }), MAY)).toBe(true);
    expect(laYeuCauCuaMay(yc({ serialNumber: "S2" }), MAY)).toBe(false);
  });
  it("yêu cầu cũ chưa có serial ⇒ so tên, nhưng KHÔNG khi tên trùng trong máy của SĐT", () => {
    expect(laYeuCauCuaMay(yc({}), MAY)).toBe(true);
    expect(laYeuCauCuaMay(yc({}), { ...MAY, tenTrung: true })).toBe(false);
    expect(laYeuCauCuaMay(yc({}), { ...MAY, tenTau: null })).toBe(false);
  });
  it("danhDauTenTrung đếm theo tên chuẩn hoá", () => {
    const ds = danhDauTenTrung([
      { serial: "A", tenTau: "BV-1-TS" },
      { serial: "B", tenTau: "bv-1-ts" },
      { serial: "C", tenTau: "KH-2-TS" },
      { serial: "D", tenTau: null },
    ]);
    expect(ds.map((m) => m.tenTrung)).toEqual([true, true, false, false]);
  });
});

describe("hanMongDoi / daDoiHan — đích cuối là HẠN ĐỔI trên S-Tracking", () => {
  it("hạn cũ còn dài ⇒ tính từ hạn cũ; đã quá hạn ⇒ từ ngày nhận tiền (giờ VN)", () => {
    expect(hanMongDoi({ currentExpiryDate: "2026-12-01", paidAt: "2026-11-05T02:00:00Z", monthsCount: 6 })).toBe("2027-06-01");
    expect(hanMongDoi({ currentExpiryDate: "2026-10-01", paidAt: "2026-11-04T18:00:00Z", monthsCount: 3 })).toBe("2027-02-05");
    expect(hanMongDoi({ newExpiryDate: "2027-05-01", monthsCount: 6 })).toBe("2027-05-01");
    expect(hanMongDoi({ monthsCount: 6 })).toBeNull();
  });
  it("đổi hạn = vượt hạn cũ VÀ ≥ mong đợi − 3 ngày", () => {
    const r = { currentExpiryDate: "2026-12-01", paidAt: "2026-11-05T02:00:00Z", monthsCount: 6 };
    expect(daDoiHan(r, "2027-05-29")).toBe(true);
    expect(daDoiHan(r, "2027-05-28")).toBe(false);
    expect(daDoiHan(r, "2026-12-01")).toBe(false);
    expect(daDoiHan(r, null)).toBe(false);
    expect(daDoiHan({ monthsCount: 6 }, "2030-01-01")).toBe(false); // không tính được ⇒ không đoán
  });
});

describe("giaHanCuaTau — 3 bước", () => {
  const nhanTien = { status: "pending_extension" as const, paidAt: "2026-11-05T01:00:00Z", currentExpiryDate: "2026-11-01", monthsCount: 6 };
  it("bước 1: chờ CK khi QR còn hạn; QR hết hạn ⇒ không có", () => {
    expect(giaHanCuaTau([yc({ qrExpiresAt: "2026-11-06T00:00:00Z" })], MAY, null, NOW)?.buoc).toBe(1);
    expect(giaHanCuaTau([yc({ qrExpiresAt: "2026-11-04T00:00:00Z" })], MAY, null, NOW)).toBeNull();
  });
  it("bước 2: đã nhận tiền, hoặc SDVICO báo xong mà hạn chưa đổi", () => {
    expect(giaHanCuaTau([yc(nhanTien)], MAY, "2026-11-01", NOW)).toMatchObject({ loai: "dang-gia-han", buoc: 2 });
    const bao = yc({ ...nhanTien, status: "extended", extendedAt: "2026-11-05T02:00:00Z" });
    expect(giaHanCuaTau([bao], MAY, "2026-11-01", NOW)?.loai).toBe("dang-gia-han");
  });
  it("bước 3: S-Tracking đổi hạn — kể cả khi CRM còn pending_extension; hết hiện sau 7 ngày", () => {
    expect(giaHanCuaTau([yc(nhanTien)], MAY, "2027-05-05", NOW)).toMatchObject({ loai: "xong", buoc: 3, hanMoi: "2027-05-05" });
    expect(giaHanCuaTau([yc(nhanTien)], MAY, "2027-05-05", NOW + 8 * 86_400_000)).toBeNull();
  });
  it("lệch: nhận tiền quá 48 giờ mà hạn chưa đổi", () => {
    expect(giaHanCuaTau([yc({ ...nhanTien, paidAt: "2026-11-02T00:00:00Z" })], MAY, "2026-11-01", NOW)?.loai).toBe("lech");
  });
  it("yêu cầu của máy khác (serial khác) không dính", () => {
    expect(giaHanCuaTau([yc({ ...nhanTien, serialNumber: "S9" })], MAY, "2026-11-01", NOW)).toBeNull();
  });
});

describe("yeuCauDangMo — chặn tạo trùng", () => {
  it("bước 1/2/lệch ⇒ chặn; bước 3 hoặc không có ⇒ cho tạo", () => {
    expect(yeuCauDangMo([yc({})], MAY, null, NOW)?.requestCode).toBe("GH-1");
    const nhanTien = yc({ status: "pending_extension", paidAt: "2026-11-05T01:00:00Z", currentExpiryDate: "2026-11-01", monthsCount: 6 });
    expect(yeuCauDangMo([nhanTien], MAY, "2026-11-01", NOW)).not.toBeNull();
    expect(yeuCauDangMo([nhanTien], MAY, "2027-05-05", NOW)).toBeNull();
    expect(yeuCauDangMo([], MAY, null, NOW)).toBeNull();
  });
});

describe("xacNhanGiaHan — màn Yêu cầu", () => {
  const bao = yc({ status: "extended", extendedAt: "2026-11-05T01:00:00Z", currentExpiryDate: "2026-11-01", paidAt: "2026-11-05T00:00:00Z", monthsCount: 6 });
  it("đã đổi / chờ / lệch / không đối chiếu", () => {
    expect(xacNhanGiaHan(bao, "2027-05-05", NOW)).toBe("da-xac-nhan");
    expect(xacNhanGiaHan(bao, "2026-11-01", NOW)).toBe("cho-xac-nhan");
    expect(xacNhanGiaHan(bao, "2026-11-01", NOW + 3 * 86_400_000)).toBe("lech");
    expect(xacNhanGiaHan(bao, undefined, NOW)).toBe("khong-doi-chieu");
    expect(xacNhanGiaHan(yc({}), "2027-01-01", NOW)).toBeNull();
  });
  it("nhãn không nói 'xong' khi chưa đổi hạn", () => {
    expect(renewalExtendedView("da-xac-nhan").tone).toBe("ok");
    expect(renewalExtendedView("cho-xac-nhan").tone).toBe("warn");
    expect(renewalExtendedView("lech").tone).toBe("danger");
    expect(renewalStatusView("extended").label).not.toMatch(/xong/);
  });
});

describe("chonYeuCauDong — cron tự đóng khi S-Tracking đổi hạn", () => {
  const p = {
    requestCode: "GH-7",
    phone: "0901234567",
    serialNumber: "S1",
    vesselCode: "BV-1234-TS",
    monthsCount: 6,
    currentExpiryDate: "2026-11-01",
    paidAt: "2026-11-05T01:00:00Z",
  };
  it("đóng khi hạn đúng serial đã đổi; giữ khi chưa đổi / không có máy / thiếu serial", () => {
    const may = new Map([["S1", { het_han: "2027-05-05", ten_tau: "BV-1234-TS" }]]);
    expect(chonYeuCauDong([p], may)).toEqual([
      { requestCode: "GH-7", serialNumber: "S1", newExpiryDate: "2027-05-05", phone: "0901234567", tenTau: "BV-1234-TS" },
    ]);
    expect(chonYeuCauDong([p], new Map([["S1", { het_han: "2026-11-01", ten_tau: null }]]))).toEqual([]);
    expect(chonYeuCauDong([p], new Map())).toEqual([]);
    expect(chonYeuCauDong([{ ...p, serialNumber: null }], may)).toEqual([]);
  });
});
