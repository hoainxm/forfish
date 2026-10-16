import { describe, expect, it } from "vitest";

import { parseSpokenCoordPair } from "@/lib/parse-coord";

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
