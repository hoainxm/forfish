import { describe, expect, it } from "vitest";
import {
  CANG_TIM_DUOC,
  cauKhongThay,
  docToaDoNhanh,
  nhanToaDo,
  timCang,
  timDiemLuu,
  TOI_DA_CANG,
  TOI_DA_CANG_GOI_Y,
  TOI_DA_DIEM,
} from "@/lib/ban-do-tim";
import { PORT_COORD_SAI } from "@/data/fishing-ports";
import type { SavedPlace } from "@/lib/places";

describe("ban-do-tim — ô Đi đâu? (BD-02)", () => {
  it("chỉ đưa ra cảng có toạ độ tin được", () => {
    expect(CANG_TIM_DUOC.length).toBeGreaterThan(50);
    for (const c of CANG_TIM_DUOC) {
      expect(PORT_COORD_SAI.has(c.id)).toBe(false);
      expect(Number.isFinite(c.lat) && Number.isFinite(c.lon)).toBe(true);
    }
  });

  it("gõ không dấu vẫn ra cảng: 'nha trang' ⇒ cảng ở Nha Trang / Khánh Hòa", () => {
    const kq = timCang("nha trang");
    expect(kq.length).toBeGreaterThan(0);
    expect(kq.length).toBeLessThanOrEqual(TOI_DA_CANG);
    expect(kq.some((c) => c.id === "hon-ro")).toBe(true);
  });

  it("gõ tên tỉnh cũng lọc được, tối đa 8", () => {
    const kq = timCang("khanh hoa");
    expect(kq.length).toBeGreaterThan(0);
    expect(kq.length).toBeLessThanOrEqual(TOI_DA_CANG);
    expect(kq.every((c) => c.phu === "Khánh Hòa")).toBe(true);
  });

  it("tỉnh nhà lên trước khi cùng khớp", () => {
    const kq = timCang("c", "Khánh Hòa");
    expect(kq[0].phu).toBe("Khánh Hòa");
  });

  it("chưa gõ: ≤6 cảng tỉnh nhà; chưa có tỉnh ⇒ 6 cảng loại I", () => {
    const nha = timCang("", "Khánh Hòa");
    expect(nha.length).toBeGreaterThan(0);
    expect(nha.length).toBeLessThanOrEqual(TOI_DA_CANG_GOI_Y);
    expect(nha.every((c) => c.phu === "Khánh Hòa")).toBe(true);
    const loaiI = timCang("");
    expect(loaiI.length).toBeGreaterThan(0);
    expect(loaiI.length).toBeLessThanOrEqual(TOI_DA_CANG_GOI_Y);
    expect(loaiI.some((c) => c.id === "phan-thiet")).toBe(true);
  });

  it("không khớp ⇒ rỗng, câu một dòng", () => {
    expect(timCang("zzzz")).toEqual([]);
    expect(cauKhongThay(" zzzz ")).toBe("Không thấy “zzzz”");
  });

  const places: SavedPlace[] = [
    { id: "b", name: "Bãi gà", lat: 10.1, lon: 108.2, kind: "spot" },
    { id: "a", name: "Hòn Rớ", lat: 12.2, lon: 109.2, kind: "home" },
    { id: "c", name: "Gò cá hố", lat: 10.3, lon: 108.9, kind: "spot" },
  ];

  it("điểm đã lưu: cảng nhà lên đầu, lọc bỏ dấu, ≤5", () => {
    const tatCa = timDiemLuu("", places);
    expect(tatCa[0].id).toBe("a");
    expect(tatCa[0].phu).toBe("Cảng nhà");
    expect(tatCa.length).toBeLessThanOrEqual(TOI_DA_DIEM);
    expect(timDiemLuu("ca ho", places).map((p) => p.id)).toEqual(["c"]);
    expect(timDiemLuu("", [])).toEqual([]);
    const nhieu = Array.from({ length: 9 }, (_, i) => ({ ...places[0], id: `p${i}`, name: `Điểm ${i}` }));
    expect(timDiemLuu("", nhieu)).toHaveLength(TOI_DA_DIEM);
  });

  it("toạ độ gõ nhanh: phẩy/chấm đều đọc, ngoài phạm vi ⇒ null", () => {
    expect(docToaDoNhanh("10.52, 108.21")).toEqual({ lat: 10.52, lon: 108.21 });
    expect(docToaDoNhanh("10,52 108,21")).toEqual({ lat: 10.52, lon: 108.21 });
    expect(docToaDoNhanh("nha trang")).toBeNull();
    expect(docToaDoNhanh("95, 108")).toBeNull();
    expect(docToaDoNhanh("10")).toBeNull();
    expect(nhanToaDo(10.52, 108.21)).toBe("Đến 10,52 · 108,21");
  });
});
