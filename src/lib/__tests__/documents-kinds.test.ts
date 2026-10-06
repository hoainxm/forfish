import { describe, expect, it } from "vitest";
import { DOCUMENT_KINDS, kindLabel, kindUsuallyNoExpiry } from "@/lib/documents";

describe("loại giấy theo bộ giấy thật (2026-10-06)", () => {
  it("có giấy đăng ký tàu cá, đứng đầu; đủ an toàn kỹ thuật + giấy phép + ATTP + bảo hiểm", () => {
    const v = DOCUMENT_KINDS.map((k) => k.value);
    expect(v[0]).toBe("dang_ky_tau");
    for (const k of [
      "dang_kiem",
      "giay_phep_khai_thac",
      "an_toan_thuc_pham",
      "bao_hiem",
    ] as const)
      expect(v).toContain(k);
  });
  it("giá trị cũ `dang_kiem` giữ nguyên, tên hiện khớp tiêu đề giấy", () => {
    expect(kindLabel("dang_kiem")).toMatch(/an toàn kỹ thuật/i);
  });
  it("chỉ giấy đăng ký là thường không thời hạn", () => {
    expect(kindUsuallyNoExpiry("dang_ky_tau")).toBe(true);
    expect(kindUsuallyNoExpiry("dang_kiem")).toBe(false);
    expect(kindUsuallyNoExpiry("giay_phep_khai_thac")).toBe(false);
  });
});
