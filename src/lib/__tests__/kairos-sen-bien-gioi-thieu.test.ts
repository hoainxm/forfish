// Sen Biển giới thiệu Kairos + app mỗi ngày (anh Long 2026-10-24).
import { describe, expect, it } from "vitest";
import { CHU_DE, chonChuDe, DAI_TOI_DA, KHONG_LAP_NGAY, loiBai, promptGioiThieu } from "@/lib/kairos/sen-bien-gioi-thieu.mjs";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const ngay = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("kho chủ đề", () => {
  it("id không trùng, mỗi chủ đề có dữ kiện và bài mẫu", () => {
    expect(new Set(CHU_DE.map((c) => c.id)).size).toBe(CHU_DE.length);
    for (const c of CHU_DE) {
      expect(c.duKien.length).toBeGreaterThan(0);
      expect(c.mau.length).toBeGreaterThan(0);
    }
  });
  it("MỌI bài mẫu tự qua kiểm (đăng được khi Claude hỏng) và gọi đủ \"Sen Biển\"/bà con", () => {
    for (const c of CHU_DE) {
      expect(loiBai(c.mau), c.id).toBeNull();
      expect(c.mau).toMatch(/bà con/i);
    }
  });
  it("không hứa tính năng chưa có (nhắn tin riêng, livestream, gọi video)", () => {
    const tat = CHU_DE.flatMap((c) => [...c.duKien, c.mau]).join(" ").toLowerCase();
    for (const cam of ["nhắn tin", "livestream", "gọi video", "kết bạn"]) expect(tat).not.toContain(cam);
  });
});

describe("chonChuDe — xoay vòng, không lặp trong 10 ngày", () => {
  it("bỏ chủ đề đã đăng gần đây", () => {
    const daDung = CHU_DE.slice(0, CHU_DE.length - 1).map((c) => ({ id: c.id, at: ngay(1) }));
    expect(chonChuDe(daDung, NOW, () => 0).id).toBe(CHU_DE[CHU_DE.length - 1].id);
  });
  it("đăng quá KHONG_LAP_NGAY ngày thì được đăng lại", () => {
    const daDung = CHU_DE.map((c, i) => ({ id: c.id, at: ngay(i === 0 ? KHONG_LAP_NGAY + 1 : 1) }));
    expect(chonChuDe(daDung, NOW, () => 0).id).toBe(CHU_DE[0].id);
  });
  it("đã đăng hết trong 10 ngày ⇒ lấy chủ đề đăng LÂU NHẤT; sổ hỏng ⇒ vẫn chọn được", () => {
    const daDung = CHU_DE.map((c, i) => ({ id: c.id, at: ngay(i === 3 ? 9 : 1) }));
    expect(chonChuDe(daDung, NOW).id).toBe(CHU_DE[3].id);
    expect(CHU_DE.map((c) => c.id)).toContain(chonChuDe(null as never, NOW).id);
  });
});

describe("loiBai — kiểm trước khi đăng", () => {
  const ok = "Chào bà con, Sen Biển đây! Ở Kairos bà con đọc tin biển, kể chuyện nghề, hỏi nhau kinh nghiệm mỗi ngày nghen.";
  it("bài thường qua", () => expect(loiBai(ok)).toBeNull());
  it("ngắn / dài / link / hashtag / emoji / không phải chữ ⇒ lỗi có mã", () => {
    expect(loiBai("Chào bà con")).toBe("qua_ngan");
    expect(loiBai("a".repeat(DAI_TOI_DA + 1))).toBe("qua_dai");
    expect(loiBai(`${ok} Xem https://abc.vn`)).toBe("co_link");
    expect(loiBai(`${ok} #kairos`)).toBe("co_hashtag");
    expect(loiBai(`${ok} 🐟`)).toBe("co_emoji");
    expect(loiBai(42)).toBe("khong_phai_chu");
  });
  it("tên nước ngoài cho Biển Đông / Hoàng Sa ⇒ chặn", () => {
    expect(loiBai(`${ok} Tàu ra South China Sea đánh cá.`)).toBe("chu_quyen");
  });
});

describe("promptGioiThieu", () => {
  it("mang đủ dữ kiện của chủ đề và luật chỉ dùng dữ kiện", () => {
    const c = CHU_DE[0];
    const p = promptGioiThieu(c);
    for (const d of c.duKien) expect(p).toContain(d);
    expect(p).toMatch(/CHỈ dùng các DỮ KIỆN/);
  });
});
