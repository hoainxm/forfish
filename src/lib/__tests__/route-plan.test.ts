import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOAT,
  KMH_PER_KNOT,
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

  it("bearingDeg + angleDiffDeg", () => {
    expect(bearingDeg({ lat: 10, lon: 110 }, { lat: 11, lon: 110 })).toBeCloseTo(0, 0);
    expect(bearingDeg({ lat: 10, lon: 110 }, { lat: 10, lon: 111 })).toBeCloseTo(90, 0);
    expect(angleDiffDeg(350, 10)).toBe(-20);
    expect(angleDiffDeg(10, 350)).toBe(20);
  });

  it("kmToNm + bboxFor bao trùm hai đầu", () => {
    expect(kmToNm(1.852)).toBeCloseTo(1, 6);
    expect(BB.latMin).toBeLessThan(12);
    expect(BB.lonMin).toBeLessThan(110);
    expect(BB.lonMax).toBeGreaterThan(112);
  });
});

// ── mô hình tàu trong sóng gió ───────────────────────────────────────────

describe("Kwon-lite: giảm tốc theo hướng sóng", () => {
  it("sóng mũi nặng nhất, sóng ngang vừa, sóng đuôi nhẹ nhất", () => {
    expect(waveDirFactor(90, 90)).toBe(1); // sóng tới từ hướng đang chạy = vỗ mũi
    expect(waveDirFactor(0, 90)).toBe(0.7); // sóng ngang
    expect(waveDirFactor(270, 90)).toBe(0.4); // sóng từ sau đuôi
    expect(waveDirFactor(null, 90)).toBe(1); // thiếu hướng → coi như xấu nhất
  });

  it("speedFactor giảm dần theo sóng, có sàn 55%", () => {
    expect(speedFactor(0.3, 1)).toBe(1);
    expect(speedFactor(2.5, 1)).toBeCloseTo(0.8, 5);
    expect(speedFactor(10, 1)).toBe(0.55);
    // cùng độ cao sóng, sóng đuôi giảm tốc ít hơn sóng mũi
    expect(speedFactor(2.5, 0.4)).toBeGreaterThan(speedFactor(2.5, 1));
  });

  it("windDragFactor: ngược gió dương, xuôi gió âm, có trần sàn", () => {
    expect(windDragFactor(30, 90, 90)).toBeCloseTo(0.12, 5); // gió ngược mũi
    expect(windDragFactor(30, 270, 90)).toBe(-0.08); // xuôi (chạm sàn)
    expect(windDragFactor(200, 90, 90)).toBe(0.25); // trần
  });

  it("followingSeaRisk (IMO 1228-lite): chỉ khi sóng đuôi ≥2 m", () => {
    expect(followingSeaRisk(2.5, 270, 90)).toBe(true);
    expect(followingSeaRisk(1.5, 270, 90)).toBe(false);
    expect(followingSeaRisk(2.5, 90, 90)).toBe(false); // sóng mũi
    expect(followingSeaRisk(2.5, null, 90)).toBe(false);
  });
});

// ── nội suy trường thời tiết ─────────────────────────────────────────────

describe("sampleField", () => {
  it("trường đều → trả đúng giá trị tại mọi điểm", () => {
    const f = makeField(BB, 5, () => ({ waveM: 1.2, windKmh: 15 }));
    const s = sampleField(f, 12.0, 111.0, 6)!;
    expect(s.waveM).toBeCloseTo(1.2, 5);
    expect(s.windKmh).toBeCloseTo(15, 5);
  });

  it("ô đất liền bị loại khỏi nội suy; cả 4 góc đất → null", () => {
    const f = makeField(BB, 5, (la) => (la < 12 ? "land" : { waveM: 1 }));
    const s = sampleField(f, 12.01, 111.0, 0);
    expect(s?.waveM).toBeCloseTo(1, 3); // nửa biển vẫn cho số
    expect(sampleField(f, BB.latMin + 0.01, 111.0, 0)).toBeNull();
  });

  it("dòng chảy nội suy theo vector: hai ô chảy ngược nhau → giữa gần đứng nước", () => {
    const f = makeField(BB, 5, (la) => ({
      currentKmh: 2,
      currentToDeg: la < 12 ? 0 : 180, // nửa dưới chảy lên Bắc, nửa trên xuống Nam
    }));
    // điểm nằm GIỮA hai hàng lưới ngược dòng (hàng tại ~11,46 và ~12,0)
    const s = sampleField(f, 11.73, 111.0, 0)!;
    expect(s.currentKmh).toBeLessThan(0.5);
  });

  it("nội suy hướng qua mốc 0°/360° không gãy", () => {
    const f = makeField(BB, 5, (la) => ({
      windFromDeg: la < 12 ? 350 : 10,
    }));
    const s = sampleField(f, 12.0, 111.0, 0)!;
    const d = Math.abs(angleDiffDeg(s.windFromDeg, 0));
    expect(d).toBeLessThan(15); // quanh 0°, không phải ~180°
  });
});

// ── tìm đường ────────────────────────────────────────────────────────────

const calm = () => ({ waveM: 0.3, windKmh: 10 });

describe("planRoute (Dijkstra time-dependent kiểu VISIR)", () => {
  it("biển êm → tuyến bám sát đường thẳng, không 'tiết kiệm' ảo", () => {
    const f = makeField(BB, 7, calm);
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(plan).not.toBeNull();
    const directKm = haversineKm(START, DEST);
    expect(plan.distKm).toBeLessThan(directKm * 1.06);
    expect(plan.savedFuelL).toBeLessThan(1);
    expect(plan.direct).not.toBeNull();
    expect(plan.hasRoughLeg).toBe(false);
    expect(plan.depthChecked).toBe(false); // không truyền depth
    const hoursMin = directKm / (DEFAULT_BOAT.speedKn * KMH_PER_KNOT);
    expect(plan.hours).toBeGreaterThanOrEqual(hoursMin * 0.99);
    expect(plan.hours).toBeLessThan(hoursMin * 1.15);
  });

  it("tường sóng dữ chắn ngang có khe hở → tuyến chui qua khe, né hết vùng dữ", () => {
    // dải sóng 3,2 m chắn kinh tuyến 111, hở một khe ở vĩ độ 12,55+
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.3 && la < 12.55 ? { waveM: 3.2 } : calm(),
    );
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(plan).not.toBeNull();
    expect(plan.hasRoughLeg).toBe(false);
    expect(plan.maxWaveM).toBeLessThan(2.5);
    // có đi vòng lên phía khe hở
    const maxLat = Math.max(...plan.waypoints.map((w) => w.lat));
    expect(maxLat).toBeGreaterThan(12.4);
    expect(plan.direct).not.toBeNull(); // đường thẳng vẫn đi được (chỉ tốn hơn)
    expect(plan.savedFuelL).toBeGreaterThanOrEqual(0);
  });

  it("đất liền chắn ngang đường thẳng → tuyến vòng qua, direct = null (kiểu mũi Cà Mau)", () => {
    // "bán đảo" đất chắn quanh kinh tuyến 111 từ mép dưới lên tới 12,6 —
    // rộng hơn mắt lưới thời tiết để cả 4 góc nội suy đều là đất (tường đất
    // mỏng hơn mắt lưới là việc của lưới ĐỘ SÂU, có test riêng bên dưới)
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.8 && la < 12.6 ? "land" : calm(),
    );
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(plan).not.toBeNull();
    expect(plan.direct).toBeNull();
    expect(plan.savedFuelL).toBe(0);
    const maxLat = Math.max(...plan.waypoints.map((w) => w.lat));
    expect(maxLat).toBeGreaterThan(12.5); // vòng lên trên bán đảo
  });

  it("sóng ≥4 m chắn kín mọi lối → trả null, không vẽ liều", () => {
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.3 ? { waveM: 4.5 } : calm(),
    );
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    });
    expect(plan).toBeNull();
  });

  it("vùng dữ 3 m chắn kín (chưa tới mức cấm 4 m) → vẫn ra tuyến + cờ cảnh báo", () => {
    const f = makeField(BB, 9, (la, lo) =>
      Math.abs(lo - 111) < 0.3 ? { waveM: 3 } : calm(),
    );
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(plan).not.toBeNull();
    expect(plan.hasRoughLeg).toBe(true);
    expect(plan.maxWaveM).toBeGreaterThan(2.9);
  });

  it("ngược gió tốn dầu hơn xuôi gió trên cùng tuyến", () => {
    const head = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT, departHourIdx: 6,
      field: makeField(BB, 7, () => ({ windKmh: 30, windFromDeg: 90 })),
      depth: null, bbox: BB,
    })!;
    const tail = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT, departHourIdx: 6,
      field: makeField(BB, 7, () => ({ windKmh: 30, windFromDeg: 270 })),
      depth: null, bbox: BB,
    })!;
    expect(head.fuelL).toBeGreaterThan(tail.fuelL);
  });

  it("xuôi dòng nhanh và đỡ dầu hơn ngược dòng trên cùng quãng đường", () => {
    // dòng 3 km/h chảy về Đông khắp vùng; cùng cặp điểm, đi xuôi và đi ngược
    const f = makeField(BB, 7, () => ({ currentKmh: 3, currentToDeg: 90 }));
    const goEast = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    const goWest = planRoute({
      start: DEST, dest: START, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(goEast.hours).toBeLessThan(goWest.hours);
    expect(goEast.fuelL).toBeLessThan(goWest.fuelL);
    // sanity: chênh lệch cỡ 2×3 km/h trên ~13 km/h — rõ rệt chứ không vi tế
    expect(goWest.fuelL / goEast.fuelL).toBeGreaterThan(1.3);
  });

  it("dải dòng thuận lệch trục → tuyến bẻ vào dải để 'đi nhờ nước'", () => {
    // dòng 4 km/h về Đông trong dải vĩ độ 12,08–12,5 — sát đường thẳng,
    // lệch vài km là "đi nhờ nước" được (dải xa quá thì không bõ — đã thử,
    // thuật toán từ chối bẻ là ĐÚNG kinh tế)
    const f = makeField(BB, 9, (la) =>
      la > 12.08 && la < 12.5 ? { currentKmh: 4, currentToDeg: 90 } : calm(),
    );
    const withCurrent = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    const still = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: makeField(BB, 9, calm), depth: null, bbox: BB,
    })!;
    const maxLat = Math.max(...withCurrent.waypoints.map((w) => w.lat));
    expect(maxLat).toBeGreaterThan(12.12); // có bẻ lên dải dòng thuận
    expect(withCurrent.fuelL).toBeLessThan(still.fuelL); // và bõ công bẻ
  });

  it("dòng ngược phi lý (mạnh hơn tàu) → không chia 0, giờ chạy vẫn hữu hạn", () => {
    const f = makeField(BB, 7, () => ({ currentKmh: 40, currentToDeg: 270 }));
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(plan).not.toBeNull();
    expect(Number.isFinite(plan.hours)).toBe(true);
    expect(plan.hours).toBeGreaterThan(0);
  });

  it("sóng đuôi ≥2 m khắp vùng → hoặc cắm cờ nguy cơ, hoặc chạy chéo né (quartering)", () => {
    const f = makeField(BB, 7, () => ({ waveM: 2.2, waveFromDeg: 270 }));
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: null, bbox: BB,
    })!;
    expect(plan).not.toBeNull();
    const directKm = haversineKm(START, DEST);
    // mô hình phải PHẢN ỨNG với sóng đuôi: hoặc chấp nhận và cảnh báo,
    // hoặc trả tuyến chạy chéo dài hơn rõ rệt để sóng vào vai (đúng cách
    // dân biển xử lý sóng đuôi)
    expect(
      plan.hasFollowingSeaRisk || plan.distKm > directKm * 1.2,
    ).toBe(true);
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

describe("depth-grid + ràng buộc độ sâu", () => {
  it("đóng gói 2-bit đọc lại đúng, ngoài lưới trả null", () => {
    const g = makeDepth((la) => (la < 10 ? 1 : 3));
    expect(depthClassAt(g, 8, 110)).toBe(1);
    expect(depthClassAt(g, 15, 110)).toBe(3);
    expect(depthClassAt(g, 30, 110)).toBeNull();
  });

  it("bãi cạn (<10 m) chắn ngang → tuyến vòng qua dù thời tiết êm", () => {
    const f = makeField(BB, 9, calm);
    // bãi cạn dọc kinh tuyến 111, từ mép dưới lên 12,6
    const g = makeDepth((la, lo) =>
      Math.abs(lo - 111) < 0.3 && la < 12.6 ? 1 : 3,
    );
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: g, bbox: BB,
    })!;
    expect(plan).not.toBeNull();
    expect(plan.depthChecked).toBe(true);
    expect(plan.direct).toBeNull(); // đường thẳng đâm vào bãi cạn
    const maxLat = Math.max(...plan.waypoints.map((w) => w.lat));
    expect(maxLat).toBeGreaterThan(12.5);
  });

  it("dải nước nông 10–20 m trên đường → vẫn đi nhưng cắm cờ hasShallowLeg", () => {
    const f = makeField(BB, 9, calm);
    const g = makeDepth((la, lo) => (Math.abs(lo - 111) < 0.3 ? 2 : 3));
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: g, bbox: BB,
    })!;
    expect(plan.hasShallowLeg).toBe(true);
  });

  it("sát cảng cạn/bờ vẫn nối được (vicinity quanh hai đầu)", () => {
    const f = makeField(BB, 9, calm);
    // toàn vùng quanh điểm xuất phát là "đất" trong bán kính nhỏ
    const g = makeDepth((la, lo) =>
      haversineKm({ lat: la, lon: lo }, START) < 8 ? 0 : 3,
    );
    const plan = planRoute({
      start: START, dest: DEST, boat: DEFAULT_BOAT,
      departHourIdx: 6, field: f, depth: g, bbox: BB,
    });
    expect(plan).not.toBeNull();
  });
});

// ── adapter thời tiết ────────────────────────────────────────────────────

describe("parseWeatherField (adapter)", () => {
  it("ghép lưới gió + sóng, nhận đất liền qua sóng null", () => {
    const lats = [10, 10.5];
    const lons = [105, 105.5];
    const mk = (w: (number | null)[]) => ({
      hourly: {
        wind_speed_10m: [12, 14],
        wind_direction_10m: [45, 90],
        wave_height: w,
        wave_direction: [180, 200],
        ocean_current_velocity: [1.5, 1.2],
        ocean_current_direction: [30, 35],
      },
    });
    const wind = [mk([1, 1]), mk([1, 1]), mk([1, 1]), mk([1, 1])];
    const wave = [mk([1.2, 1.1]), mk([null, null]), mk([0.8, 0.9]), mk([1, 1])];
    const f = parseWeatherField(wind, wave, lats, lons);
    expect(f.nLat).toBe(2);
    expect(f.nLon).toBe(2);
    expect(f.cells[0].onSea).toBe(true);
    expect(f.cells[1].onSea).toBe(false); // sóng null cả dãy
    expect(f.cells[0].hours[0]).toEqual({
      waveM: 1.2,
      waveFromDeg: 180,
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
    expect(lats.length).toBeGreaterThanOrEqual(4);
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
