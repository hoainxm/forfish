// SDVICO trực khách trên SDFish (14 §3.14, 0072) — nhận biết hỏi mua, sản phẩm, lời trực, phiếu, tin nhắn KD.
import { describe, expect, it } from "vitest";
import { canTruc, duongPhieu, kiemPhieu, laHoiMua, loiTruc, timSanPham, tinNhanKd } from "@/lib/sdvico/khach-hoi";
import { laNoiBo } from "@/lib/kairos/types";

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

describe("lời trực + thẻ phiếu", () => {
  it("gọi tên, xin thông tin qua phiếu riêng — KHÔNG xin số công khai trong chữ", () => {
    const t = loiTruc("Năm Giã", { title: "Giám sát hành trình Viettel S-Tracking" });
    expect(t.startsWith("@Năm Giã ")).toBe(true);
    expect(t).toContain("chạm thẻ dưới");
    expect(t).toContain("số tàu");
    expect(t).toContain("cảng");
  });
  it("đường phiếu là đường nội bộ hợp lệ", () => {
    const u = duongPhieu("gsht-viettel-s-tracking", "6f1c2a8e-1111-4222-8333-944455556666", null);
    expect(u).toBe("/kairos/hoi-mua?sp=gsht-viettel-s-tracking&p=6f1c2a8e-1111-4222-8333-944455556666");
    expect(laNoiBo(u)).toBe(true);
    expect(laNoiBo("//evil.com/x")).toBe(false);
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
