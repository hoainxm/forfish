import { describe, it, expect } from "vitest";
import { SEA_STATE, cangDuBaoGanNhat } from "@/lib/sea";

describe("cangDuBaoGanNhat — thẻ Biển hôm nay ở Trang chủ", () => {
  it("cảng nhà Nha Trang ⇒ cảng dự báo Hòn Rớ", () => {
    expect(cangDuBaoGanNhat({ lat: 12.25, lon: 109.19 })?.id).toBe("hon-ro");
  });
  it("xa mọi cảng dự báo quá 150 km ⇒ null (không đưa biển nơi khác làm biển của bà con)", () => {
    expect(cangDuBaoGanNhat({ lat: 8.68, lon: 106.6 })).toBeNull(); // Côn Đảo — ~190 km tới Vũng Tàu
    expect(cangDuBaoGanNhat({ lat: 8.68, lon: 106.6 }, 400)?.id).toBe("vung-tau");
  });
  it("chữ tình trạng biển là MÔ TẢ, không phán đi/không đi", () => {
    for (const v of Object.values(SEA_STATE)) {
      expect(v).toMatch(/^Biển /);
      expect(v).not.toMatch(/đi được|không nên|ra khơi/i);
    }
  });
});
