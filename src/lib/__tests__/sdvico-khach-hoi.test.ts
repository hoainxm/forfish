// SDVICO trực khách trên SDFish (14 §3.14, 0072) — nhận biết hỏi mua, sản phẩm, lời trực, phiếu, tin nhắn KD.
import { describe, expect, it } from "vitest";
import { canTruc, kiemPhieu, laHoiMua, timSanPham, tinNhanKd } from "@/lib/sdvico/khach-hoi";
import { docKetQuaTuVan, docSoTau, loiTuVan, promptTuVan, soDuoi, timCang } from "@/lib/sdvico/tu-van.mjs";

describe("nhận biết khách hỏi", () => {
  it.each([
    ["thiết bị giám sát hành trình giá bao nhiêu vậy", "gsht-viettel-s-tracking"],
    ["thuraya mua ở đâu bà con", "thuraya-marine-star-mnb-01"],
    ["muốn lắp máy lọc nước biển cho tàu thì sao", "may-loc-nuoc-bien-sea"],
    ["phu gia adnano con hang ko", "phu-gia-adnano"],
  ])("'%s' ⇒ trực, sản phẩm %s", (cau, sp) => {
    expect(laHoiMua(cau)).toBe(true);
    expect(canTruc(cau)?.sp?.id).toBe(sp);
  });
  it("hỏi trong luồng có nhắc SDVICO, câu không nêu tên sản phẩm ⇒ lấy sản phẩm từ ngữ cảnh", () => {
    const r = canTruc("giá nhiêu vậy ae", "bên SDVICO có thiết bị giám sát hành trình Viettel S-Tracking lắp tận bến");
    expect(r?.sp?.id).toBe("gsht-viettel-s-tracking");
  });
  it("không hỏi mua / không dính SDVICO ⇒ không trực", () => {
    expect(canTruc("thuraya xài ngoài khơi ổn ghê")).toBeNull();
    expect(canTruc("cá nục giá bao nhiêu hôm nay")).toBeNull();
    expect(timSanPham("trời mưa dữ")).toBeNull();
  });
});

describe("phiếu khách — đủ SĐT, số tàu, cảng mới nhận", () => {
  const du = { ten: "Anh Tư", phone: "0905 123 456", soTau: "QNg-90123-TS", cang: "Sa Huỳnh", sanPham: "gsht-viettel-s-tracking" };
  it("đủ ⇒ nhận, SĐT chuẩn hoá, sản phẩm thành tên", () => {
    const r = kiemPhieu(du);
    expect(r.ok && r.value).toMatchObject({ phone: "0905123456", sanPham: "Giám sát hành trình Viettel S-Tracking", nguon: "kairos" });
  });
  it.each([
    [{ ...du, phone: "123" }, "sai_sdt"],
    [{ ...du, soTau: "" }, "thieu_so_tau"],
    [{ ...du, cang: " " }, "thieu_cang"],
    [{ ...du, ten: "" }, "thieu_ten"],
    [{ ...du, nguon: "zalo" }, "sai_nguon"],
    [{ ...du, loiNhan: "x".repeat(501) }, "qua_dai"],
  ])("%j ⇒ %s", (raw, code) => expect(kiemPhieu(raw)).toEqual({ ok: false, code }));
  it("tin nhắn KD có đủ SĐT, số tàu, cảng, link bình luận", () => {
    const r = kiemPhieu({ ...du, loiNhan: "lắp gấp trước Tết" });
    if (!r.ok) throw new Error("phiếu hỏng");
    const t = tinNhanKd({ ...r.value, createdAt: "2026-10-25T03:00:00Z" }, "https://forfish.vercel.app/kairos/p/x#bl-y");
    for (const s of ["0905123456", "QNg-90123-TS", "Sa Huỳnh", "lắp gấp trước Tết", "#bl-y", "Viettel S-Tracking"]) expect(t).toContain(s);
  });
});

describe("tư vấn bằng Claude — luật + tách thông tin", () => {
  it("prompt: vai tư vấn, xưng em, KHÔNG hỏi SĐT, KHÔNG báo giá, hỏi số tàu + cảng", () => {
    const p = promptTuVan([], "0939 243 222");
    expect(p).toContain("xưng \"em\"");
    expect(p).toContain("KHÔNG hỏi số điện thoại");
    expect(p).toContain("KHÔNG báo giá");
    expect(p).toContain("SỐ TÀU và CẢNG MUỐN LẮP");
  });
  it.each([
    ["Dạ máy này lọc nước biển ra nước ngọt ngay trên tàu anh ạ. Tàu anh số mấy để em ghi lại nha?", null],
    ["Giá tầm 15 triệu anh ơi", "co_gia"],
    ["dạ 2.500.000đ một bộ", "co_gia"],
    ["anh cho em xin sđt nha", "hoi_sdt"],
    ["em gọi anh số 0905123456 nha", "co_sdt"],
    ["xem ở https://sdvico.vn", "co_link"],
    ["Gấp thì anh gọi 0939 243 222 nha", null],
  ])("'%s' ⇒ %s", (body, loi) => expect(loiTuVan(body)).toBe(loi));
  it("tách số tàu nhiều kiểu gõ", () => {
    expect(docSoTau("tàu tui BĐ-91234-TS nha")).toBe("BĐ-91234-TS");
    expect(docSoTau("so tau bd 91234 ts")).toBe("BD-91234-TS");
    expect(docSoTau("QNg90123TS")).toBe("Qng-90123-TS");
    expect(docSoTau("chưa có số")).toBeNull();
  });
  it("tìm cảng trong danh mục, khớp dài nhất", () => {
    expect(timCang("lắp ở Sa Huỳnh luôn em", ["Sa Huỳnh", "Huỳnh"])).toBe("Sa Huỳnh");
    expect(timCang("lap o sa huynh", ["Sa Huỳnh"])).toBe("Sa Huỳnh");
    expect(timCang("chưa biết", ["Sa Huỳnh"])).toBeNull();
  });
  it("đọc kết quả Claude, bỏ phần tử hỏng; số đuôi chỉ 3 số", () => {
    expect(docKetQuaTuVan([{ id: "a", body: " dạ ", soTau: "", cang: "Sa Huỳnh" }, { id: 1 }, "x"])).toEqual([{ id: "a", body: "dạ", soTau: null, cang: "Sa Huỳnh" }]);
    expect(soDuoi("0905123456")).toBe("456");
  });
});
