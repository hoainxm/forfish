// Điểm trên bờ → cảng gần nhất (lib/tren-bo.ts, 2026-11-08). Ca thật: định vị ở TP.HCM.
import { describe, it, expect } from "vitest";
import { cangGanNhatSatBien, kmToiVungBien, namTrenBo, CANG_TOI_BIEN_KM, TREN_BO_KM } from "@/lib/tren-bo";
import { PORTS } from "@/data/ports";
import { FISHING_PORTS } from "@/data/fishing-ports";

const CANGS = [
  ...PORTS.map((p) => ({ ten: p.name, lat: p.lat, lon: p.lon })),
  ...FISHING_PORTS.filter((p) => p.active && p.lat != null && p.lng != null).map((p) => ({ ten: p.name, lat: p.lat!, lon: p.lng! })),
];

describe("kmToiVungBien / namTrenBo", () => {
  it("giữa biển = 0, không bao giờ trên bờ", () => {
    expect(kmToiVungBien({ lat: 13, lon: 110.5 })).toBe(0);
    expect(namTrenBo({ lat: 19.9, lon: 106.4 })).toBe(false);
  });

  it("TP.HCM (ảnh lỗi 10°47'35\"B 106°38'27\"Đ), Cần Thơ (sông sâu nhưng xa biển), Hà Nội: trên bờ", () => {
    expect(namTrenBo({ lat: 10.7931, lon: 106.6408 })).toBe(true);
    expect(namTrenBo({ lat: 10.03, lon: 105.78 })).toBe(true);
    expect(namTrenBo({ lat: 21.03, lon: 105.85 })).toBe(true);
  });

  it("mọi cảng dự báo (PORTS) và Tam Quang KHÔNG bị coi là trên bờ", () => {
    for (const p of PORTS) expect(kmToiVungBien(p), p.name).toBeLessThanOrEqual(CANG_TOI_BIEN_KM);
    expect(namTrenBo({ lat: 15.36, lon: 108.73 })).toBe(false);
  });

  it(`ngưỡng trên bờ (${TREN_BO_KM} km) ≥ ngưỡng cảng (${CANG_TOI_BIEN_KM} km) — cảng thay không bao giờ tự thành "trên bờ"`, () => {
    expect(TREN_BO_KM).toBeGreaterThanOrEqual(CANG_TOI_BIEN_KM);
  });

  it("toạ độ hỏng ⇒ Infinity, không ném", () => {
    expect(kmToiVungBien({ lat: Number.NaN, lon: 106 })).toBe(Infinity);
  });
});

describe("cangGanNhatSatBien", () => {
  it("TP.HCM ⇒ một cảng sát biển, cách < 120 km", () => {
    const r = cangGanNhatSatBien({ lat: 10.7931, lon: 106.6408 }, CANGS);
    expect(r).not.toBeNull();
    expect(r!.km).toBeLessThan(120);
    expect(kmToiVungBien(r!.cang)).toBeLessThanOrEqual(CANG_TOI_BIEN_KM);
  });

  it("cảng toạ độ sai (nằm sâu trong đất) bị bỏ qua dù gần nhất", () => {
    const r = cangGanNhatSatBien({ lat: 21.03, lon: 105.85 }, [
      { ten: "Sai", lat: 21.0, lon: 105.8 },
      { ten: "Cát Bà", lat: 20.72, lon: 107.06 },
    ]);
    expect(r?.cang.ten).toBe("Cát Bà");
    expect(cangGanNhatSatBien({ lat: 21.03, lon: 105.85 }, [{ ten: "Sai", lat: 21.0, lon: 105.8 }])).toBeNull();
  });
});
