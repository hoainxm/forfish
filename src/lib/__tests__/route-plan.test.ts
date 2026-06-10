import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOAT,
  KMH_PER_KNOT,
  MAX_DETOUR_RATIO,
  angleDiffDeg,
  bboxFor,
  bearingDeg,
  followingSeaRisk,
  formatHoursVN,
  haversineKm,
  kmToNm,
  planRoute,
  sampleField,
  speedFactor,
  vnHourIndex,
  waveDirFactor,
  windDragFactor,
  type BBox,
  type HourSample,
  type LatLon,
  type WeatherField,
} from "../route-plan";
import { parseWeatherField, fieldGrid } from "../route-weather";
import { DEPTH_META, decodeDepthGrid, depthClassAt } from "../depth-grid";

// ── dựng trường thời tiết giả ────────────────────────────────────────────

const HOURS = 72;

function makeField(
  bbox: BBox,
  n: number,
  at: (lat: number, lon: number) => Partial<HourSample> | "land",
): WeatherField {
  const lats = Array.from(
    { length: n },
    (_, i) => bbox.latMin + ((bbox.latMax - bbox.latMin) * i) / (n - 1),
  );
  const lons = Array.from(
    { length: n },
    (_, j) => bbox.lonMin + ((bbox.lonMax - bbox.lonMin) * j) / (n - 1),
  );
  const cells = [];
  for (const la of lats) {
    for (const lo of lons) {
      const v = at(la, lo);
      if (v === "land") {
        cells.push({
          onSea: false,
          hours: Array.from({ length: HOURS }, () => ({
            waveM: null,
            waveFromDeg: null,
            wavePeriodS: null,
            windKmh: 0,
            windFromDeg: 0,
            currentKmh: 0,
            currentToDeg: null,
          })),
        });
      } else {
        cells.push({
          onSea: true,
          hours: Array.from({ length: HOURS }, () => ({
            waveM: v.waveM ?? 0.3,
            waveFromDeg: v.waveFromDeg ?? null,
            wavePeriodS: v.wavePeriodS ?? null,
            windKmh: v.windKmh ?? 10,
            windFromDeg: v.windFromDeg ?? 0,
            currentKmh: v.currentKmh ?? 0,
            currentToDeg: v.currentToDeg ?? null,
          })),
        });
      }
    }
  }
  return {
    lat0: lats[0],
    lon0: lons[0],
    dLat: lats[1] - lats[0],
    dLon: lons[1] - lons[0],
    nLat: n,
    nLon: n,
    cells,
  };
}

const START: LatLon = { lat: 12.0, lon: 110.0 };
const DEST: LatLon = { lat: 12.0, lon: 112.0 };
const BB = bboxFor(START, DEST, 120);
const calm = () => ({ waveM: 0.3, windKmh: 10 });

function plan(field: WeatherField, a = START, b = DEST, depth = null as never) {
  return planRoute({
    start: a, dest: b, boat: DEFAULT_BOAT,
    departHourIdx: 6, field, depth, bbox: BB,
  });
}

// ── hình học ─────────────────────────────────────────────────────────────

describe("hình học", () => {
  it("haversineKm: Hà Nội → TP.HCM ≈ 1140 km", () => {
    const d = haversineKm(
      { lat: 21.0285, lon: 105.8542 },
      { lat: 10.8231, lon: 106.6297 },
    );
    expect(d).toBeGreaterThan(1110);
    expect(d).toBeLessThan(1160);
  });

  it("bearingDeg + angleDiffDeg + kmToNm", () => {
    expect(bearingDeg({ lat: 10, lon: 110 }, { lat: 11, lon: 110 })).toBeCloseTo(0, 0);
    expect(bearingDeg({ lat: 10, lon: 110 }, { lat: 10, lon: 111 })).toBeCloseTo(90, 0);
    expect(angleDiffDeg(350, 10)).toBe(-20);
    expect(angleDiffDeg(10, 350)).toBe(20);
    expect(kmToNm(1.852)).toBeCloseTo(1, 6);
  });
});

// ── mô hình tàu trong sóng gió (Kwon 4 bậc) ──────────────────────────────

describe("Kwon: giảm tốc theo hướng sóng (4 bậc góc)", () => {
  it("mũi 1,0 / chếch mũi 0,8 / ngang 0,45 / đuôi 0,15", () => {
    expect(waveDirFactor(90, 90)).toBe(1); // sóng vỗ thẳng mũi
    expect(waveDirFactor(135, 90)).toBe(0.8); // chếch mũi 45°
    expect(waveDirFactor(0, 90)).toBe(0.45); // sóng ngang
    expect(waveDirFactor(270, 90)).toBe(0.15); // sóng đuôi — đẩy tàu, ít cản
    expect(waveDirFactor(null, 90)).toBe(1); // thiếu hướng → coi như xấu nhất
  });

  it("speedFactor: sóng đuôi gần như không làm chậm (đúng Kwon)", () => {
    expect(speedFactor(0.3, 1)).toBe(1);
    expect(speedFactor(2.5, 1)).toBeCloseTo(0.8, 5);
    expect(speedFactor(2.5, 0.15)).toBeGreaterThan(0.96);
    expect(speedFactor(10, 1)).toBe(0.55); // sàn
  });

  it("windDragFactor: ngược gió dương, xuôi gió âm, có trần sàn", () => {
    expect(windDragFactor(30, 90, 90)).toBeCloseTo(0.12, 5);
    expect(windDragFactor(30, 270, 90)).toBe(-0.08);
    expect(windDragFactor(200, 90, 90)).toBe(0.25);
  });

  it("followingSeaRisk (IMO 1228): chỉ sóng đuôi ≥2 m CHU KỲ NGẮN", () => {
    expect(followingSeaRisk(2.5, 270, 90, 4)).toBe(true); // sóng gió ngắn
    expect(followingSeaRisk(2.5, 270, 90, 8)).toBe(false); // swell dài — cưỡi êm
    expect(followingSeaRisk(2.5, 270, 90, null)).toBe(true); // thiếu chu kỳ → cẩn thận
    expect(followingSeaRisk(1.5, 270, 90, 4)).toBe(false); // thấp
    expect(followingSeaRisk(2.5, 90, 90, 4)).toBe(false); // sóng mũi
  });
});

// ── nội suy trường thời tiết ─────────────────────────────────────────────

describe("sampleField", () => {
  it("trường đều → trả đúng giá trị tại mọi điểm", () => {
    const f = makeField(BB, 5, () => ({ waveM: 1.2, windKmh: 15, wavePeriodS: 5 }));
    const s = sampleField(f, 12.0, 111.0, 6)!;
    expect(s.waveM).toBeCloseTo(1.2, 5);
    expect(s.windKmh).toBeCloseTo(15, 5);
    expect(s.wavePeriodS).toBeCloseTo(5, 5);
  });

  it("ô đất liền bị loại khỏi nội suy; cả 4 góc đất → null", () => {
    const f = makeField(BB, 5, (la) => (la < 12 ? "land" : { waveM: 1 }));
    const s = sampleField(f, 12.01, 111.0, 0);
    expect(s?.waveM).toBeCloseTo(1, 3);
    expect(sampleField(f, BB.latMin + 0.01, 111.0, 0)).toBeNull();
  });

  it("dòng chảy nội suy theo vector: hai ô chảy ngược nhau → giữa gần đứng nước", () => {
    const f = makeField(BB, 5, (la) => ({
      currentKmh: 2,
      currentToDeg: la < 12 ? 0 : 180,
    }));
    const s = sampleField(f, 11.73, 111.0, 0)!;
    expect(s.currentKmh).toBeLessThan(0.5);
  });

  it("nội suy hướng qua mốc 0°/360° không gãy", () => {
    const f = makeField(BB, 5, (la) => ({ windFromDeg: la < 12 ? 350 : 10 }));
    const s = sampleField(f, 12.0, 111.0, 0)!;
    expect(Math.abs(angleDiffDeg(s.windFromDeg, 0))).toBeLessThan(15);
  });
});

// ── tìm đường: hành vi cốt lõi ───────────────────────────────────────────

describe("planRoute", () => {
  it("biển êm → tuyến bám sát đường thẳng, không 'tiết kiệm' ảo, không cap", () => {
    const p = plan(makeField(BB, 7, calm))!;
    const directKm = haversineKm(START, DEST);
    expect(p.distKm).toBeLessThan(directKm * 1.06);
    expect(p.cappedToDirect).toBe(false);
    expect(p.direct).not.toBeNull();
    expect(Math.abs(p.fuelDeltaL!)).toBeLessThan(Math.max(3, p.direct!.fuelL * 0.03));
    expect(p.hasRoughLeg).toBe(false);
    const hoursMin = directKm / (DEFAULT_BOAT.speedKn * KMH_PER_KNOT);
    expect(p.hours).toBeGreaterThanOrEqual(hoursMin * 0.99);
    expect(p.hours).toBeLessThan(hoursMin * 1.15);
  });

  it("INVARIANT chống ca '100 km vẽ thành 400 km': đường thẳng đi được thì tuyến không bao giờ dài quá trần", () => {
    // nửa nam toàn sóng 3,5 m (mức "không nên đi" nhưng CHƯA cấm); hành lang
    // êm phía bắc dụ tuyến đi vòng. Với penalty nhỏ (audit: 1,15/1,5 thay ×3)
    // + trần MAX_DETOUR_RATIO, hệ KHÔNG ĐƯỢC PHÉP trả tuyến dài vô lý — hoặc
    // đi gần thẳng kèm cảnh báo đỏ, hoặc cap về đường thẳng. Cả hai đều phải
    // nói thật là có sóng dữ.
    const a: LatLon = { lat: 12.0, lon: 110.0 };
    const b: LatLon = { lat: 12.0, lon: 110.92 }; // chim bay ~100 km
    const f = makeField(BB, 9, (la) => (la < 12.5 ? { waveM: 3.5 } : calm()));
    const p = planRoute({
      start: a, dest: b, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(p).not.toBeNull();
    expect(p.direct).not.toBeNull();
    // BẤT BIẾN: không bao giờ dài hơn trần khi đường thẳng đi được
    expect(p.distKm).toBeLessThanOrEqual(p.direct!.distKm * MAX_DETOUR_RATIO);
    // và phải nói thật: xuất phát/đích nằm giữa vùng sóng 3,5 m
    expect(p.hasRoughLeg).toBe(true);
    expect(p.maxWaveM).toBeGreaterThan(3);
  });

  it("dải sóng 3 m có khe hở gần → lách qua khe (vòng nhẹ dưới trần), nói thật tốn thêm dầu", () => {
    // dải rộng hơn mắt lưới thời tiết (≈0,52°) để nội suy không "pha loãng"
    // sóng xuống dưới ngưỡng; khe hở đặt GẦN (vòng ~1,2× — dưới trần 1,3;
    // khe xa hơn thì trần tự cắt về đường thẳng — có test riêng phía trên)
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.8 && la < 12.3 ? { waveM: 3.4 } : calm(),
    );
    const p = plan(f)!;
    expect(p.cappedToDirect).toBe(false);
    expect(p.hasRoughLeg).toBe(false); // đã né hết mức "không nên đi"
    expect(p.maxWaveM).toBeLessThan(3);
    expect(Math.max(...p.waypoints.map((w) => w.lat))).toBeGreaterThan(12.3);
    expect(p.direct).not.toBeNull();
    expect(p.distKm).toBeLessThanOrEqual(p.direct!.distKm * MAX_DETOUR_RATIO);
    expect(p.fuelDeltaL).not.toBeNull(); // con số thật, có dấu — không cắt về 0
  });

  it("đất liền chắn ngang → vòng qua là chính đáng, direct = null, KHÔNG áp trần (kiểu mũi Cà Mau)", () => {
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.8 && la < 12.6 ? "land" : calm(),
    );
    const p = plan(f)!;
    expect(p.direct).toBeNull();
    expect(p.fuelDeltaL).toBeNull();
    expect(p.cappedToDirect).toBe(false);
    expect(Math.max(...p.waypoints.map((w) => w.lat))).toBeGreaterThan(12.5);
  });

  it("sóng ≥4 m (cấp 8) chắn kín mọi lối → trả null, không vẽ liều", () => {
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.3 ? { waveM: 4.5 } : calm(),
    );
    expect(plan(f)).toBeNull();
  });

  it("sóng 3 m chắn kín không lối né (chưa tới mức cấm) → đi xuyên + cờ cảnh báo đỏ", () => {
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.8 ? { waveM: 3.4 } : calm(),
    );
    // khác test khe hở: dải phủ MỌI vĩ độ → không có khe
    const p = plan(f)!;
    expect(p).not.toBeNull();
    expect(p.hasRoughLeg).toBe(true);
    expect(p.maxWaveM).toBeGreaterThan(2.9);
    expect(p.distKm).toBeLessThanOrEqual(p.direct!.distKm * MAX_DETOUR_RATIO);
  });

  it("sóng đuôi ngắn 2,2 m khắp vùng → chạy GẦN THẲNG (không zigzag) + cờ cảnh báo trượt sóng", () => {
    // audit 2026-06-10: bản cũ dirF đuôi 0,4 + phạt như vùng dữ làm optimizer
    // zigzag +41% quãng đường để né cờ — sai cả Kwon lẫn 1228 (xử lý đúng là
    // giảm ga tại chỗ). Giờ phải đi thẳng và CẢNH BÁO.
    const f = makeField(BB, 7, () => ({
      waveM: 2.2, waveFromDeg: 270, wavePeriodS: 4,
    }));
    const p = plan(f)!;
    expect(p.distKm).toBeLessThan(haversineKm(START, DEST) * 1.1);
    expect(p.hasFollowingSeaRisk).toBe(true);
  });

  it("ngược gió tốn dầu hơn xuôi gió trên cùng tuyến", () => {
    const head = plan(makeField(BB, 7, () => ({ windKmh: 30, windFromDeg: 90 })))!;
    const tail = plan(makeField(BB, 7, () => ({ windKmh: 30, windFromDeg: 270 })))!;
    expect(head.fuelL).toBeGreaterThan(tail.fuelL);
  });
});

// ── dòng hải lưu ─────────────────────────────────────────────────────────

describe("dòng chảy trong tuyến", () => {
  it("xuôi dòng nhanh và đỡ dầu hơn ngược dòng trên cùng quãng đường", () => {
    const f = makeField(BB, 7, () => ({ currentKmh: 3, currentToDeg: 90 }));
    const goEast = plan(f)!;
    const goWest = plan(f, DEST, START)!;
    expect(goEast.hours).toBeLessThan(goWest.hours);
    expect(goEast.fuelL).toBeLessThan(goWest.fuelL);
    expect(goWest.fuelL / goEast.fuelL).toBeGreaterThan(1.3);
  });

  it("dải dòng thuận sát trục → bẻ nhẹ vào dải để 'đi nhờ nước' và thật sự đỡ dầu", () => {
    const f = makeField(BB, 9, (la) =>
      la > 12.08 && la < 12.5 ? { currentKmh: 4, currentToDeg: 90 } : calm(),
    );
    const withCur = plan(f)!;
    const still = plan(makeField(BB, 9, calm))!;
    expect(Math.max(...withCur.waypoints.map((w) => w.lat))).toBeGreaterThan(12.1);
    expect(withCur.fuelL).toBeLessThan(still.fuelL);
    expect(withCur.distKm).toBeLessThanOrEqual(withCur.direct!.distKm * MAX_DETOUR_RATIO);
  });

  it("dòng ngược phi lý (mạnh hơn tàu) → không chia 0, giờ chạy hữu hạn", () => {
    const p = plan(makeField(BB, 7, () => ({ currentKmh: 40, currentToDeg: 270 })))!;
    expect(p).not.toBeNull();
    expect(Number.isFinite(p.hours)).toBe(true);
    expect(p.hours).toBeGreaterThan(0);
  });
});

// ── lưới độ sâu ──────────────────────────────────────────────────────────

function makeDepth(at: (lat: number, lon: number) => 0 | 1 | 2 | 3) {
  const { lat0, lon0, step, nLat, nLon } = DEPTH_META;
  const packed = new Uint8Array(Math.ceil((nLat * nLon) / 4));
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const k = i * nLon + j;
      packed[k >> 2] |= at(lat0 + i * step, lon0 + j * step) << ((k & 3) * 2);
    }
  }
  return decodeDepthGrid(packed.buffer);
}

describe("ràng buộc độ sâu", () => {
  it("đóng gói 2-bit đọc lại đúng, ngoài lưới trả null", () => {
    const g = makeDepth((la) => (la < 10 ? 1 : 3));
    expect(depthClassAt(g, 8, 110)).toBe(1);
    expect(depthClassAt(g, 15, 110)).toBe(3);
    expect(depthClassAt(g, 30, 110)).toBeNull();
  });

  it("bãi cạn (<4 m) chắn ngang → tuyến vòng qua dù thời tiết êm", () => {
    const f = makeField(BB, 9, calm);
    const g = makeDepth((la, lo) =>
      Math.abs(lo - 111) < 0.3 && la < 12.6 ? 1 : 3,
    );
    const p = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: g, bbox: BB,
    })!;
    expect(p.depthChecked).toBe(true);
    expect(p.direct).toBeNull(); // đường thẳng đâm vào bãi cạn
    expect(Math.max(...p.waypoints.map((w) => w.lat))).toBeGreaterThan(12.5);
  });

  it("rạn hẹp giữa chặng dài không lọt khe (mẫu mỗi ≤5 km dọc cạnh)", () => {
    const f = makeField(BB, 9, calm);
    // chấm đảo nhỏ ~6 km ngay trên đường thẳng, giữa hai mắt lưới tìm đường
    const g = makeDepth((la, lo) =>
      Math.abs(la - 12.0) < 0.03 && Math.abs(lo - 111.01) < 0.03 ? 0 : 3,
    );
    const p = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: g, bbox: BB,
    })!;
    expect(p).not.toBeNull();
    // không waypoint nào đặt đúng lên đảo + tuyến phải lệch khỏi nó
    for (let k = 1; k < p.waypoints.length; k++) {
      const a = p.waypoints[k - 1];
      const b = p.waypoints[k];
      for (let t = 0; t <= 10; t++) {
        const pt = {
          lat: a.lat + ((b.lat - a.lat) * t) / 10,
          lon: a.lon + ((b.lon - a.lon) * t) / 10,
        };
        if (haversineKm(pt, { lat: 12.0, lon: 111.01 }) < 2.5) {
          throw new Error("tuyến vẽ xuyên qua đảo");
        }
      }
    }
  });

  it("dải nước nông 4–12 m trên đường → vẫn đi nhưng cắm cờ hasShallowLeg", () => {
    const f = makeField(BB, 9, calm);
    const g = makeDepth((la, lo) => (Math.abs(lo - 111) < 0.3 ? 2 : 3));
    const p = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: g, bbox: BB,
    })!;
    expect(p.hasShallowLeg).toBe(true);
  });

  it("sát cảng RẤT CẠN (class 1) trong 12 km vẫn nối được; vòng đất class 0 ngoài 5 km thì chặn", () => {
    const f = makeField(BB, 9, calm);
    const shallowRing = makeDepth((la, lo) =>
      haversineKm({ lat: la, lon: lo }, START) < 8 ? 1 : 3,
    );
    expect(
      planRoute({
        start: START, dest: DEST, boat: DEFAULT_BOAT,
        departHourIdx: 6, field: f, depth: shallowRing, bbox: BB,
      }),
    ).not.toBeNull();

    const landRing = makeDepth((la, lo) => {
      const d = haversineKm({ lat: la, lon: lo }, START);
      // vành đai ĐẤT dày 7,5 km (dày hơn bước lấy mẫu 5 km) ngoài bán kính nới 5 km
      return d > 5.5 && d < 13 ? 0 : 3;
    });
    expect(
      planRoute({
        start: START, dest: DEST, boat: DEFAULT_BOAT,
        departHourIdx: 6, field: f, depth: landRing, bbox: BB,
      }),
    ).toBeNull(); // không cho cắt ngang doi đất
  });
});

// ── adapter thời tiết ────────────────────────────────────────────────────

describe("parseWeatherField (adapter)", () => {
  it("ghép lưới gió + sóng + chu kỳ + dòng, nhận đất liền qua sóng null", () => {
    const lats = [10, 10.5];
    const lons = [105, 105.5];
    const mk = (w: (number | null)[]) => ({
      hourly: {
        wind_speed_10m: [12, 14],
        wind_direction_10m: [45, 90],
        wave_height: w,
        wave_direction: [180, 200],
        wave_period: [5, 6],
        ocean_current_velocity: [1.5, 1.2],
        ocean_current_direction: [30, 35],
      },
    });
    const wind = [mk([1, 1]), mk([1, 1]), mk([1, 1]), mk([1, 1])];
    const wave = [mk([1.2, 1.1]), mk([null, null]), mk([0.8, 0.9]), mk([1, 1])];
    const f = parseWeatherField(wind, wave, lats, lons);
    expect(f.cells[0].onSea).toBe(true);
    expect(f.cells[1].onSea).toBe(false);
    expect(f.cells[0].hours[0]).toEqual({
      waveM: 1.2,
      waveFromDeg: 180,
      wavePeriodS: 5,
      windKmh: 12,
      windFromDeg: 45,
      currentKmh: 1.5,
      currentToDeg: 30,
    });
  });

  it("fieldGrid: bbox to vẫn ≤ 120 điểm một lượt gọi", () => {
    const { lats, lons } = fieldGrid({
      latMin: 5, latMax: 23, lonMin: 102, lonMax: 118,
    });
    expect(lats.length * lons.length).toBeLessThanOrEqual(120);
  });
});

// ── helpers ──────────────────────────────────────────────────────────────

describe("helpers hiển thị", () => {
  it("formatHoursVN", () => {
    expect(formatHoursVN(9.58)).toBe("9 giờ 35 phút");
    expect(formatHoursVN(2)).toBe("2 giờ");
    expect(formatHoursVN(0.4)).toBe("25 phút");
  });

  it("vnHourIndex: 03:30 UTC = 10 giờ sáng VN", () => {
    expect(vnHourIndex(new Date("2026-06-10T03:30:00Z"))).toBe(10);
    expect(vnHourIndex(new Date("2026-06-10T17:00:00Z"))).toBe(0);
  });
});
