import { describe, expect, it } from "vitest";
import { parseFineMaxVnd } from "@/lib/fines";
import { FINES } from "@/data/fines";

describe("parseFineMaxVnd", () => {
  it("lấy cận trên với đơn vị tỷ", () => {
    expect(parseFineMaxVnd("800 triệu – 1 tỷ đồng")).toBe(1_000_000_000);
  });

  it("đơn vị chỉ ở số cuối → áp cho cận trên", () => {
    expect(parseFineMaxVnd("300 – 500 triệu đồng")).toBe(500_000_000);
    expect(parseFineMaxVnd("2 – 10 triệu đồng")).toBe(10_000_000);
  });

  it("hai đơn vị khác nhau → lấy số tiền lớn nhất", () => {
    expect(parseFineMaxVnd("500 nghìn – 5 triệu đồng")).toBe(5_000_000);
    expect(parseFineMaxVnd("10 – 200 triệu đồng")).toBe(200_000_000);
  });

  it("không đọc được → 0", () => {
    expect(parseFineMaxVnd("")).toBe(0);
    expect(parseFineMaxVnd("tùy hành vi")).toBe(0);
  });

  it("mọi mục FINES đều ra số dương (không lọt mục lệch định dạng)", () => {
    for (const f of FINES) {
      expect(parseFineMaxVnd(f.rangeVnd), f.id).toBeGreaterThan(0);
    }
  });
});
