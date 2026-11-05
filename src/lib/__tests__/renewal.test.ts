import { describe, it, expect } from "vitest";
import {
  RENEWAL_MONTH_OPTIONS,
  isValidRenewalMonths,
  renewalMonthsLabel,
  renewalTotal,
  renewalStatusView,
  chuanMaTau,
  chonTauStracking,
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

describe("chuanMaTau", () => {
  it("bỏ khoảng trắng + chữ hoa; rỗng/null → ''", () => {
    expect(chuanMaTau(" bv-1234 -ts ")).toBe("BV-1234-TS");
    expect(chuanMaTau(null)).toBe("");
  });
});

describe("giaHanCuaTau — yêu cầu đang chạy của một tàu", () => {
  it("chờ CK khi QR còn hạn; QR hết hạn → coi như không có", () => {
    const con = [yc({ qrExpiresAt: "2026-11-06T00:00:00Z" })];
    expect(giaHanCuaTau(con, "bv-1234-ts", null, NOW)?.loai).toBe("cho-ck");
    const het = [yc({ qrExpiresAt: "2026-11-04T00:00:00Z" })];
    expect(giaHanCuaTau(het, "BV-1234-TS", null, NOW)).toBeNull();
  });

  it("đã nhận tiền → cho-gia-han", () => {
    expect(giaHanCuaTau([yc({ status: "pending_extension" })], "BV-1234-TS", null, NOW)?.loai).toBe("cho-gia-han");
  });

  it("SDVICO báo đã gia hạn ≠ xong: chờ S-Tracking đổi hạn; đổi rồi mới hết báo", () => {
    const r = [yc({ status: "extended", newExpiryDate: "2027-05-01", extendedAt: "2026-11-05T01:00:00Z" })];
    expect(giaHanCuaTau(r, "BV-1234-TS", "2026-11-01", NOW)).toEqual({
      loai: "cho-xac-nhan",
      requestCode: "GH-1",
      hanMoi: "2027-05-01",
    });
    expect(giaHanCuaTau(r, "BV-1234-TS", "2027-05-01", NOW)).toBeNull();
    // S-Tracking có máy nhưng chưa có ngày ⇒ chưa xác nhận được
    expect(giaHanCuaTau(r, "BV-1234-TS", null, NOW)?.loai).toBe("cho-xac-nhan");
  });

  it("quá 48 giờ mà S-Tracking chưa đổi ⇒ lech", () => {
    const r = [yc({ status: "extended", newExpiryDate: "2027-05-01", extendedAt: "2026-11-02T00:00:00Z" })];
    expect(giaHanCuaTau(r, "BV-1234-TS", "2026-11-01", NOW)?.loai).toBe("lech");
  });

  it("chỉ xét yêu cầu MỚI NHẤT của đúng tàu; huỷ/tàu khác → null", () => {
    const r = [
      yc({ requestCode: "GH-2", status: "cancelled" }),
      yc({ requestCode: "GH-1", status: "pending_extension" }),
    ];
    expect(giaHanCuaTau(r, "BV-1234-TS", null, NOW)).toBeNull();
    expect(giaHanCuaTau([yc({ status: "pending_extension" })], "BV-9999-TS", null, NOW)).toBeNull();
    expect(giaHanCuaTau([yc({})], "", null, NOW)).toBeNull();
  });
});

describe("yeuCauDangMo — chặn tạo trùng", () => {
  it("chờ CK / chờ gia hạn → chặn; đã gia hạn xong → cho tạo tiếp", () => {
    expect(yeuCauDangMo([yc({})], "BV-1234-TS", NOW)?.requestCode).toBe("GH-1");
    expect(yeuCauDangMo([yc({ status: "pending_extension" })], "BV-1234-TS", NOW)).not.toBeNull();
    expect(yeuCauDangMo([], "BV-1234-TS", NOW)).toBeNull();
  });

  it("tàu S-Tracking: SDVICO báo xong mà hạn chưa đổi ⇒ VẪN chặn; đổi rồi ⇒ cho tạo", () => {
    const r = [yc({ status: "extended", newExpiryDate: "2027-05-01", extendedAt: "2026-11-05T01:00:00Z" })];
    expect(yeuCauDangMo(r, "BV-1234-TS", NOW, "2026-11-01")).not.toBeNull();
    expect(yeuCauDangMo(r, "BV-1234-TS", NOW, "2027-05-01")).toBeNull();
  });

  it("tàu tự khai (không đối chiếu được) ⇒ extended coi như xong", () => {
    expect(yeuCauDangMo([yc({ status: "extended", newExpiryDate: "2027-05-01" })], "BV-1234-TS", NOW)).toBeNull();
  });
});

describe("xacNhanGiaHan — đối chiếu hạn S-Tracking", () => {
  it("không có newExpiryDate ⇒ mốc = ngày gia hạn (giờ VN) + số tháng, dung sai 3 ngày", () => {
    const r = yc({ status: "extended", extendedAt: "2026-11-04T18:00:00Z", monthsCount: 6 }); // 05/11 giờ VN
    expect(hanMongDoi(r)).toBe("2027-05-05");
    expect(xacNhanGiaHan(r, "2027-05-02", NOW)).toBe("da-xac-nhan");
    expect(xacNhanGiaHan(r, "2027-05-01", NOW)).toBe("cho-xac-nhan");
  });
  it("tàu không có trên S-Tracking ⇒ khong-doi-chieu; trạng thái khác extended ⇒ null", () => {
    expect(xacNhanGiaHan(yc({ status: "extended" }), undefined, NOW)).toBe("khong-doi-chieu");
    expect(xacNhanGiaHan(yc({}), "2027-01-01", NOW)).toBeNull();
  });
  it("nhãn màn Yêu cầu không nói 'đã gia hạn xong' khi chưa xác nhận", () => {
    expect(renewalExtendedView("da-xac-nhan").tone).toBe("ok");
    expect(renewalExtendedView("cho-xac-nhan").tone).toBe("warn");
    expect(renewalExtendedView("lech").tone).toBe("danger");
    expect(renewalStatusView("extended").label).not.toMatch(/xong/);
  });
});

describe("chonTauStracking — máy chủ thay dữ liệu máy khách bằng S-Tracking", () => {
  const rows = [
    { serial: "S1", ten_tau: "BV-1234-TS", chu_tau: "Nguyễn A" },
    { serial: "S2", ten_tau: "QNg-555-TS", chu_tau: null },
  ];
  it("ưu tiên serial, rồi mã tàu (không phân biệt hoa/khoảng trắng)", () => {
    expect(chonTauStracking(rows, { maTau: "BV-1234-TS", serial: "S2" })?.serial).toBe("S2");
    expect(chonTauStracking(rows, { maTau: "bv-1234-ts" })?.serial).toBe("S1");
  });
  it("serial lạ + mã lạ → null (tàu tự khai)", () => {
    expect(chonTauStracking(rows, { maTau: "KH-1-TS", serial: "X" })).toBeNull();
    expect(chonTauStracking([], { maTau: "BV-1234-TS" })).toBeNull();
  });
});
