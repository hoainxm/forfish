import { describe, it, expect } from "vitest";
import { TITLE_DUP_WINDOW_MS, foldVi, isDupTitle, normalizeUrl, titleNorm, urlHash } from "@/lib/kairos/lien-ket.mjs";
import { TOPICS, hasFishKeyword, isTopic, topicFor } from "@/lib/kairos/chu-de.mjs";
import { foldVn } from "@/lib/market/text";

describe("lien-ket — foldVi khớp foldVn (máy thu tin và máy chủ băm như nhau)", () => {
  it.each(["Đà Nẵng", "  Bà Rịa – Vũng Tàu ", "ĐỨC LONG", "Thuỷ sản 2026!", "Khánh Hoà", "tàu cá QNg-90123", ""])("%s", (s) => {
    expect(foldVi(s)).toBe(foldVn(s));
  });
});

describe("lien-ket — chuẩn hoá link", () => {
  it("bỏ utm/fbclid, #, /amp, www, http ⇒ https, host thường, / cuối", () => {
    const a = normalizeUrl("http://WWW.VnExpress.net/tau-ca-1234.html?utm_source=fb&fbclid=x#binh-luan");
    const b = normalizeUrl("https://vnexpress.net/tau-ca-1234.html");
    expect(a).toBe(b);
    expect(normalizeUrl("https://tuoitre.vn/bai-viet/amp")).toBe("https://tuoitre.vn/bai-viet");
    expect(normalizeUrl("https://thanhnien.vn/a/")).toBe("https://thanhnien.vn/a");
  });
  it("giữ tham số thật, xếp thứ tự ổn định", () => {
    expect(normalizeUrl("https://x.vn/a?b=2&a=1")).toBe(normalizeUrl("https://x.vn/a?a=1&b=2"));
    expect(normalizeUrl("https://x.vn/a?id=1")).not.toBe(normalizeUrl("https://x.vn/a?id=2"));
  });
  it("link hỏng / không phải http ⇒ null", () => {
    for (const s of ["", "javascript:alert(1)", "ftp://x.vn/a", "không phải link", "https://" + "a".repeat(1000)]) {
      expect(normalizeUrl(s)).toBeNull();
      expect(urlHash(s)).toBeNull();
    }
  });
  it("băm sha256 hex, cùng link chuẩn hoá cùng băm", () => {
    const h = urlHash("https://vnexpress.net/a.html?utm_medium=x");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(urlHash("http://www.vnexpress.net/a.html"));
  });
});

describe("lien-ket — trùng tiêu đề 7 ngày", () => {
  const now = Date.parse("2026-10-23T00:00:00Z");
  it("bỏ tiền tố [Video]/Clip:, bỏ dấu; quá ngắn ⇒ null", () => {
    expect(titleNorm("[Video] Ngư dân Quảng Ngãi trúng đậm cá ngừ")).toBe(titleNorm("Ngư dân Quảng Ngãi trúng đậm cá ngừ"));
    expect(titleNorm("Clip: Ngư dân Quảng Ngãi trúng đậm cá ngừ")).toBe("ngu dan quang ngai trung dam ca ngu");
    expect(titleNorm("Tin vắn")).toBeNull();
  });
  it("trong 7 ngày ⇒ trùng; quá 7 ngày ⇒ không", () => {
    const n = titleNorm("Ngư dân Quảng Ngãi trúng đậm cá ngừ");
    expect(isDupTitle(n, [{ titleNorm: n, firstSeenAt: now - 6 * 86_400_000 }], now)).toBe(true);
    expect(isDupTitle(n, [{ titleNorm: n, firstSeenAt: now - TITLE_DUP_WINDOW_MS - 1 }], now)).toBe(false);
    expect(isDupTitle(null, [{ titleNorm: null, firstSeenAt: now }], now)).toBe(false);
  });
});

describe("chu-de — gắn chủ đề", () => {
  it("mã khớp check của 0065", () => {
    expect([...TOPICS]).toEqual(["nghe-ca", "thoi-su", "phap-luat", "doi-song", "the-thao", "giai-tri", "kinh-te"]);
    expect(isTopic("nghe-ca")).toBe(true);
    expect(isTopic("bao")).toBe(false);
  });
  it.each([
    ["thuy-san", "Giá tôm", "nghe-ca"],
    ["bien-dao", "Lễ hội", "nghe-ca"],
    ["kinh-doanh", "Giá vàng", "kinh-te"],
    ["suc-khoe", "Ăn uống", "doi-song"],
    ["the-gioi", "Bầu cử Mỹ", "thoi-su"],
    ["la", "gì đó", "thoi-su"],
    ["thoi-su", "Cấm biển do bão số 5", "nghe-ca"],
    ["phap-luat", "Xử phạt tàu cá vi phạm IUU", "nghe-ca"],
    ["the-thao", "Đội tuyển ngư dân đá bóng", "the-thao"],
  ])("mục %s + '%s' ⇒ %s", (section, text, topic) => expect(topicFor(section, text)).toBe(topic));
  it("từ khoá theo ranh giới từ", () => {
    expect(hasFishKeyword("Tàu cá mắc cạn")).toBe(true);
    expect(hasFishKeyword("Tàu cánh ngầm")).toBe(false);
  });
});
