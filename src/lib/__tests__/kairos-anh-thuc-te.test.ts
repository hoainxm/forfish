// Ảnh thực tế cho agent Kairos (16 §4 2f): chỉ ảnh đã duyệt, trần + khoảng cách, agent cố định theo ảnh; ảnh là ảnh CỦA
// NHÂN VẬT (2026-10-26) — chặn SĐT, số tàu, nhận đã dùng SDVICO, chê hàng khác.
import { describe, expect, it } from "vitest";
import { anhDaDuyet, chonAgentAnh, chonAnh, chuanSoAnh, ghiSoAnh, KHOANG_ANH_MS, loiAnhThucTe, promptAnh, TRAN_ANH_NGAY } from "@/lib/kairos/anh-thuc-te.mjs";

const NOW = Date.parse("2026-10-26T12:00:00Z");
const H = 3_600_000;
const index = {
  phien_ban: 1,
  anh: [
    { id: "aaaaaaaaaaaaaaaa", trang_thai: "duyet", ghi_chu: "Bến cá Tịnh Kỳ, lắp thiết bị giám sát hành trình", chu: "", duyet_luc: 3 },
    { id: "bbbbbbbbbbbbbbbb", trang_thai: "cho_duyet", ghi_chu: "", chu: "chưa duyệt", duyet_luc: null },
    { id: "cccccccccccccccc", trang_thai: "duyet", ghi_chu: "Họp bà con", chu: "", duyet_luc: 1 },
    { id: "dddddddddddddddd", trang_thai: "bo", ghi_chu: "", chu: "", duyet_luc: 2 },
    { id: "../../etc/passwd", trang_thai: "duyet", duyet_luc: 0 },
  ],
};

describe("anhDaDuyet / chonAnh", () => {
  it("chỉ ảnh đã duyệt, id hợp lệ, duyệt sớm trước; index hỏng ⇒ []", () => {
    expect(anhDaDuyet(index).map((a: { id: string }) => a.id)).toEqual(["cccccccccccccccc", "aaaaaaaaaaaaaaaa"]);
    expect(anhDaDuyet(null)).toEqual([]);
    expect(anhDaDuyet({ anh: "x" })).toEqual([]);
  });
  it("chọn ảnh chưa đăng; đủ khoảng cách; chạm trần ngày ⇒ null", () => {
    const ds = anhDaDuyet(index);
    expect(chonAnh(ds, chuanSoAnh(null), NOW)?.id).toBe("cccccccccccccccc");
    const so1 = ghiSoAnh(chuanSoAnh(null), "cccccccccccccccc", NOW - 3 * H);
    expect(chonAnh(ds, so1, NOW)?.id).toBe("aaaaaaaaaaaaaaaa");
    expect(chonAnh(ds, ghiSoAnh(chuanSoAnh(null), "cccccccccccccccc", NOW - KHOANG_ANH_MS + 60_000), NOW)).toBeNull();
    let day = chuanSoAnh(null);
    for (let i = 0; i < TRAN_ANH_NGAY; i++) day = ghiSoAnh(day, `${i}`.repeat(16).slice(0, 16).replace(/\d/g, "e"), NOW - (3 + i * 3) * H);
    expect(chonAnh(ds, day, NOW)).toBeNull();
    expect(chonAnh(ds, ghiSoAnh(so1, "aaaaaaaaaaaaaaaa", NOW - 5 * H), NOW)).toBeNull();
  });
  it("chuanSoAnh bỏ dòng hỏng", () => {
    expect(chuanSoAnh({ da: [{ id: "x", luc: 1 }, { id: "aaaaaaaaaaaaaaaa", luc: 2 }, null] }).da).toEqual([{ id: "aaaaaaaaaaaaaaaa", luc: 2 }]);
  });
});

describe("agent + prompt + luật chữ", () => {
  const anh = anhDaDuyet(index)[1];
  it("agent người kể (không phải người ít nói), cố định theo id ảnh", () => {
    const a = chonAgentAnh(anh);
    expect(a.vai).toBe("ke");
    expect(a.kieuTraoDoi).not.toBe("it-noi");
    expect(chonAgentAnh(anh).id).toBe(a.id);
  });
  it("prompt: ghi chú trong thẻ dữ liệu, ảnh là của nhân vật, mang hồ sơ đời tư; vẫn cấm nhận đã dùng + số liệu bịa", () => {
    const a = chonAgentAnh(anh);
    const p = promptAnh(a, anh);
    expect(p).toContain("<ghi_chu>Bến cá Tịnh Kỳ");
    expect(p).toContain("ẢNH CỦA CHÍNH NHÂN VẬT");
    expect(p).toContain(a.chuyenNha[0]);
    expect(p).toContain(`${a.tuoi} tuổi`);
    expect(p).toMatch(/KHÔNG nói mình đã mua \/ dùng \/ lắp/);
    expect(p).toMatch(/KHÔNG đưa giá, sản lượng/);
    expect(p).not.toMatch(/KHÔNG nói mình chụp/);
  });
  it("loiAnhThucTe: nhận ảnh của mình ⇒ được; lộ SĐT / số tàu, nhận đã dùng SDVICO, chê hàng khác ⇒ lỗi", () => {
    expect(loiAnhThucTe("tui mới chụp ở bến Tịnh Kỳ sáng nay, ghe về đông ghê")).toBeNull();
    expect(loiAnhThucTe("Ảnh bến Tịnh Kỳ sáng nay")).toBeNull();
    expect(loiAnhThucTe("bên SDVICO có cái máy giám sát hành trình nè, ai biết hông")).toBeNull();
    expect(loiAnhThucTe("cần thì gọi 0905 123 456 nha")).toBe("anh_co_sdt");
    expect(loiAnhThucTe("tàu QNg-90123-TS mới lên đà")).toBe("anh_co_so_tau");
    expect(loiAnhThucTe("máy SDVICO tui lắp rồi, chạy ngon")).toBe("nhan_da_dung");
    expect(loiAnhThucTe("hàng SDVICO xịn, đồ dỏm ngoài chợ thua xa")).toBe("che_hang_khac");
  });
});
