import { describe, expect, it } from "vitest";
import { KEO_LAM_MOI, nguongKeo, trangThaiKeo } from "@/lib/kairos/keo-lam-moi";

describe("kairos keo-lam-moi — ngưỡng theo cỡ chữ", () => {
  it("rem 16 ⇒ 72px; rem 20 (chữ to) ⇒ 90px", () => {
    expect(nguongKeo(16)).toBe(KEO_LAM_MOI * 16);
    expect(nguongKeo(16)).toBe(72);
    expect(nguongKeo(20)).toBe(90);
  });

  it("cỡ lạ ⇒ coi 16", () => {
    expect(nguongKeo(NaN)).toBe(72);
    expect(nguongKeo(0)).toBe(72);
    expect(nguongKeo(-4)).toBe(72);
  });

  it("trạng thái: nghỉ / kéo / thả, theo đúng ngưỡng từng cỡ chữ", () => {
    expect(trangThaiKeo(0, 72)).toBe("nghi");
    expect(trangThaiKeo(-5, 72)).toBe("nghi");
    expect(trangThaiKeo(71, 72)).toBe("keo");
    expect(trangThaiKeo(72, 72)).toBe("tha");
    // 80px đủ ở rem 16 nhưng CHƯA đủ ở rem 20 (lỗi cũ so hằng 16)
    expect(trangThaiKeo(80, nguongKeo(16))).toBe("tha");
    expect(trangThaiKeo(80, nguongKeo(20))).toBe("keo");
    expect(trangThaiKeo(90, nguongKeo(20))).toBe("tha");
  });
});
