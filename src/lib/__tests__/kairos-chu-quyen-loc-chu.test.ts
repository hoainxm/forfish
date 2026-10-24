import { describe, it, expect } from "vitest";
import { CHU_QUYEN_PROMPT, chuQuyenFlag, chuQuyenFlagAll } from "@/lib/kairos/chu-quyen.mjs";
import { badWordHit, hasBadWords } from "@/lib/kairos/loc-chu";

describe("chu-quyen — dương tính (phải chặn)", () => {
  it.each([
    ["Tensions rise in the South China Sea", "South China Sea"],
    ["south-china sea dispute", "South China Sea"],
    ["Tàu lạ hoạt động ở Biển Nam Trung Hoa", "Biển Nam Trung Hoa"],
    ["Trung Quốc tập trận ở Nam Hải", "Nam Hải"],
    ["Xisha Islands", "Xisha"],
    ["Nansha reef", "Nansha"],
    ["thành phố Sansha", "Sansha"],
    ["quần đảo Tây Sa", "Tây Sa"],
    ["quần đảo Nam Sa", "Nam Sa"],
    ["cái gọi là thành phố Tam Sa", "Tam Sa"],
  ])("%s ⇒ %s", (s, term) => expect(chuQuyenFlag(s)).toBe(term));

  it("Paracel/Spratly theo nghĩa sở hữu của Trung Quốc", () => {
    expect(chuQuyenFlag("China's Paracel Islands")).not.toBeNull();
    expect(chuQuyenFlag("the Spratly Islands of China")).not.toBeNull();
    expect(chuQuyenFlag("Hoàng Sa của Trung Quốc")).not.toBeNull();
    expect(chuQuyenFlag("Trường Sa (Trung Quốc)")).not.toBeNull();
  });

  it("kiểm nhiều trường: tiêu đề sạch, tóm tắt AI chêm cụm sai ⇒ chặn", () => {
    expect(chuQuyenFlagAll("Ngư dân bám biển", "Mô tả sạch", "Tàu ra South China Sea")).toBe("South China Sea");
    expect(chuQuyenFlagAll("a", null, undefined)).toBeNull();
  });
});

describe("chu-quyen — âm tính (không chặn nhầm)", () => {
  it.each([
    "Ngư dân Quảng Ngãi ra khơi ở Hoàng Sa",
    "quần đảo Hoàng Sa, Trường Sa của Việt Nam",
    "Bão trên Biển Đông",
    "Paracel Islands of Vietnam",
    "Tàu Trung Quốc tấn công ngư dân ở Hoàng Sa, Trung Quốc lên tiếng", // tin thật, không sở hữu
    "phường Nam Hải, Hải Phòng",
    "đường Nam Hải ở quận Hải An",
    "phía nam Hải Phòng mưa to",
    "Năm hai nghìn",
    "Tây Sa Pa",
    "",
  ])("%s ⇒ null", (s) => expect(chuQuyenFlag(s)).toBeNull());
});

describe("chu-quyen — prompt bắt buộc", () => {
  it("chứa 'Biển Đông' và 'quần đảo Hoàng Sa, Trường Sa của Việt Nam'", () => {
    expect(CHU_QUYEN_PROMPT).toContain("Biển Đông");
    expect(CHU_QUYEN_PROMPT).toContain("quần đảo Hoàng Sa, Trường Sa của Việt Nam");
  });
});

describe("loc-chu — chữ bậy (chạy ở route)", () => {
  it.each(["địt mẹ mày", "Đéo biết", "đm", "vcl thật", "DCM", "dit me", "đ.ị.t", "lồnnnn", "con cac"])("%s ⇒ bậy", (s) => {
    expect(hasBadWords(s)).toBe(true);
  });

  it.each([
    "uống lon bia",
    "các bác ngư dân",
    "đeo áo phao",
    "cái lớn nhất",
    "hạt óc chó",
    "chó đẻ con",
    "Đụng tàu", // "đụ" phải đứng riêng
    "dịt", // gần giống nhưng khác dấu
    "",
  ])("%s ⇒ sạch", (s) => expect(badWordHit(s)).toBeNull());
});
