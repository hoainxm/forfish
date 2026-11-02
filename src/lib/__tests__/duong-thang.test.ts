import { describe, expect, it } from "vitest";
import { choVuongDuongThang, nhanChoVuong } from "@/lib/duong-thang";

const A = { lat: 10, lon: 107 };
const B = { lat: 10, lon: 108 }; // ~110 km về Đông

describe("choVuongDuongThang", () => {
  it("không có lưới ⇒ null (không bịa chỗ vướng)", () => {
    expect(choVuongDuongThang(A, B, null)).toBeNull();
  });
  it("biển thông ⇒ null", () => {
    expect(choVuongDuongThang(A, B, () => 5)).toBeNull();
  });
  it("đảo giữa đường ⇒ chỗ vướng đầu tiên, loại đất", () => {
    const c = choVuongDuongThang(A, B, (_la, lo) => (lo > 107.5 && lo < 107.6 ? 0 : 5));
    expect(c?.loai).toBe("dat");
    expect(c!.lon).toBeGreaterThan(107.5);
    expect(c!.lon).toBeLessThan(107.51);
    expect(nhanChoVuong(c!)).toBe("vướng đất liền hoặc đảo");
  });
  it("đất sát hai đầu (cảng trong lạch) ⇒ bỏ qua", () => {
    expect(choVuongDuongThang(A, B, (_la, lo) => (lo < 107.01 || lo > 107.99 ? 0 : 5))).toBeNull();
  });
  it("rạn và nước <2 m cũng là chỗ vướng", () => {
    expect(choVuongDuongThang(A, B, (_la, lo) => (lo > 107.3 ? 1 : 5))?.loai).toBe("ran");
    expect(choVuongDuongThang(A, B, (_la, lo) => (lo > 107.3 ? 2 : 5))?.loai).toBe("can");
  });
});
