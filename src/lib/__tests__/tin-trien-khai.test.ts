// Tin triển khai SDVICO ⇒ Kairos (2026-10-31): gom đợt ảnh, ngữ cảnh tin nhắn, luật chữ (tiền ⇒ phải duyệt).
import { describe, expect, it } from "vitest";
import { ANH_TOI_DA, CUA_SO_MS, DOI_MS, gomDot, loiTin, nguCanh, promptTin } from "@/lib/kairos/tin-trien-khai.mjs";

const T0 = 1_800_000_000_000;
const anh = (id: string, at: number, o: Record<string, unknown> = {}) => ({
  id: id.padEnd(16, "0"), nhom: "Triển Khai Kinh Doanh", nguoi: "Sdvico Tiến Kd", at, trang_thai: "cho_duyet", ghi_chu: "máy lọc nước trên tàu", ...o,
});

describe("gomDot", () => {
  it("cùng nhóm + cùng người + cách ≤20 phút ⇒ một đợt; đợt chưa xong 15 phút thì chờ", () => {
    const idx = { anh: [anh("a1", T0), anh("a2", T0 + 60_000), anh("a3", T0 + 120_000), anh("b1", T0 + CUA_SO_MS + 200_000)] };
    const now = T0 + CUA_SO_MS + 200_000 + DOI_MS - 1;
    const d = gomDot(idx, new Set(), now);
    expect(d.length).toBe(1); // đợt b chưa đủ 15 phút
    expect(d[0].tatCa.length).toBe(3);
    expect(gomDot(idx, new Set(), now + 2).length).toBe(2);
  });
  it("bỏ ảnh nhóm khác, ảnh 'bo', ảnh đã đăng; tối đa 5 ảnh rải đều; cờ duyệt cả đợt", () => {
    const ds = Array.from({ length: 12 }, (_, i) => anh(`c${i.toString(16)}`, T0 + i * 1000, { trang_thai: "duyet" }));
    const idx = { anh: [...ds, anh("x1", T0, { nhom: "Kế toán SDVICO" }), anh("x2", T0, { trang_thai: "bo" })] };
    const [d] = gomDot(idx, new Set([ds[0].id]), T0 + 3_600_000);
    expect(d.tatCa.length).toBe(11);
    expect(d.ids.length).toBe(ANH_TOI_DA);
    expect(d.duyet).toBe(true);
    const n = gomDot({ anh: [anh("e1", T0, { nhom: "SDVICO Sản xuất-DV Kỹ thuật" })] }, new Set(), T0 + 3_600_000);
    expect(n.length).toBe(1);
  });
});

describe("nguCanh", () => {
  it("tin chữ cùng nhóm ±30 phút, bỏ [ảnh], che SĐT", () => {
    const msgs = { "triển khai kinh doanh": [
      { at: T0 - 10 * 60_000, sender: "Tiến", text: "Giao 4 máy SEA700B lên tàu Quang Hải 27 đi Trường Sa" },
      { at: T0, sender: "Tiến", text: "[ảnh]" },
      { at: T0 + 5 * 60_000, sender: "Nam", text: "gọi 0905123456 nhé" },
      { at: T0 + 3 * 3_600_000, sender: "Nam", text: "chuyện khác" },
    ], "nhóm khác": [{ at: T0, sender: "x", text: "không lấy" }] };
    const d = { nhom: "Triển Khai Kinh Doanh", tu: T0, den: T0 + 60_000 };
    expect(nguCanh(msgs, d)).toEqual(["Tiến: Giao 4 máy SEA700B lên tàu Quang Hải 27 đi Trường Sa", "Nam: gọi [số ĐT] nhé"]);
  });
});

describe("loiTin + promptTin", () => {
  const ok = "SDVICO vừa giao 4 máy lọc nước biển SEA700B lên tàu Quang Hải 27 ra Trường Sa. Đội kỹ thuật đã kiểm máy trước khi cẩu lên tàu.";
  it("bài đúng ⇒ null; dính tiền / SĐT / số tàu / mở 'bà con ơi' ⇒ mã lỗi", () => {
    expect(loiTin(ok)).toBeNull();
    expect(loiTin(ok + " Giá 38 triệu.")).toBe("co_tien");
    expect(loiTin(ok + " Chỉ 4.200.000đ.")).toBe("co_tien");
    expect(loiTin(ok + " Gọi 0905123456.")).toBe("co_sdt");
    expect(loiTin(ok + " Tàu BĐ-90123-TS.")).toBe("co_so_tau");
    expect(loiTin("Bà con ơi! " + ok)).toBe("mo_bai_nham");
    expect(loiTin("ngắn")).toBe("do_dai");
    // "27 đến" không phải số tiền; "giáp" không phải "giá"
    expect(loiTin("SDVICO lắp máy lọc dầu cho 27 đến 30 tàu ở vùng giáp ranh Bình Định, đội kỹ thuật làm tận bến.")).toBeNull();
  });
  it("prompt dặn vào thẳng, cấm giá, gắn cờ nhạy cảm", () => {
    const p = promptTin({ nhom: "Triển Khai Kinh Doanh", tatCa: ["a"], ghiChu: ["máy lọc nước"] }, ["Tiến: giao máy"]);
    expect(p).toContain("KHÔNG mở bằng 'Bà con ơi'");
    expect(p).toContain("KHÔNG ghi giá");
    expect(p).toContain("nhay_cam");
    expect(p).toContain("ro = false");
  });
});
