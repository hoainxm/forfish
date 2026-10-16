import { describe, expect, it } from "vitest";

import { parseSpokenCoordPair, soBangChu } from "@/lib/parse-coord";

const near = (r: { lat: number; lon: number } | null, lat: number, lon: number) => {
  expect(r).not.toBeNull();
  expect(r!.lat).toBeCloseTo(lat, 3);
  expect(r!.lon).toBeCloseTo(lon, 3);
};

describe("toạ độ nói bằng giọng (Sen Biển)", () => {
  it("độ phút có chữ bắc/đông", () =>
    near(parseSpokenCoordPair("14 độ 34 phút Bắc 109 độ 4 phút Đông"), 14 + 34 / 60, 109 + 4 / 60));
  it("có nhãn vĩ độ / kinh độ", () =>
    near(parseSpokenCoordPair("vĩ độ 14 độ 34 phút kinh độ 109 độ 4 phút"), 14 + 34 / 60, 109 + 4 / 60));
  it("bốn số trơn", () => near(parseSpokenCoordPair("14 34 109 04"), 14 + 34 / 60, 109 + 4 / 60));
  it("thập phân nói 'phẩy'", () => near(parseSpokenCoordPair("14 phẩy 58 và 109 phẩy 45"), 14.58, 109.45));
  it("thập phân dấu phẩy", () => near(parseSpokenCoordPair("toạ độ 14,58 109,45"), 14.58, 109.45));
  it("độ phút giây", () =>
    near(parseSpokenCoordPair("14 độ 34 phút 37 giây bắc 109 độ 4 phút 10 giây đông"), 14 + 34 / 60 + 37 / 3600, 109 + 4 / 60 + 10 / 3600));
  it("ngoài khung biển VN / phút ≥60 / thiếu số ⇒ null (hỏi lại)", () => {
    expect(parseSpokenCoordPair("45 10 109 04")).toBeNull();
    expect(parseSpokenCoordPair("14 75 109 04")).toBeNull();
    expect(parseSpokenCoordPair("14 34 109")).toBeNull();
    expect(parseSpokenCoordPair("dẫn về cảng Sa Huỳnh")).toBeNull();
  });
});

describe("số đọc bằng chữ (bộ nghe trong máy trả chữ, không trả số)", () => {
  it.each([
    ["mười bốn độ ba mươi tư phút", "14 độ 34 phút"],
    ["một trăm lẻ chín độ bốn phút đông", "109 độ 4 phút đông"],
    ["hai mươi mốt độ mười lăm phút", "21 độ 15 phút"],
    ["mười ba phẩy không năm", "13 phẩy 05"],
    ["một trăm linh chín phẩy bốn lăm", "109 phẩy 45"],
  ])("%s → %s", (vao, ra) => expect(soBangChu(vao)).toBe(ra));
  it("'không' đứng một mình là lời từ chối, không phải số 0", () => expect(soBangChu("không")).toBe("không"));
  it("'nam' (hướng) khác 'năm' (5)", () => expect(soBangChu("mười độ nam")).toBe("10 độ nam"));
  it("toạ độ nói bằng chữ đọc ra số", () =>
    near(parseSpokenCoordPair("MƯỜI BỐN ĐỘ BA MƯƠI TƯ PHÚT BẮC MỘT TRĂM LẺ CHÍN ĐỘ BỐN PHÚT ĐÔNG"), 14 + 34 / 60, 109 + 4 / 60));
  it("hai số nguyên trơn không nhãn KHÔNG là toạ độ ('tháng 2 … bd 95')", () =>
    expect(parseSpokenCoordPair("lấy chiếc tàu của thằng hai ra coi bd 95")).toBeNull());
});
