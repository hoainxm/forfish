import { describe, expect, it } from "vitest";
import { dayAnhCho, docIdDiem, KHOA_CHO, laAnhCho } from "../hai-do/anh-diem";

describe("ảnh điểm — khoá + docId", () => {
  it("docId hợp luật route ảnh ([A-Za-z0-9_-]{1,64})", () => {
    const d = docIdDiem("12.064,109.713");
    expect(d).toBe("diem_12_064_109_713");
    expect(/^[A-Za-z0-9_-]{1,64}$/.test(d)).toBe(true);
    expect(docIdDiem("x".repeat(200))).toHaveLength(64);
  });
  it("phân biệt khoá kho chờ với path máy chủ", () => {
    expect(laAnhCho(`${KHOA_CHO}abc`)).toBe(true);
    expect(laAnhCho("0900000778/diem_1/a.jpg")).toBe(false);
  });
  it("không có ảnh chờ ⇒ không đổi gì (null), không ném", async () => {
    expect(await dayAnhCho([{ id: "1,1", name: "A", lat: 1, lon: 1, kind: "spot", anh: ["0900/diem_1/a.jpg"] }])).toBeNull();
    expect(await dayAnhCho([])).toBeNull();
  });
});
