import { describe, expect, it } from "vitest";
import { canHoi, khoaSo, conTreo, DIEU_KHOAN_BAN, docSo, ghiVaoSo, lucHopLe } from "@/lib/dieu-khoan";

describe("đồng ý điều khoản — sổ trong máy", () => {
  it("khách lạ (không SĐT) không bị hỏi", () => {
    expect(canHoi({}, null)).toBe(false);
    expect(canHoi({}, "  ")).toBe(false);
  });

  it("tài khoản chưa đồng ý ⇒ hỏi; đồng ý bản hiện hành ⇒ thôi hỏi", () => {
    expect(canHoi({}, "0901234567")).toBe(true);
    const so = ghiVaoSo({}, "0901234567", "2026-11-05T01:00:00.000Z", false);
    expect(canHoi(so, "0901234567")).toBe(false);
    // cùng số, viết kiểu +84 vẫn là một người
    expect(canHoi(so, "+84901234567")).toBe(false);
    // người khác dùng chung máy vẫn bị hỏi
    expect(canHoi(so, "0912345678")).toBe(true);
  });

  it("đồng ý bản CŨ ⇒ hỏi lại khi có bản mới", () => {
    const so = ghiVaoSo({}, "0901234567", "2026-11-05T01:00:00.000Z", true, "2026-01-01");
    expect(canHoi(so, "0901234567", DIEU_KHOAN_BAN)).toBe(true);
  });

  it("sổ hỏng / sai khuôn ⇒ coi như chưa đồng ý (không bao giờ tự cho là đã đồng ý)", () => {
    expect(docSo("{hỏng")).toEqual({});
    expect(docSo("[1,2]")).toEqual({});
    expect(docSo(JSON.stringify({ "0901234567": { ban: 1 } }))).toEqual({});
    expect(docSo(null)).toEqual({});
  });

  it("đọc lại đúng thứ đã ghi, chỉ mục chưa gửi nằm trong hàng chờ", () => {
    let so = ghiVaoSo({}, "0901234567", "2026-11-05T01:00:00.000Z", false);
    so = ghiVaoSo(so, "0912345678", "2026-11-05T02:00:00.000Z", true);
    const lai = docSo(JSON.stringify(so));
    expect(lai).toEqual(so);
    expect(conTreo(lai).map((t) => t.phone)).toEqual(["0901234567"]);
  });
});

describe("đồng ý điều khoản — khoá sổ", () => {
  it("SĐT các kiểu viết về một khoá; tên đăng nhập admin giữ chữ", () => {
    expect(khoaSo("+84 901 234 567")).toBe("0901234567");
    expect(khoaSo("0901234567")).toBe("0901234567");
    expect(khoaSo("AdminTong")).toBe("admintong");
    expect(khoaSo(null)).toBeNull();
  });
});

describe("đồng ý điều khoản — mốc client ở máy chủ", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  it("nhận mốc hợp lệ, chuẩn về ISO", () => {
    expect(lucHopLe("2026-11-05T08:00:00+07:00", now)).toBe("2026-11-05T01:00:00.000Z");
  });
  it("chặn mốc rác / trước khi luật có hiệu lực / ở tương lai xa", () => {
    expect(lucHopLe(123, now)).toBeNull();
    expect(lucHopLe("không phải ngày", now)).toBeNull();
    expect(lucHopLe("2025-12-31T00:00:00Z", now)).toBeNull();
    expect(lucHopLe("2026-11-07T12:00:00Z", now)).toBeNull();
  });
});
