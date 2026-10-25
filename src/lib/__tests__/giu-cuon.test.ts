import { describe, expect, it } from "vitest";
import { catCuon, docCuon, khoaCuon, TIEN_TO_CUON, type KhoCuon } from "@/lib/giu-cuon";

function khoGia(): KhoCuon & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("giu-cuon — giữ chỗ cuộn /tau ↔ /nguoi trong sessionStorage", () => {
  it("khoá theo đường dẫn, không dùng tiền tố forfish.*", () => {
    expect(khoaCuon("/tau")).toBe(`${TIEN_TO_CUON}/tau`);
    expect(khoaCuon("/tau").startsWith("forfish.")).toBe(false);
  });

  it("cất rồi đọc lại đúng số, làm tròn, hai đường dẫn không lẫn", () => {
    const kho = khoGia();
    catCuon(kho, "/tau", 612.6);
    catCuon(kho, "/nguoi", 40);
    expect(docCuon(kho, "/tau")).toBe(613);
    expect(docCuon(kho, "/nguoi")).toBe(40);
    expect(docCuon(kho, "/tien")).toBeNull();
  });

  it("số âm / NaN không cất; giá trị hỏng trong kho ⇒ null", () => {
    const kho = khoGia();
    catCuon(kho, "/tau", -5);
    catCuon(kho, "/tau", Number.NaN);
    expect(docCuon(kho, "/tau")).toBeNull();
    kho.map.set(khoaCuon("/tau"), "abc");
    expect(docCuon(kho, "/tau")).toBeNull();
  });

  it("kho ném lỗi (private mode / đầy) ⇒ không ném ra ngoài", () => {
    const hong: KhoCuon = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(() => catCuon(hong, "/tau", 10)).not.toThrow();
    expect(docCuon(hong, "/tau")).toBeNull();
  });
});
