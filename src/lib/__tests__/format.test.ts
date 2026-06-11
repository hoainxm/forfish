import { describe, expect, it } from "vitest";
import {
  formatDigits,
  formatVnDate,
  formatVnd,
  parseDigits,
  parseVnd,
  readbackVnd,
} from "@/lib/format";

describe("formatVnDate", () => {
  it("đổi ISO sang dd/mm/yyyy", () => {
    expect(formatVnDate("2026-06-11")).toBe("11/06/2026");
  });
  it("chuỗi hỏng trả nguyên, rỗng trả rỗng", () => {
    expect(formatVnDate("2026-06")).toBe("2026-06");
    expect(formatVnDate("")).toBe("");
  });
});

describe("formatVnd / parseVnd", () => {
  it("chấm nghìn kiểu VN", () => {
    expect(formatVnd(12_500_000)).toBe("12.500.000 đ");
  });
  it("parseVnd bỏ mọi ký tự không phải số", () => {
    expect(parseVnd("12.500.000 đ")).toBe(12_500_000);
    expect(parseVnd("")).toBe(0);
  });
});

describe("formatDigits — hiển thị khi đang gõ ô tiền", () => {
  it("chèn chấm nghìn", () => {
    expect(formatDigits("12500000")).toBe("12.500.000");
    expect(formatDigits("45000000")).toBe("45.000.000");
  });
  it("rỗng giữ rỗng (không hiện 0 khi chưa gõ)", () => {
    expect(formatDigits("")).toBe("");
  });
  it("số nhỏ không chấm", () => {
    expect(formatDigits("500")).toBe("500");
  });
});

describe("parseDigits — lọc input về chuỗi số thô", () => {
  it("bỏ chấm, chữ, ký hiệu", () => {
    expect(parseDigits("12.500.000 đ")).toBe("12500000");
    expect(parseDigits("abc")).toBe("");
  });
  it("cap 12 chữ số — chặn lỗi dính phím thành nghìn tỷ", () => {
    expect(parseDigits("12345678901234567")).toBe("123456789012");
  });
  it("round-trip với formatDigits", () => {
    expect(parseDigits(formatDigits("45000000"))).toBe("45000000");
  });
});

describe("readbackVnd — dòng đọc-lại chống thừa/thiếu số 0", () => {
  it("≥ 1 triệu thì đọc thành triệu đồng", () => {
    expect(readbackVnd(45_000_000)).toBe("45 triệu đồng");
    expect(readbackVnd(1_000_000)).toBe("1 triệu đồng");
  });
  it("lẻ triệu lấy 1 số thập phân, dấu phẩy kiểu VN", () => {
    expect(readbackVnd(12_500_000)).toBe("12,5 triệu đồng");
  });
  it("dưới 1 triệu im lặng (null) — không lải nhải số nhỏ", () => {
    expect(readbackVnd(999_999)).toBeNull();
    expect(readbackVnd(0)).toBeNull();
  });
});
