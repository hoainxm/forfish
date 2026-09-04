/*  HIỂM HOẠ TRONG THUẬT TOÁN TÌM ĐƯỜNG (Đợt 2, 2026-09-04).

    Bốn câu hỏi mà chỉ test mới trả lời được, và cả bốn đều là chuyện an toàn:
      1. Tuyến trả về có THẬT SỰ không đi vào vòng chặn nào không (dữ liệu thật,
         không phải ca giả dễ chịu)?
      2. Đường CHIM BAY có bị chặn cùng luật không — nếu không, nhánh trần-đường-
         vòng (`cappedToDirect`) sẽ vui vẻ trả một đường thẳng xuyên xác tàu.
      3. Vật chặn sát bến có làm bà con không rời được cảng không?
      4. Bật lớp hiểm hoạ lên thì tuyến có phình ra vô lý, hay có tuyến nào đang
         đi được bỗng thành "không tìm được đường" không?

    Dùng LƯỚI ĐỘ SÂU THẬT + KHO HIỂM HOẠ THẬT cho câu 1 và 4 (ca giả không nói
    được gì về việc 285 vật thật nằm ở đâu so với đường bà con hay đi), ca giả
    cho câu 2 và 3 (dữ liệu thật không có vật nào nằm đúng chỗ cần để đi qua
    nhánh đó — mà đó là nhánh quyết định chặn hay không chặn).
*/
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { decodeDepthGrid, type DepthGrid } from "@/lib/depth-grid";
import {
  bboxOfPoints,
  haversineKm,
  planRoute,
  type BBox,
  type HourSample,
  type LatLon,
  type WeatherField,
} from "@/lib/route-plan";
import {
  buildHazardList,
  hazardsInBBox,
  packHazards,
  NO_GO_PAD_KM,
  type Hazard,
  type NoGoZone,
} from "@/lib/hazards";
import { distToSegment } from "@/lib/spatial-index";
import { decodeXacTau } from "@/lib/xac-tau";
import { decodeSeamarks } from "@/lib/seamarks";

/* ── dữ liệu thật ────────────────────────────────────────────────────────── */

const DATA = join(process.cwd(), "public", "data");
const readJson = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const VN: BBox = { latMin: 4, latMax: 24.5, lonMin: 99, lonMax: 119 };
const clampBBox = (b: BBox): BBox => ({
  latMin: Math.max(VN.latMin, b.latMin),
  latMax: Math.min(VN.latMax, b.latMax),
  lonMin: Math.max(VN.lonMin, b.lonMin),
  lonMax: Math.min(VN.lonMax, b.lonMax),
});

let depthCache: DepthGrid | null = null;
function realDepth(): DepthGrid {
  if (!depthCache) {
    const raw = readFileSync(join(DATA, "depth-grid.v1.bin"));
    depthCache = decodeDepthGrid(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    );
  }
  return depthCache;
}

const khoThat = buildHazardList(
  {
    xacTau: decodeXacTau(readJson("xac-tau.v1.json")),
    laneFeatures: readJson("vn-sea-lanes.v1.json").features as GeoJSON.Feature[],
    seamarks: decodeSeamarks(readJson("seamarks.v1.json")),
  },
  null,
  2026,
);

/* ── trời êm giả (chỉ đo phần hình học + độ sâu + hiểm hoạ) ───────────────── */

function calmField(bbox: BBox, n = 8, hours = 72): WeatherField {
  const h: HourSample = {
    waveM: 0.5,
    waveFromDeg: 90,
    wavePeriodS: 8,
    windKmh: 10,
    windFromDeg: 90,
    currentKmh: 0,
    currentToDeg: null,
  };
  const cells = [];
  for (let i = 0; i < n * n; i++)
    cells.push({ onSea: true, hours: Array.from({ length: hours }, () => h) });
  return {
    lat0: bbox.latMin,
    lon0: bbox.lonMin,
    dLat: (bbox.latMax - bbox.latMin) / (n - 1),
    dLon: (bbox.lonMax - bbox.lonMin) / (n - 1),
    nLat: n,
    nLon: n,
    cells,
  };
}

type ChayOpts = {
  hazards?: Hazard[] | null;
  noGo?: NoGoZone[] | null;
  depth?: DepthGrid | null;
  draftM?: number | null;
  marginKm?: number;
};

/** Một lượt tính như `route-planner.tsx` làm: lọc theo khung rồi đóng gói. */
function chay(a: LatLon, b: LatLon, o: ChayOpts = {}) {
  const bbox = clampBBox(bboxOfPoints([a, b], o.marginKm ?? 60));
  const hz = o.hazards;
  return planRoute({
    start: a,
    dest: b,
    boat: { speedKn: 7, litersPerHour: 20, draftM: o.draftM ?? null },
    departHourIdx: 6,
    field: calmField(bbox),
    depth: o.depth ?? null,
    bbox,
    hazards: hz ? packHazards(hazardsInBBox(hz, bbox, 0)) : hz === null ? null : undefined,
    noGo: o.noGo ?? null,
  });
}

const hazard = (over: Partial<Hazard> & Pick<Hazard, "lat" | "lon" | "rKm">): Hazard => ({
  id: "gia:1",
  loai: "xac-tau",
  ten: "Tàu giả",
  nam: 2026,
  doSauM: null,
  tinVua: false,
  nguon: "tbhh",
  ...over,
});

/* ── 1. cờ "đã soi" không được nói dối ───────────────────────────────────── */

describe("hazardChecked — chưa soi KHÁC đã soi và sạch", () => {
  const A = { lat: 12, lon: 110 };
  const B = { lat: 12, lon: 111 };

  it("không truyền kho → false (UI phải nói 'chưa đối chiếu')", () => {
    const p = chay(A, B);
    expect(p).not.toBeNull();
    expect(p!.hazardChecked).toBe(false);
    expect(p!.hasHazardLeg).toBe(false);
    expect(p!.hasHazardNearPortLeg).toBe(false);
  });

  it("truyền kho RỖNG (soi rồi, biển sạch) → true", () => {
    const p = chay(A, B, { hazards: [] });
    expect(p).not.toBeNull();
    expect(p!.hazardChecked).toBe(true);
    expect(p!.hasHazardLeg).toBe(false);
  });

  it("gói méo (ids dài hơn mảng số) không ném, không chặn, và hazardChecked = FALSE (review đợt 4 G2: máy không chặn gì thì không được nói 'đã đối chiếu')", () => {
    const bbox = clampBBox(bboxOfPoints([A, B], 60));
    const p = planRoute({
      start: A,
      dest: B,
      boat: { speedKn: 7, litersPerHour: 20 },
      departHourIdx: 6,
      field: calmField(bbox),
      depth: null,
      bbox,
      hazards: {
        lat: new Float64Array(1),
        lon: new Float64Array(1),
        rKm: new Float64Array(1),
        ids: ["a", "b", "c"],
      },
    });
    expect(p).not.toBeNull();
    expect(p!.hazardChecked).toBe(false);
    expect(p!.hasHazardLeg).toBe(false);
  });
});

/* ── 2. chặn thật giữa biển + đường chim bay cũng bị chặn ────────────────── */

describe("vật chặn giữa biển", () => {
  const A: LatLon = { lat: 12, lon: 110 };
  const B: LatLon = { lat: 12, lon: 111.5 };
  const GIUA: LatLon = { lat: 12, lon: 110.75 };

  it("tuyến vòng qua, KHÔNG waypoint nào lọt vào vòng chặn", () => {
    const h = hazard({ lat: GIUA.lat, lon: GIUA.lon, rKm: 8 });
    const p = chay(A, B, { hazards: [h] });
    expect(p).not.toBeNull();
    for (const w of p!.waypoints) expect(haversineKm(w, h)).toBeGreaterThan(h.rKm);
  });

  it("ĐƯỜNG CHIM BAY cũng đi qua đúng luật chặn ⇒ direct = null, không có nhánh capped xuyên vật", () => {
    const h = hazard({ lat: GIUA.lat, lon: GIUA.lon, rKm: 8 });
    const p = chay(A, B, { hazards: [h] });
    expect(p!.direct).toBeNull();
    expect(p!.cappedToDirect).toBe(false);
    expect(p!.fuelDeltaL).toBeNull();
  });

  it("cùng tuyến đó KHÔNG có vật thì chạy thẳng (đối chứng — vòng là do vật, không phải do lưới)", () => {
    const p = chay(A, B, { hazards: [] });
    expect(p!.direct).not.toBeNull();
    expect(p!.distKm).toBeLessThan(haversineKm(A, B) * 1.05);
  });

  it("hàng rào vật chặn kín cả khung → không có đường, trả null (thà không có tuyến)", () => {
    // chuỗi vòng 25 km chồng mép nhau, phủ trọn dải vĩ độ của khung tính
    const rao: Hazard[] = [];
    for (let lat = 11.2; lat <= 12.9; lat += 0.3)
      rao.push(hazard({ id: `rao:${lat}`, lat, lon: 110.75, rKm: 25 }));
    const p = chay(A, B, { hazards: rao });
    expect(p).toBeNull();
  });
});

/* ── 3. vùng CẤM VÀO (đa giác) ───────────────────────────────────────────── */

describe("vùng cấm vào — đa giác chặn tại mẫu 2 km", () => {
  const A: LatLon = { lat: 12, lon: 110 };
  const B: LatLon = { lat: 12, lon: 111.5 };
  /** dải dọc chắn ngang đường chim bay, rộng ~11 km, cao 0,6° */
  const ZONE: NoGoZone = {
    id: "cv:test",
    ten: "Khu cấm vào thử",
    ring: [
      [110.7, 11.7],
      [110.8, 11.7],
      [110.8, 12.3],
      [110.7, 12.3],
      [110.7, 11.7],
    ],
    bbox: { latMin: 11.7, latMax: 12.3, lonMin: 110.7, lonMax: 110.8 },
  };

  it("tuyến vòng ra ngoài vùng, không waypoint nào nằm trong", () => {
    const p = chay(A, B, { hazards: [], noGo: [ZONE] });
    expect(p).not.toBeNull();
    for (const w of p!.waypoints) {
      const trong =
        w.lat > 11.7 && w.lat < 12.3 && w.lon > 110.7 && w.lon < 110.8;
      expect(trong).toBe(false);
    }
    // đường chim bay xuyên vùng ⇒ không có nền so sánh
    expect(p!.direct).toBeNull();
  });

  /*  VÙNG NHỎ HƠN BƯỚC MẪU (review đợt 4, C1). Đa giác cấm-vào DUY NHẤT trong
      `vn-sea-lanes.v1.json` rộng 0,2 × 0,2 km, còn `legCost` lấy mẫu mỗi 2 km:
      kiểm điểm-trong-đa-giác tại mẫu bắt được chừng 10 % số lần cắt qua. Nên ca
      test không được chấm MỘT vị trí — trúng một mẫu là xanh giả. Rải vùng dọc
      trọn một khoảng mẫu: nếu còn khe thì gần hết các vị trí phải lọt. */
  describe("vùng cấm 200 m — nhỏ hơn bước mẫu 2 km", () => {
    const D_AB = haversineKm(A, B); // ~163 km, cùng vĩ độ nên nội suy theo lon
    const diemTai = (km: number): LatLon => ({
      lat: 12,
      lon: 110 + 1.5 * (km / D_AB),
    });
    /** Ô vuông 0,2 × 0,2 km quanh một điểm — đúng cỡ vùng cấm vào thật. */
    const vungNho = (c: LatLon): NoGoZone => {
      const nua = 0.1 / 111.32; // 100 m theo vĩ độ
      const nuaLon = 0.1 / (111.32 * Math.cos((c.lat * Math.PI) / 180));
      const ring: [number, number][] = [
        [c.lon - nuaLon, c.lat - nua],
        [c.lon + nuaLon, c.lat - nua],
        [c.lon + nuaLon, c.lat + nua],
        [c.lon - nuaLon, c.lat + nua],
        [c.lon - nuaLon, c.lat - nua],
      ];
      return {
        id: "cv:nho",
        ten: "Khu cấm vào 200 m",
        ring,
        bbox: {
          latMin: c.lat - nua,
          latMax: c.lat + nua,
          lonMin: c.lon - nuaLon,
          lonMax: c.lon + nuaLon,
        },
      };
    };

    it("đặt ở 11 chỗ trải trọn một khoảng mẫu — KHÔNG chỗ nào đường chim bay lọt qua", () => {
      const lot: string[] = [];
      for (let i = 0; i <= 10; i++) {
        const km = 80 + i * 0.2; // 80,0 → 82,0 km: đúng một bước mẫu
        const p = chay(A, B, { hazards: [], noGo: [vungNho(diemTai(km))] });
        // `direct` chạy qua CÙNG `legCost`: nó null nghĩa là lớp chặn có nổ
        if (p?.direct != null) lot.push(`km ${km.toFixed(1)}`);
      }
      expect(lot).toEqual([]);
    });

    it("tuyến trả về đi vòng ra ngoài đệm 500 m, không chỉ 'không lọt waypoint'", () => {
      const c = diemTai(81.3);
      const p = chay(A, B, { hazards: [], noGo: [vungNho(c)] });
      expect(p).not.toBeNull();
      // đo tới từng ĐOẠN, không chỉ tới waypoint — khe nằm giữa hai waypoint
      let gan = Infinity;
      for (let i = 1; i < p!.waypoints.length; i++) {
        const d = distToSegment(c, p!.waypoints[i - 1], p!.waypoints[i]).km;
        if (d < gan) gan = d;
      }
      expect(gan).toBeGreaterThan(NO_GO_PAD_KM);
    });

    it("vùng nhỏ CHỨA nơi xuất phát: không khoá bến, chỉ cắm cờ (luật 7)", () => {
      const p = chay(A, B, { hazards: [], noGo: [vungNho(A)] });
      expect(p).not.toBeNull();
      expect(p!.hasHazardNearPortLeg).toBe(true);
      expect(p!.hasHazardLeg).toBe(false);
    });
  });

  it("vùng nằm ngoài khung tính thì không tốn gì, tuyến y như cũ", () => {
    const xa: NoGoZone = {
      ...ZONE,
      bbox: { latMin: 20, latMax: 20.5, lonMin: 107, lonMax: 107.5 },
      ring: [
        [107, 20],
        [107.5, 20],
        [107.5, 20.5],
        [107, 20.5],
        [107, 20],
      ],
    };
    const p = chay(A, B, { hazards: [], noGo: [xa] });
    expect(p).not.toBeNull();
    expect(p!.distKm).toBeLessThan(haversineKm(A, B) * 1.05);
  });
});

/* ── 4. sát cảng: nới cho đi, nhưng phải cắm cờ ──────────────────────────── */

describe("vật chặn trong 5 km quanh bến — không chặn, chỉ cắm cờ (luật 7)", () => {
  const A: LatLon = { lat: 12, lon: 110 };
  const B: LatLon = { lat: 12, lon: 110.4 }; // ~44 km

  it("lồng bè ngay cửa bến không làm tàu kẹt lại, cờ sát cảng bật", () => {
    // cách nơi xuất phát ~2 km, bán kính 1,5 km ⇒ chặng đầu chắc chắn chạm
    const h = hazard({ id: "lb:1", loai: "long-be", lat: 12, lon: 110.018, rKm: 1.5 });
    const p = chay(A, B, { hazards: [h], marginKm: 45 });
    expect(p).not.toBeNull();
    expect(p!.hasHazardNearPortLeg).toBe(true);
    expect(p!.hasHazardLeg).toBe(false);
  });

  it("cùng cái đó dời ra GIỮA ĐƯỜNG thì chặn thật (cờ sát cảng im)", () => {
    const h = hazard({ lat: 12, lon: 110.2, rKm: 1.5 });
    const p = chay(A, B, { hazards: [h], marginKm: 45 });
    expect(p).not.toBeNull();
    expect(p!.hasHazardNearPortLeg).toBe(false);
    for (const w of p!.waypoints) expect(haversineKm(w, h)).toBeGreaterThan(h.rKm);
  });
});

/* ── 5. clone sang worker ────────────────────────────────────────────────── */

describe("gói hiểm hoạ đi được qua structured clone (worker)", () => {
  it("HazardPacked + NoGoZone clone nguyên vẹn, tính ra cùng kết quả", () => {
    const h = hazard({ lat: 12, lon: 110.75, rKm: 8 });
    const bbox = clampBBox(bboxOfPoints([{ lat: 12, lon: 110 }, { lat: 12, lon: 111.5 }], 60));
    const goi = packHazards([h]);
    const clone = structuredClone(goi);
    expect(clone.ids).toEqual(goi.ids);
    expect(Array.from(clone.rKm)).toEqual(Array.from(goi.rKm));
    const args = {
      start: { lat: 12, lon: 110 },
      dest: { lat: 12, lon: 111.5 },
      boat: { speedKn: 7, litersPerHour: 20 },
      departHourIdx: 6,
      field: calmField(bbox),
      depth: null,
      bbox,
    };
    const a = planRoute({ ...args, hazards: goi });
    const b = planRoute({ ...args, hazards: clone });
    expect(b!.distKm).toBeCloseTo(a!.distKm, 6);
  });
});

/* ── 6. DỮ LIỆU THẬT: tuyến quen không đâm vào cái gì ────────────────────── */

describe("dữ liệu thật — Vũng Tàu → Côn Đảo", () => {
  const VUNG_TAU: LatLon = { lat: 10.33, lon: 107.08 };
  const CON_DAO: LatLon = { lat: 8.68, lon: 106.62 };

  it("không waypoint nào (ngoài 5 km quanh hai đầu) nằm trong vòng chặn của 285 vật thật", () => {
    const p = chay(VUNG_TAU, CON_DAO, {
      hazards: khoThat.hazards,
      noGo: khoThat.noGo,
      depth: realDepth(),
    });
    expect(p).not.toBeNull();
    const ganBen = (w: LatLon) =>
      haversineKm(w, VUNG_TAU) <= 5 || haversineKm(w, CON_DAO) <= 5;
    const dinh: string[] = [];
    for (const w of p!.waypoints) {
      if (ganBen(w)) continue;
      for (const h of khoThat.hazards) {
        if (haversineKm(w, h) <= h.rKm) dinh.push(`${h.loai} ${h.id}`);
      }
    }
    expect(dinh).toEqual([]);
    expect(p!.hasHazardLeg).toBe(false);
  });
});

/* ── 7. CỔNG ĐO: 10 cặp cảng → ngư trường, bật lớp hiểm hoạ lên ──────────── */

/**
 * [tên, cảng, ngư trường ngoài khơi, mớn nước] — toạ độ cảng lấy từ
 * `src/data/ports.ts`. Rạch Giá phải khai mớn: cả vùng biển tây là dải 2–4 m,
 * tàu chưa khai mớn KHÔNG được vẽ qua đó (luật Đợt 0) nên nền so sánh của cặp
 * này chỉ tồn tại khi có mớn — đúng như `route-bench` đã ghi.
 */
const CAP: [string, LatLon, LatLon, number | null][] = [
  ["Cát Bà → khơi vịnh Bắc Bộ", { lat: 20.72, lon: 107.06 }, { lat: 20.0, lon: 107.9 }, null],
  ["Lạch Hới → khơi Thanh Hoá", { lat: 19.74, lon: 105.95 }, { lat: 19.3, lon: 106.9 }, null],
  ["Cửa Lò → khơi Nghệ An", { lat: 18.8, lon: 105.75 }, { lat: 18.4, lon: 106.8 }, null],
  ["Thọ Quang → khơi Đà Nẵng", { lat: 16.12, lon: 108.26 }, { lat: 16.3, lon: 109.4 }, null],
  ["Sa Kỳ → khơi Quảng Ngãi", { lat: 15.22, lon: 108.95 }, { lat: 15.0, lon: 110.0 }, null],
  ["Quy Nhơn → khơi Bình Định", { lat: 13.76, lon: 109.27 }, { lat: 13.5, lon: 110.5 }, null],
  ["Hòn Rớ → Trường Sa", { lat: 12.2, lon: 109.25 }, { lat: 10.5, lon: 112.0 }, null],
  ["Phan Thiết → khơi Bình Thuận", { lat: 10.91, lon: 108.13 }, { lat: 9.9, lon: 109.2 }, null],
  ["Vũng Tàu → nhà giàn DK1", { lat: 10.34, lon: 107.09 }, { lat: 8.0, lon: 109.0 }, null],
  ["Rạch Giá → nam Côn Đảo (mớn 1,2)", { lat: 10.02, lon: 105.08 }, { lat: 8.55, lon: 106.6 }, 1.2],
];

describe("cổng đo — bật lớp hiểm hoạ không được làm mất tuyến, không được vòng quá 3 %", () => {
  it("10 cặp cảng → ngư trường: 0 tuyến null mới, quãng ≤ +3 %", () => {
    const depth = realDepth();
    const hong: string[] = [];
    const phinh: string[] = [];
    /*  CỔNG CHỐNG TEST RỖNG: cặp nào KHÔNG có tuyến ngay từ nền (chưa bật hiểm
        hoạ) là cặp toạ độ sai — phải sửa toạ độ, chứ để đó thì cả bài kiểm này
        xanh mà không kiểm gì (`truoc` null ⇒ mọi so sánh bị bỏ qua). */
    const khongNen: string[] = [];
    let tongVat = 0;
    const bang: string[] = [];
    for (const [ten, a, b, draftM] of CAP) {
      /*  HAI VÒNG NỞ KHUNG y như `route-planner.tsx`: khung nhỏ cho nhanh,
          chưa có lối (phải vòng mũi đất) thì nở rộng rồi tìm lại. Test mà chỉ
          chạy vòng một là test một luồng KHÁC luồng bà con bấm. */
      const d = haversineKm(a, b);
      const margins = [
        Math.min(150, Math.max(45, d * 0.3)),
        Math.min(420, Math.max(200, d * 1.1)),
      ];
      const chayHaiVong = (hazards: Hazard[] | null) => {
        for (const marginKm of margins) {
          const p = chay(a, b, {
            depth,
            marginKm,
            draftM,
            hazards,
            noGo: hazards ? khoThat.noGo : null,
          });
          if (p) return p;
        }
        return null;
      };
      const bbox = clampBBox(bboxOfPoints([a, b], margins[0]));
      const vat = hazardsInBBox(khoThat.hazards, bbox, 0).length;
      tongVat += vat;
      const truoc = chayHaiVong(null);
      const sau = chayHaiVong(khoThat.hazards);
      if (!truoc) {
        khongNen.push(ten);
        continue;
      }
      if (!sau) {
        hong.push(ten);
        continue;
      }
      if (sau.distKm > truoc.distKm * 1.03)
        phinh.push(`${ten}: ${truoc.distKm.toFixed(0)} → ${sau.distKm.toFixed(0)} km`);
      bang.push(
        `${ten.padEnd(32)} ${String(vat).padStart(3)} vật  ${truoc.distKm
          .toFixed(0)
          .padStart(4)} → ${sau.distKm.toFixed(0).padStart(4)} km  ${(
          (sau.distKm / truoc.distKm - 1) *
          100
        ).toFixed(2)} %  ${sau.hasHazardNearPortLeg ? "cờ sát cảng" : "-"}`,
      );
    }
    console.log("\n=== 10 cặp cảng → ngư trường (lưới + hiểm hoạ thật) ===\n" + bang.join("\n"));
    expect(khongNen).toEqual([]);
    expect(hong).toEqual([]);
    expect(phinh).toEqual([]);
    // và phải có vật THẬT trong các khung này, không thì bài kiểm chẳng kiểm gì
    expect(tongVat).toBeGreaterThan(0);
  });
});
