// Đọc giấy tờ tàu từ ảnh (ADR 0017, 2026-10-26) — luật thuần: kiểm JSON máy nhà, điền form, câu nhắc.
import { describe, expect, it } from "vitest";
import { ANH_DOC_GIAY, apDungKqDocGiay, cauKetQuaDoc, cauLoiDoc, coTheThuLai, kiemKqDocGiay, loiKhongPhanHoi, ngayHopLe } from "@/lib/doc-giay";
import { chuoiKy, dauKy, DUONG_GIAY } from "@/lib/sen-bien/cong-ai-ky";

describe("ngayHopLe", () => {
  it("YYYY-MM-DD thật, năm 2000–2050 ⇒ giữ; ngày giả / dạng khác / rác ⇒ null", () => {
    expect(ngayHopLe("2027-03-11")).toBe("2027-03-11");
    expect(ngayHopLe(" 2027-03-11 ")).toBe("2027-03-11");
    expect(ngayHopLe("2027-02-31")).toBeNull();
    expect(ngayHopLe("11/03/2027")).toBeNull(); // máy nhà đã chuẩn hoá ISO — máy bà con không nhận dạng khác
    expect(ngayHopLe("1999-12-31")).toBeNull();
    expect(ngayHopLe("2051-01-01")).toBeNull();
    expect(ngayHopLe(null)).toBeNull();
    expect(ngayHopLe(20270311)).toBeNull();
  });
});

describe("kiemKqDocGiay — không tin thứ đi qua mạng", () => {
  it("JSON đúng (khoá snake_case của máy nhà) ⇒ KqDocGiay", () => {
    expect(kiemKqDocGiay({ loai: "giay_phep_khai_thac", so: "2024/GPKT-BĐ-01573", ngay_cap: "2024-03-12", het_han: "2027-03-11", ten_tau: "BĐ 97345 TS" })).toEqual({
      loai: "giay_phep_khai_thac",
      so: "2024/GPKT-BĐ-01573",
      ngayCap: "2024-03-12",
      hetHan: "2027-03-11",
      tenTau: "BĐ 97345 TS",
    });
  });
  it("loại lạ ⇒ khac; ô rác ⇒ null; hết hạn ≤ ngày cấp ⇒ bỏ hết hạn; không phải object ⇒ null", () => {
    expect(kiemKqDocGiay({ loai: "giấy lạ", so: "<script>", ngay_cap: "x", het_han: null, ten_tau: 5 })).toEqual({ loai: "khac", so: null, ngayCap: null, hetHan: null, tenTau: null });
    expect(kiemKqDocGiay({ loai: "bao_hiem", ngay_cap: "2026-01-01", het_han: "2025-12-31" })!.hetHan).toBeNull();
    expect(kiemKqDocGiay(null)).toBeNull();
    expect(kiemKqDocGiay([])).toBeNull();
    expect(kiemKqDocGiay("x")).toBeNull();
  });
});

describe("apDungKqDocGiay — điền ô, nhớ ô nào máy điền / máy thay", () => {
  const trong = { kind: "dang_kiem" as const, number: "", issuedOn: "", expiresOn: "" };
  it("form trống: điền hết ô máy đọc được; loại khac không đổi loại đã chọn", () => {
    const kq = { loai: "giay_phep_khai_thac" as const, so: "123", ngayCap: "2024-03-12", hetHan: "2027-03-11", tenTau: null };
    const r = apDungKqDocGiay(trong, kq);
    expect(r.form).toEqual({ kind: "giay_phep_khai_thac", number: "123", issuedOn: "2024-03-12", expiresOn: "2027-03-11" });
    // loại giấy luôn có sẵn (select mặc định) ⇒ máy đổi nó là "thay", ba ô trống là "điền"
    expect(r.daDien).toEqual(["number", "issuedOn", "expiresOn"]);
    expect(r.daDoi).toEqual(["kind"]);
    expect(apDungKqDocGiay(trong, { ...kq, loai: "khac" }).form.kind).toBe("dang_kiem");
  });
  it("ô đã có mà khác ⇒ đè nhưng ghi vào daDoi; giống ⇒ không tính; máy không đọc được ⇒ giữ của bà con", () => {
    const co = { kind: "bao_hiem" as const, number: "cũ", issuedOn: "2024-01-01", expiresOn: "2026-01-01" };
    const r = apDungKqDocGiay(co, { loai: "bao_hiem", so: "mới", ngayCap: null, hetHan: "2026-01-01", tenTau: null });
    expect(r.form).toEqual({ kind: "bao_hiem", number: "mới", issuedOn: "2024-01-01", expiresOn: "2026-01-01" });
    expect(r.daDien).toEqual([]);
    expect(r.daDoi).toEqual(["number"]);
  });
});

describe("câu nhắc — luôn bảo xem lại", () => {
  it("không ô nào ⇒ ghi tay; có ô nhưng thiếu hạn ⇒ nhắc ghi hạn; đủ ⇒ xem lại rồi Lưu", () => {
    expect(cauKetQuaDoc([], [], null)).toMatch(/ghi tay/);
    expect(cauKetQuaDoc(["kind", "number"], [], null)).toMatch(/loại giấy, số giấy.*Chưa thấy ngày hết hạn/);
    expect(cauKetQuaDoc(["expiresOn"], ["number"], "2027-03-11")).toMatch(/ngày hết hạn, số giấy.*xem lại.*Lưu/);
  });
  it("mỗi mã lỗi một câu đời thường, không mã kỹ thuật", () => {
    for (const loi of ["mat_song", "mang_yeu", "chua_dang_nhap", "qua_lon", "khong_doc_duoc", "may_nha_tat", "timeout", "rate_limited", "chua_noi"] as const) {
      const c = cauLoiDoc(loi);
      expect(c.length).toBeGreaterThan(20);
      expect(c).not.toMatch(/[_]|50\d|timeout/i);
    }
  });
});

describe("ký đường /gw/v1/forfish/giay", () => {
  it("dauKy với DUONG_GIAY ký đúng đường đó (sai đường là 401 bên máy nhà)", () => {
    const h = dauKy({ loai: "hmac", khoa: "k".repeat(43) }, "tb-" + "a".repeat(24), '{"anh":"x"}', 1760000000000, "0".repeat(32), DUONG_GIAY);
    expect(DUONG_GIAY).toBe("/gw/v1/forfish/giay");
    expect(h["x-forlife-sig"]).toBeTruthy();
    expect(chuoiKy({ ts: "1760000000000", nonce: "0".repeat(32), method: "POST", duong: DUONG_GIAY, nguoi: "tb-" + "a".repeat(24), khachThue: "forfish-thue-bao", body: '{"anh":"x"}' })).toContain("/gw/v1/forfish/giay");
  });
});

describe("sửa 2026-10-26 — máy nhà đã đọc xong mà điện thoại báo 'Cần có sóng'", () => {
  it("không phản hồi mà máy vẫn báo có mạng ⇒ MẠNG YẾU, không phải mất sóng", () => {
    expect(loiKhongPhanHoi(true)).toBe("mang_yeu");
    expect(loiKhongPhanHoi(false)).toBe("mat_song");
    expect(cauLoiDoc("mang_yeu")).not.toMatch(/mất sóng|có sóng/i);
  });
  it("lỗi mạng / máy bận ⇒ có nút Thử lại; ảnh không đọc được / quá nặng / chưa đăng nhập ⇒ không (phải chụp lại / đăng nhập)", () => {
    for (const l of ["mang_yeu", "mat_song", "timeout", "may_nha_tat", "chua_noi", "rate_limited"] as const) expect(coTheThuLai(l)).toBe(true);
    for (const l of ["khong_doc_duoc", "qua_lon", "chua_dang_nhap"] as const) expect(coTheThuLai(l)).toBe(false);
  });
  it("câu lỗi chỉ việc tiếp theo (Thử lại / chụp lại), không đẩy về gõ tay", () => {
    for (const l of ["mang_yeu", "mat_song", "timeout", "may_nha_tat"] as const) {
      expect(cauLoiDoc(l)).toMatch(/Thử lại/);
      expect(cauLoiDoc(l)).not.toMatch(/ghi tay/);
    }
  });
  it("ảnh gửi ĐỌC nhỏ hơn ảnh lưu nhiều (1280px, ≤450 KB)", () => {
    expect(ANH_DOC_GIAY.maxDim).toBe(1280);
    expect(ANH_DOC_GIAY.targetBytes).toBeLessThanOrEqual(450 * 1024);
  });
});
