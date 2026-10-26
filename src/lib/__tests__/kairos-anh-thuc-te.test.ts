// Ảnh thực tế cho agent Kairos (16 §4 2f): chỉ ảnh đã duyệt, trần + khoảng cách, agent cố định theo ảnh, luật ghi nguồn SDVICO.
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
    expect(anhDaDuyet(index).map((a) => a.id)).toEqual(["cccccccccccccccc", "aaaaaaaaaaaaaaaa"]);
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
  it("agent người kể, cố định theo id ảnh", () => {
    const a = chonAgentAnh(anh);
    expect(a.vai).toBe("ke");
    expect(chonAgentAnh(anh).id).toBe(a.id);
  });
  it("prompt mang ghi chú trong thẻ dữ liệu + luật ghi nguồn SDVICO, không nhận ảnh mình", () => {
    const p = promptAnh(chonAgentAnh(anh), anh);
    expect(p).toContain("<ghi_chu>Bến cá Tịnh Kỳ");
    expect(p).toContain("SDVICO");
    expect(p).toMatch(/KHÔNG nói mình chụp/);
  });
  it("loiAnhThucTe: thiếu SDVICO / nhận là ảnh mình chụp ⇒ lỗi; ghi nguồn đúng ⇒ null", () => {
    expect(loiAnhThucTe("Ảnh anh em SDVICO đi thực tế ở bến Tịnh Kỳ gửi về, bà con thấy sao?")).toBeNull();
    expect(loiAnhThucTe("Ảnh bến Tịnh Kỳ sáng nay")).toBe("anh_thieu_nguon");
    expect(loiAnhThucTe("SDVICO: tui mới chụp ở bến sáng nay")).toBe("anh_nhan_cua_minh");
    expect(loiAnhThucTe("Mình vừa chụp, ảnh SDVICO")).toBe("anh_nhan_cua_minh");
  });
});
