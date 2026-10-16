import { describe, expect, it } from "vitest";

import { parseSpokenCoordPair, soChuThanhSo } from "@/lib/parse-coord";

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

describe("số đọc bằng chữ (chạy thử 2026-10-16)", () => {
  it.each([
    ["muoi bon", "14"],
    ["ba muoi tu", "34"],
    ["hai muoi mot", "21"],
    ["muoi lam", "15"],
    ["muoi", "10"],
    ["nam muoi", "50"],
    ["mot tram le chin", "109"],
    ["mot tram linh tu", "104"],
    ["mot tram hai muoi", "120"],
    ["mot tram", "100"],
    ["muoi bon ba muoi tu", "14 34"],
  ])("%s ⇒ %s", (c, so) => expect(soChuThanhSo(c)).toBe(so));
  it("chữ nước đôi giữ nguyên khi không đứng cạnh số", () => {
    expect(soChuThanhSo("34 phut nam")).toBe("34 phut nam");
    expect(soChuThanhSo("di tu cang")).toBe("di tu cang");
    expect(soChuThanhSo("khong di")).toBe("khong di");
    expect(soChuThanhSo("nam do")).toBe("5 do");
  });
  it("toạ độ đọc toàn bằng chữ", () =>
    near(
      parseSpokenCoordPair("mười bốn độ ba mươi tư phút bắc một trăm lẻ chín độ bốn phút đông"),
      14 + 34 / 60,
      109 + 4 / 60,
    ));
  it("trộn chữ và số", () => near(parseSpokenCoordPair("9 độ hai mươi phút bắc 108 độ hai mươi mốt phút đông"), 9 + 20 / 60, 108 + 21 / 60));
  it("'năm' trước 'phút' / 'mươi' là số", () =>
    near(parseSpokenCoordPair("mười lăm độ năm phút bắc một trăm lẻ chín độ năm mươi phút đông"), 15 + 5 / 60, 109 + 50 / 60));
});
