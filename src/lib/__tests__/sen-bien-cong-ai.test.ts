// Sen Biển hỏi máy nhà (ADR 0016): công thức ký PHẢI khớp AI Assistant app/core/cong-gw.mjs từng byte — sai là 401.
import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bindOidc, cachKy, chuoiKy, dauKy, DUONG_HOI, KHACH_THUE_TB, kiemCauHoi, kyHmac, maThueBao } from "@/lib/sen-bien/cong-ai-ky";
import { nenHoiMayChu } from "@/lib/sen-bien/hoi-may-chu";

const KHOA = "k".repeat(43);
const T = { ts: "1760000000000", nonce: "0".repeat(32), method: "post", duong: DUONG_HOI, nguoi: "tb-" + "a".repeat(24), khachThue: KHACH_THUE_TB, body: '{"text":"giá dầu"}' };

describe("ký cổng nhà — vector tính độc lập theo spec AI Assistant 10 §2.h", () => {
  // tính lại bằng tay theo spec: ts ⏎ nonce ⏎ METHOD ⏎ duong ⏎ nguoi ⏎ khachThue ⏎ hex sha256(body)
  const tay = [T.ts, T.nonce, "POST", T.duong, T.nguoi, T.khachThue, createHash("sha256").update(T.body).digest("hex")].join("\n");
  it("chuoiKy đúng 7 dòng, METHOD viết hoa", () => {
    expect(chuoiKy(T)).toBe(tay);
  });
  it("HMAC + bind OIDC đúng công thức", () => {
    expect(kyHmac(KHOA, T)).toBe(createHmac("sha256", KHOA).update(tay).digest("hex"));
    expect(bindOidc("a.b.c", T)).toBe(createHash("sha256").update(`a.b.c\n${tay}`).digest("hex"));
  });
  it("dauKy: HMAC mang sig, OIDC mang bind; danh tính + khách thuê nằm trong header được ký", () => {
    const h = dauKy({ loai: "hmac", khoa: KHOA }, T.nguoi, T.body, 1760000000000, T.nonce);
    expect(h["x-forlife-sig"]).toBe(kyHmac(KHOA, { ...T, method: "POST" }));
    expect(h["x-forlife-nguoi"]).toBe(T.nguoi);
    expect(h["x-forlife-khach-thue"]).toBe("forfish-thue-bao");
    const o = dauKy({ loai: "oidc", token: "a.b.c" }, T.nguoi, T.body, 1760000000000, T.nonce);
    expect(o.authorization).toBe("Bearer a.b.c");
    expect(o["x-forlife-bind"]).toBe(bindOidc("a.b.c", T));
    expect(o["x-forlife-sig"]).toBeUndefined();
  });
});

describe("mã thuê bao giả danh", () => {
  it("tb- + 24 hex, ổn định theo người, khác muối ⇒ khác mã; không có muối ⇒ null (không băm trần SĐT)", () => {
    const a = maThueBao("0901234567", "muoi-thu-16-ky-tu");
    expect(a).toMatch(/^tb-[0-9a-f]{24}$/); // = TB_RE bên AI Assistant
    expect(maThueBao("0901234567", "muoi-thu-16-ky-tu")).toBe(a);
    expect(maThueBao("0901234568", "muoi-thu-16-ky-tu")).not.toBe(a);
    expect(maThueBao("0901234567", "muoi-khac-16-ky-tu")).not.toBe(a);
    expect(maThueBao("0901234567", "")).toBeNull();
    expect(maThueBao("84901234567", "muoi-thu-16-ky-tu")).toBeNull();
    expect(a).not.toContain("0901234567");
  });
});

describe("chọn cách ký", () => {
  it("có khoá ⇒ HMAC; ép OIDC hoặc chỉ có token ⇒ OIDC; không có gì / rác ⇒ null (503 chua_noi)", () => {
    expect(cachKy({ FORLIFE_GW_KEY: KHOA }, null)).toEqual({ loai: "hmac", khoa: KHOA });
    expect(cachKy({ FORLIFE_GW_KEY: KHOA, FORLIFE_GW_OIDC: "1" }, "x.y.z")).toEqual({ loai: "oidc", token: "x.y.z" });
    expect(cachKy({}, "x.y.z")).toEqual({ loai: "oidc", token: "x.y.z" });
    expect(cachKy({ VERCEL_OIDC_TOKEN: "p.q.r" }, null)).toEqual({ loai: "oidc", token: "p.q.r" });
    expect(cachKy({ FORLIFE_GW_KEY: "ngan" }, null)).toBeNull();
    expect(cachKy({}, "khong-phai-jwt")).toBeNull();
  });
});

describe("kiểm câu hỏi ở ranh giới", () => {
  it("text 1–300, màn = đường app, cảng ≤40 chữ; lạ ⇒ bỏ ô hoặc null", () => {
    expect(kiemCauHoi({ text: "  chừng nào  có bão ", man: "/tau", cang: "Quảng Ngãi" })).toEqual({ text: "chừng nào có bão", man: "/tau", cang: "Quảng Ngãi" });
    expect(kiemCauHoi({ text: "x", man: "http://evil", cang: "<b>" })).toEqual({ text: "x", man: null, cang: null });
    expect(kiemCauHoi({ text: "" })).toBeNull();
    expect(kiemCauHoi({ text: "a".repeat(301) })).toBeNull();
    expect(kiemCauHoi(null)).toBeNull();
  });
});

describe("nenHoiMayChu — máy trả lời trước, máy nhà chỉ là đường lùi", () => {
  const chuaHieu = { kind: "say" as const, say: "Sen Biển chưa hiểu." };
  it("chỉ hỏi khi máy chưa trả lời thật + có chuỗi + có sóng + câu ≥ 2 chữ", () => {
    expect(nenHoiMayChu(chuaHieu, "giá dầu hôm nay bao nhiêu", true, true)).toBe(true);
    expect(nenHoiMayChu({ ...chuaHieu, daTraLoi: true }, "sóng chỗ này", true, true)).toBe(false);
    expect(nenHoiMayChu({ kind: "stop", say: "Dừng." }, "dừng lại đi", true, true)).toBe(false);
    expect(nenHoiMayChu(chuaHieu, "giá dầu", false, true)).toBe(false);
    expect(nenHoiMayChu(chuaHieu, "giá dầu", true, false)).toBe(false);
    expect(nenHoiMayChu(chuaHieu, "ừ", true, true)).toBe(false);
  });
});
