import { describe, it, expect } from "vitest";
import {
  RENEWAL_MONTH_OPTIONS,
  isValidRenewalMonths,
  renewalMonthsLabel,
  renewalTotal,
  renewalStatusView,
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
  it("đã gia hạn xong = ok", () => {
    expect(renewalStatusView("extended")).toEqual({
      label: "Đã gia hạn xong",
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
