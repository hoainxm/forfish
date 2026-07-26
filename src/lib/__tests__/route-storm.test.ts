// Dẫn đường × tin bão — tuyến cắt vùng bão phải bị bắt (an toàn tính mạng).
import { describe, expect, it } from "vitest";

import {
  forecastTrack,
  routeStormConflict,
  sampleRoute,
  STORM_SAFE_RADIUS_KM,
} from "@/lib/route-storm";
import type { StormAlert } from "@/lib/storms";

function storm(over: Partial<StormAlert> = {}): StormAlert {
  return {
    id: "1000123",
    name: "WUTIP",
    kindLabel: "Bão",
    windKmh: 120,
    lat: 18,
    lon: 115,
    alert: "danger",
    updated: "2026-07-26T00:00:00Z",
    track: [],
    areas: [],
    ...over,
  };
}

describe("routeStormConflict", () => {
  it("không có bão → null", () => {
    expect(
      routeStormConflict([{ lat: 12, lon: 109 }, { lat: 13, lon: 110 }], []),
    ).toBeNull();
  });

  it("waypoint trong bán kính 200 km quanh TÂM bão → phạm, kèm đúng con bão", () => {
    // 17°N cách tâm 18°N ~111 km
    const hit = routeStormConflict(
      [{ lat: 16, lon: 115 }, { lat: 17, lon: 115 }],
      [storm()],
    );
    expect(hit).not.toBeNull();
    expect(hit!.storm.name).toBe("WUTIP");
    expect(hit!.distKm).toBeLessThan(STORM_SAFE_RADIUS_KM);
  });

  it("tuyến cách tâm và track quá 200 km → sạch", () => {
    expect(
      routeStormConflict(
        [{ lat: 10, lon: 108 }, { lat: 11, lon: 109 }],
        [storm()],
      ),
    ).toBeNull();
  });

  it("tuyến gần HÀNH LANG TRACK DỰ BÁO (chưa gần tâm) → phạm", () => {
    // track quá khứ→dự báo; tâm hiện tại (18,115), dự báo đi tiếp về (16,117)
    const s = storm({
      track: [
        [113, 18],
        [114, 18],
        [115, 18],
        [116, 17],
        [117, 16],
      ],
    });
    const hit = routeStormConflict(
      [{ lat: 15.5, lon: 117 }, { lat: 16.5, lon: 117.5 }],
      [s],
    );
    expect(hit).not.toBeNull();
  });

  it("track QUÁ KHỨ không chặn — bão đã đi qua", () => {
    const s = storm({
      track: [
        [111, 18],
        [113, 18],
        [115, 18],
      ],
    });
    // (18,111) nằm ĐÈ lên track quá khứ nhưng cách tâm (18,115) ~423 km
    expect(routeStormConflict([{ lat: 18, lon: 111 }], [s])).toBeNull();
  });

  it("điểm nằm TRONG polygon vùng ảnh hưởng → phạm với distKm 0", () => {
    const s = storm({
      lat: 20,
      lon: 120, // tâm xa tuyến >200 km
      areas: [
        [
          // 1 polygon, ring ngoài quanh (10,110)
          [
            [109, 9],
            [111, 9],
            [111, 11],
            [109, 11],
            [109, 9],
          ],
        ],
      ],
    });
    const hit = routeStormConflict([{ lat: 10, lon: 110 }], [s]);
    expect(hit).not.toBeNull();
    expect(hit!.distKm).toBe(0);
  });

  it("chặng dài lọt QUA vùng bão giữa 2 waypoint vẫn bị bắt (chêm điểm)", () => {
    const s = storm({ lat: 12, lon: 112 });
    // 2 đầu mút đều cách tâm ~330 km, đường nối xuyên thẳng qua tâm
    const hit = routeStormConflict(
      [{ lat: 12, lon: 109 }, { lat: 12, lon: 115 }],
      [s],
    );
    expect(hit).not.toBeNull();
  });

  it("nhiều bão → báo con SÁT TUYẾN nhất", () => {
    const far = storm({ id: "a", name: "XA", lat: 13.5, lon: 115 });
    const near = storm({ id: "b", name: "GAN", lat: 12.5, lon: 115 });
    const hit = routeStormConflict([{ lat: 12, lon: 115 }], [far, near]);
    expect(hit!.storm.name).toBe("GAN");
  });
});

describe("forecastTrack", () => {
  it("cắt track tại điểm gần tâm hiện tại nhất, giữ phần về sau", () => {
    const s = storm({
      track: [
        [111, 18],
        [113, 18],
        [115, 18],
        [116, 17],
      ],
    });
    expect(forecastTrack(s)).toEqual([
      { lat: 18, lon: 115 },
      { lat: 17, lon: 116 },
    ]);
  });

  it("track rỗng → mảng rỗng", () => {
    expect(forecastTrack(storm())).toEqual([]);
  });
});

describe("sampleRoute", () => {
  it("chêm điểm mỗi ~25 km, giữ nguyên các waypoint gốc", () => {
    const a = { lat: 12, lon: 109 };
    const b = { lat: 12, lon: 110 }; // ~109 km → chêm 4 điểm
    const pts = sampleRoute([a, b]);
    expect(pts[0]).toEqual(a);
    expect(pts[pts.length - 1]).toEqual(b);
    expect(pts.length).toBeGreaterThan(4);
  });
});
