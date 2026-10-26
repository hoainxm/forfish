// Xuất trình giấy tờ cho cán bộ (ADR 0017, rà UI 2026-10-26) — thứ tự giấy, chữ chip hạn, dòng nhận diện tàu.
import { describe, expect, it } from "vitest";
import type { BoatDocument } from "@/lib/documents";
import { chuHanXuatTrinh, dongTauXuatTrinh, thuTuXuatTrinh } from "@/lib/xuat-trinh";

const g = (id: string, kind: BoatDocument["kind"], label: string, expiresOn?: string): BoatDocument => ({ id, kind, label, expiresOn });
const HOM_NAY = new Date("2026-10-26T03:00:00Z"); // 10:00 giờ VN

describe("thuTuXuatTrinh", () => {
  it("theo bộ giấy bà con mang theo, cùng loại theo tên; không đổi mảng gốc", () => {
    const ds = [g("a", "bao_hiem", "Bảo hiểm"), g("b", "khac", "Khác"), g("c", "dang_ky_tau", "Đăng ký"), g("d", "giay_phep_khai_thac", "Phép"), g("e", "dang_kiem", "Đăng kiểm")];
    expect(thuTuXuatTrinh(ds).map((d) => d.id)).toEqual(["c", "e", "d", "a", "b"]);
    expect(ds[0].id).toBe("a");
    expect(thuTuXuatTrinh([g("y", "khac", "Ý"), g("x", "khac", "Ân")]).map((d) => d.id)).toEqual(["x", "y"]);
  });
});

describe("chuHanXuatTrinh — ngày trước, số ngày sau", () => {
  it("không hạn ⇒ none", () => {
    expect(chuHanXuatTrinh(g("a", "dang_ky_tau", "x"), HOM_NAY)).toEqual({ muc: "none", text: "Không thời hạn" });
  });
  it("quá hạn / hôm nay ⇒ expired; ≤30 ngày ⇒ soon; xa ⇒ ok", () => {
    expect(chuHanXuatTrinh(g("a", "bao_hiem", "x", "2026-10-20"), HOM_NAY)).toEqual({ muc: "expired", text: "Hết hạn 20/10/2026 · đã quá 6 ngày" });
    expect(chuHanXuatTrinh(g("a", "bao_hiem", "x", "2026-10-26"), HOM_NAY)).toEqual({ muc: "expired", text: "Hết hạn 26/10/2026 · hôm nay" });
    expect(chuHanXuatTrinh(g("a", "bao_hiem", "x", "2026-11-10"), HOM_NAY)).toEqual({ muc: "soon", text: "Hết hạn 10/11/2026 · còn 15 ngày" });
    expect(chuHanXuatTrinh(g("a", "bao_hiem", "x", "2027-03-11"), HOM_NAY).muc).toBe("ok");
  });
});

describe("dongTauXuatTrinh", () => {
  it("tên + mã, thiếu gì bỏ nấy", () => {
    expect(dongTauXuatTrinh("Phước Lộc", "BĐ-97345-TS")).toBe("Tàu Phước Lộc · BĐ-97345-TS");
    expect(dongTauXuatTrinh("Phước Lộc")).toBe("Tàu Phước Lộc");
    expect(dongTauXuatTrinh(undefined, " BĐ-1-TS ")).toBe("BĐ-1-TS");
    expect(dongTauXuatTrinh("  ", "")).toBe("Giấy tờ tàu");
  });
});
