/*  HẬU KIỂM TUYẾN — luật câu chữ và thứ tự kiểm trên dữ liệu GIẢ có chủ ý
    (mỗi ca dựng đúng một tình huống), rồi chạy trọn trên DỮ LIỆU THẬT để chắc
    không ném và đo thời gian.

    Điều bắt buộc giữ ở đây, vì nó là lời hứa với bà con:
      · draftM null → KHÔNG một câu nào nói về mớn/độ sâu cần
      · không trạm triều ≤120 km → KHÔNG in mực nước ước tính
      · thiếu kho → `missing`, không ném, không im như đã soi
      · không "bẻ lái", không "ngay" — thuyền trưởng quyết */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { auditRoute, khoangCachText, type RouteAuditStores } from "@/lib/route-hazards";
import { buildHazardList, type Hazard } from "@/lib/hazards";
import { decodeXacTau } from "@/lib/xac-tau";
import { decodeSeamarks } from "@/lib/seamarks";
import { decodeVnAids } from "@/lib/vn-aids";
import { decodeSoundings, type Sounding } from "@/lib/soundings";
import { decodeVerdicts } from "@/lib/soundings-verified";
import { decodeFairwayDepths } from "@/lib/fairway-depth";
import { decodeTideStations, tideExtremesForDay, type TideStation } from "@/lib/tides";
import { VN_OUTER_BORDER } from "@/lib/geofence";
import type { LatLon } from "@/lib/route-plan";

const DATA = join(process.cwd(), "public", "data");
const readJson = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const xacTau = decodeXacTau(readJson("xac-tau.v1.json"));
const lanes = readJson("vn-sea-lanes.v1.json").features as GeoJSON.Feature[];
const seamarks = decodeSeamarks(readJson("seamarks.v1.json"));
const vnAids = decodeVnAids(readJson("vn-aids.v1.json"));
const soundingsRaw = readJson("soundings.v1.json");
const soundings = decodeSoundings(soundingsRaw);
const verdicts = decodeVerdicts(readJson("soundings-verified.v1.json"));
const fairways = decodeFairwayDepths(readJson("fairway-depths.v1.json"));
const tides = decodeTideStations(readJson("tide-stations.v1.json"));
const reefs = readJson("coral-reefs.v1.json").features as GeoJSON.Feature[];

const NAM_NAY = 2026;
const DEPART = Date.UTC(2026, 8, 10, 0, 0, 0); // 10/9/2026 07:00 giờ VN
const CAU_CAM = [/bẻ lái/i, /\bngay\b/i];

const hz = (over: Partial<Hazard>): Hazard => ({
  id: "h",
  lat: 10,
  lon: 107,
  rKm: 0.5,
  loai: "xac-tau",
  ten: null,
  nam: 2026,
  doSauM: null,
  tinVua: false,
  nguon: "tbhh",
  ...over,
});

const KM_DEG = (Math.PI / 180) * 6371;
/** Tuyến thẳng bắc→nam dọc kinh tuyến 107°, 10°N → 9°N (~111 km). */
const ROUTE: LatLon[] = [
  { lat: 10, lon: 107 },
  { lat: 9, lon: 107 },
];
const HOURS = [0, 10];

const sounding = (over: Partial<Sounding>): Sounding =>
  ({
    lat: 9.5,
    lon: 107,
    depthM: 2,
    at: "2026-03-14",
    notice: { so: "1/TBHH-TEST", ngay: "2026-03-14" },
    area: null,
    ...over,
  }) as Sounding;

/** Trạm triều giả đặt ngay trên tuyến: chỉ z0 (mực nước trung bình), không sóng → độ cao = z0. */
const tramGan = (z0: number, nguon?: "model"): TideStation => ({
  id: "t",
  name: "Trạm thử",
  lat: 9.5,
  lon: 107.05,
  z0,
  source: "test",
  span: "",
  rmseM: null,
  nguon,
  cons: [{ name: "M2", amp: 0, phase: 0 }],
});

/*  Helper cho các ca theo TỪNG KHO: bỏ hai dòng "con nước hai đầu" (bước 8,
    2026-09-04) để mỗi ca vẫn soi đúng một tình huống — hai dòng đó có
    describe riêng bên dưới, đọc thẳng `auditRoute`. */
const audit = (stores: RouteAuditStores, draftM: number | null = null, waypoints = ROUTE, hoursAt = HOURS) => {
  const r = auditRoute({ waypoints, hoursAt, departMs: DEPART, draftM, stores });
  return { ...r, hits: r.hits.filter((h) => h.loai !== "con-nuoc") };
};

describe("kho thiếu / đầu vào hỏng", () => {
  it("không kho nào → missing đủ tên, hits rỗng, không ném", () => {
    const r = audit({});
    expect(r.hits).toEqual([]);
    expect(r.missing).toEqual([
      "hiem-hoa",
      "sea-lanes",
      "so-do-sau",
      "luong",
      "seamarks",
      "vn-aids",
      "ranh-gioi",
      "bai-can",
    ]);
  });

  it("border: false = chỗ gọi cố ý tắt (không missing); undefined = thiếu", () => {
    expect(audit({ border: false }).missing).not.toContain("ranh-gioi");
    expect(audit({}).missing).toContain("ranh-gioi");
  });

  it("tuyến < 2 điểm → missing ['tuyen'], không ném", () => {
    expect(auditRoute({ waypoints: [ROUTE[0]], hoursAt: [0], departMs: DEPART, draftM: null, stores: {} })).toEqual({
      hits: [],
      missing: ["tuyen"],
    });
  });

  it("hoursAt lệch độ dài → etaH null, vẫn có hit", () => {
    const r = audit({ hazards: [hz({ lat: 9.5, lon: 107.005 })] }, null, ROUTE, [0]);
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].etaH).toBeNull();
  });
});

describe("hiểm hoạ chặn: mức theo khoảng cách, ETA nội suy", () => {
  it("từ mép vòng chặn r: ≤ r+0,5 → đỏ; ≤ r+1 → vàng; ≤ r+2 → tin; xa hơn → im", () => {
    const d = (km: number) => 107 + km / (KM_DEG * Math.cos((9.5 * Math.PI) / 180));
    const r = audit({
      hazards: [
        hz({ id: "a", lat: 9.5, lon: d(0.3) }), // r 0,5 → đỏ tới 1,0
        hz({ id: "b", lat: 9.6, lon: d(1.2) }), // vàng tới 1,5
        hz({ id: "c", lat: 9.7, lon: d(2.2) }), // tin tới 2,5
        hz({ id: "d", lat: 9.8, lon: d(3) }),
      ],
    });
    // tuyến đi từ bắc xuống nam nên c (9,7°N) gặp trước; d ở 3 km không có mặt
    expect(r.hits.map((h) => [h.id, h.muc])).toEqual([
      ["c", "tin"],
      ["b", "vang"],
      ["a", "do"],
    ]);
  });

  it("giàn khoan r = 1 km: vàng tới 2 km, tin tới 3 km", () => {
    const d = (km: number) => 107 + km / (KM_DEG * Math.cos((9.5 * Math.PI) / 180));
    const g = (km: number) => hz({ id: "g", loai: "gian-khoan", rKm: 1, lat: 9.5, lon: d(km) });
    expect(audit({ hazards: [g(1.8)] }).hits[0].muc).toBe("vang");
    expect(audit({ hazards: [g(2.8)] }).hits[0].muc).toBe("tin");
    expect(audit({ hazards: [g(3.2)] }).hits).toEqual([]);
  });

  it("sắp theo alongKm; etaH nội suy tuyến tính theo hoursAt", () => {
    const r = audit({
      hazards: [hz({ id: "xa", lat: 9.2, lon: 107.003 }), hz({ id: "gan", lat: 9.9, lon: 107.003 })],
    });
    expect(r.hits.map((h) => h.id)).toEqual(["gan", "xa"]);
    expect(r.hits[0].alongKm).toBeCloseTo(0.1 * KM_DEG, 0);
    expect(r.hits[0].etaH).toBeCloseTo(1, 1);
    expect(r.hits[1].etaH).toBeCloseTo(8, 1);
  });

  it("cùng id qua nhiều chặng → MỘT dòng, giữ mức nặng hơn", () => {
    const zigzag: LatLon[] = [
      { lat: 10, lon: 107 },
      { lat: 9.5, lon: 107.02 },
      { lat: 9, lon: 107 },
      { lat: 9.5, lon: 107.001 },
    ];
    const r = audit({ hazards: [hz({ id: "x", lat: 9.5, lon: 107 })] }, null, zigzag, [0, 1, 2, 3]);
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].muc).toBe("do");
  });

  it("xác tàu qua được → tin, có nước trên vật; draftM null thì KHÔNG nói tàu cần", () => {
    const p = hz({ id: "p", lat: 9.5, lon: 107.002, doSauM: 6.8, ten: "MINH KHÁNH 01" });
    const im = audit({ passable: [p] });
    expect(im.hits[0].muc).toBe("tin");
    expect(im.hits[0].cau).toContain("nước trên vật 6,8 m");
    expect(im.hits[0].cau).not.toContain("tàu cần");
    const noi = audit({ passable: [p] }, 2);
    expect(noi.hits[0].cau).toContain("tàu cần 2,5 m");
  });

  it("xác tàu 'qua được' mà THIẾU số nước trên vật → không ra dòng nào, không bịa '0 m' (review đợt 4 G2)", () => {
    const p = hz({ id: "p0", lat: 9.5, lon: 107.002, doSauM: null, ten: "KHÔNG SỐ" });
    const r = audit({ passable: [p] });
    expect(r.hits.filter((h) => h.id === "p0")).toEqual([]);
    for (const h of r.hits) expect(h.cau).not.toMatch(/nước trên vật 0 m/);
  });
});

describe("vùng cấm, cáp ngầm, khu hạn chế (vn-sea-lanes)", () => {
  const poly = (loai: string, ring: number[][], ten = `Khu ${loai}`): GeoJSON.Feature => ({
    type: "Feature",
    properties: { kind: "vungcam", loai, ten },
    geometry: { type: "Polygon", coordinates: [ring] },
  });
  const line = (kind: string, coords: number[][], loai?: string, hoDang?: boolean): GeoJSON.Feature => ({
    type: "Feature",
    properties: { kind, loai, ten: `${kind} thử`, hoDang },
    geometry: { type: "LineString", coordinates: coords },
  });
  const oVuong = [
    [106.9, 9.4],
    [107.1, 9.4],
    [107.1, 9.6],
    [106.9, 9.6],
    [106.9, 9.4],
  ];

  it("cấm vào Polygon tuyến đi qua → đỏ, alongKm tại chỗ vào", () => {
    const r = audit({ lanes: [poly("cam-vao", oVuong)] });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]).toMatchObject({ loai: "cam-vao", muc: "do", km: 0 });
    expect(r.hits[0].cau).toContain("khu cấm vào");
    expect(r.hits[0].alongKm).toBeCloseTo(0.4 * KM_DEG, 0);
  });

  it("cấm vào Polygon tuyến chạy sát (≤ 500 m) → đỏ, không đi vào", () => {
    const sat = [
      [107.003, 9.4],
      [107.2, 9.4],
      [107.2, 9.6],
      [107.003, 9.6],
      [107.003, 9.4],
    ];
    const r = audit({ lanes: [poly("cam-vao", sat)] });
    expect(r.hits[0].muc).toBe("do");
    expect(r.hits[0].km).toBeGreaterThan(0);
    expect(r.hits[0].cau).toContain("chạy sát");
  });

  it("cấm vào ranh hở (LineString hoDang) ≤ 500 m → vàng, nói ranh chưa rõ", () => {
    const r = audit({
      lanes: [line("vungcam", [[106.997, 9.45], [106.997, 9.55]], "cam-vao", true)], // ~330 m tây tuyến
    });
    expect(r.hits[0]).toMatchObject({ loai: "cam-vao-ho", muc: "vang" });
    expect(r.hits[0].cau).toContain("chưa rõ");
  });

  it("hai cáp + một ống cắt tuyến → MỘT dòng vàng gộp, km dọc tuyến tăng dần", () => {
    const r = audit({
      lanes: [
        line("cap", [[106.9, 9.7], [107.1, 9.7]], "quang"),
        line("cap", [[106.9, 9.3], [107.1, 9.3]], "dien"),
        line("ong", [[106.9, 9.5], [107.1, 9.5]], "khi"),
        line("cap", [[106.5, 9.5], [106.6, 9.5]], "quang"), // không cắt
      ],
    });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]).toMatchObject({ id: "cap-ong", muc: "vang" });
    expect(r.hits[0].cau).toBe("Tuyến cắt cáp ngầm ở km 33, 78 và ống dẫn ở km 56 — chạy qua được, đừng neo, đừng thả giã ở đó.");
    expect(r.hits[0].alongKm).toBeCloseTo(0.3 * KM_DEG, 0);
  });

  it("cấm neo / cấm đánh bắt / hạn chế → MỘT dòng vàng gộp tên, 'đừng dừng'", () => {
    const r = audit({
      lanes: [
        poly("cam-neo", oVuong, "Khu cấm neo A"),
        poly("cam-danh-bat", oVuong.map(([x, y]) => [x, y - 0.3]), "Khu cấm đánh bắt B"),
        poly("han-che", oVuong.map(([x, y]) => [x + 5, y]), "Xa"),
      ],
    });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]).toMatchObject({ id: "vung-han-che", muc: "vang" });
    expect(r.hits[0].cau).toContain("Khu cấm neo A; Khu cấm đánh bắt B");
    expect(r.hits[0].cau).not.toContain("Xa");
    expect(r.hits[0].cau).toContain("đừng dừng");
  });
});

describe("số đo sâu × mớn × triều", () => {
  // hai điểm cách nhau ~550 m, cùng rơi vào km thứ 55 của tuyến → gộp một dòng
  const sd = [sounding({}), sounding({ lat: 9.505, depthM: 2.2 })];

  it("draftM null → im hẳn (không một câu nào nói mớn/độ sâu cần)", () => {
    const r = audit({ soundings: sd, tides: [tramGan(0.5)] }, null);
    expect(r.hits).toEqual([]);
    expect(r.missing).not.toContain("so-do-sau");
  });

  it("có trạm ≤ 120 km, thiếu nước lúc tàu tới → đỏ 'chờ nước lên', in mực nước", () => {
    // đáy 2 m + triều 0,3 m = 2,3 m < cần 2,5 m (mớn 2)
    const r = audit({ soundings: sd, tides: [tramGan(0.3)], verdicts }, 2);
    expect(r.hits).toHaveLength(1); // hai điểm cùng km → gộp, giữ điểm thiếu nhiều hơn
    expect(r.hits[0]).toMatchObject({ loai: "do-sau", muc: "do" });
    expect(r.hits[0].cau).toContain("nước còn chừng 2,3 m");
    expect(r.hits[0].cau).toContain("tàu cần 2,5 m");
    expect(r.hits[0].cau).toContain("chờ nước lên");
    expect(r.hits[0].cau).toContain("số đo 3/2026");
    expect(r.hits[0].cau).not.toContain("(ước tính)");
  });

  it("trạm mô hình → gắn '(ước tính)'", () => {
    const r = audit({ soundings: sd, tides: [tramGan(0.3, "model")] }, 2);
    expect(r.hits[0].cau).toContain("(ước tính)");
  });

  it("đủ nước rộng rãi → im; vừa đủ (< cần + 1 m) → tin 'canh con nước'", () => {
    expect(audit({ soundings: sd, tides: [tramGan(3)] }, 2).hits).toEqual([]);
    const r = audit({ soundings: sd, tides: [tramGan(0.9)] }, 2);
    expect(r.hits[0].muc).toBe("tin");
    expect(r.hits[0].cau).toContain("vừa đủ");
  });

  it("KHÔNG có trạm ≤ 120 km → không in mực nước ước tính, nói 'chưa tính con nước'", () => {
    const xa = { ...tramGan(0.3), lat: 20.7, lon: 106.8 }; // Hòn Dấu, cách >1.000 km
    for (const t of [[xa], [], undefined]) {
      const r = audit({ soundings: sd, tides: t }, 2);
      expect(r.hits).toHaveLength(1);
      expect(r.hits[0].muc).toBe("do");
      expect(r.hits[0].cau).toContain("chưa tính con nước");
      expect(r.hits[0].cau).not.toContain("nước còn chừng");
      expect(r.hits[0].cau).not.toContain("lúc tàu tới");
    }
    expect(audit({ soundings: sd }, 2).missing).toContain("thuy-trieu");
  });

  it("điểm bị chấm nghi-lỗi (verdict) bị bỏ theo chỉ số mảng", () => {
    const v = new Map([["0:diem:0", { tep: 0, loai: "diem", i: 0, kq: "nghi-loi", tinCay: 0, bac: "D", lyDo: null }]]);
    const r = audit({ soundings: [sounding({ depthM: 1 })], verdicts: v as never }, 2);
    expect(r.hits).toEqual([]);
  });

  it("điểm > 0,5 km khỏi tuyến không tính", () => {
    const r = audit({ soundings: [sounding({ lon: 107.02 })], tides: [tramGan(0)] }, 2);
    expect(r.hits).toEqual([]);
  });

  it("gắn tên bãi cạn khi có coral-reefs Point ≤ 3 km", () => {
    const bai: GeoJSON.Feature = {
      type: "Feature",
      properties: { name: "Bãi Thử", type: "bai" },
      geometry: { type: "Point", coordinates: [107.01, 9.5] },
    };
    const r = audit({ soundings: sd, tides: [tramGan(0)], reefs: [bai] }, 2);
    expect(r.hits[0].cau).toContain("gần Bãi Thử");
  });
});

describe("con nước ở hai đầu tuyến", () => {
  // trạm THẬT Vũng Tàu; tuyến từ cửa Vũng Tàu ra khơi 111 km
  const vungTau = tides.find((t) => t.id === "vung-tau")!;
  const TU_VT: LatLon[] = [
    { lat: 10.34, lon: 107.07 },
    { lat: 9.4, lon: 107.5 },
  ];

  /** chỉ các dòng con nước, đọc thẳng auditRoute (helper `audit` đã lọc chúng đi) */
  const conNuoc = (
    stores: RouteAuditStores,
    draftM: number | null,
    waypoints: LatLon[] = TU_VT,
    hoursAt: number[] = [0, 10],
    departMs: number = DEPART,
  ) => auditRoute({ waypoints, hoursAt, departMs, draftM, stores }).hits.filter((h) => h.loai === "con-nuoc");

  it("draftM null → im hẳn, kể cả có trạm ngay cửa", () => {
    expect(conNuoc({ tides: [vungTau] }, null)).toEqual([]);
  });

  it("biết mớn + trạm ≤ 120 km → hai dòng: lúc xuất phát (km 0) và lúc tới đích (cuối tuyến)", () => {
    const cn = conNuoc({ tides: [vungTau] }, 1.5);
    expect(cn).toHaveLength(2);
    const di = cn.find((h) => h.id === "trieu:di")!;
    const den = cn.find((h) => h.id === "trieu:den")!;
    expect(di.alongKm).toBe(0);
    expect(den.alongKm).toBeGreaterThan(100);
    expect(di.cau).toMatch(/^Lúc xuất phát, con nước ở Vũng Tàu: \d+(,\d)? m, nước đang (lên|xuống|đứng)|^Lúc xuất phát, con nước ở Vũng Tàu: đang là lúc nước ròng/);
    expect(den.cau).toMatch(/^Tới đích chừng \d+ giờ/);
    for (const h of cn) {
      expect(["vang", "tin"]).toContain(h.muc);
      expect(h.cau).not.toContain("(ước tính)");
      for (const re of CAU_CAM) expect(h.cau).not.toMatch(re);
    }
  });

  it("giờ đi rơi đúng lúc nước ròng → VÀNG 'chờ nước lên'; giờ khác → tin", () => {
    const rong = tideExtremesForDay(vungTau, "2026-09-10").find((e) => e.kind === "low")!;
    const di = conNuoc({ tides: [vungTau] }, 1.5, TU_VT, [0, 10], rong.atMs).find((h) => h.id === "trieu:di")!;
    expect(di.muc).toBe("vang");
    expect(di.cau).toContain("đang là lúc nước ròng");
    expect(di.cau).toContain("chờ nước lên");
    // 4 giờ sau chân triều thì đã lên, không còn vàng
    const sau = conNuoc({ tides: [vungTau] }, 1.5, TU_VT, [0, 10], rong.atMs + 4 * 3600_000);
    expect(sau.find((h) => h.id === "trieu:di")!.muc).toBe("tin");
  });

  it("trạm mô hình → '(ước tính)'; không trạm ≤ 120 km → không dòng nào", () => {
    const cn = conNuoc({ tides: [tramGan(1, "model")] }, 1.5, ROUTE, HOURS);
    expect(cn.length).toBeGreaterThan(0);
    for (const h of cn) expect(h.cau).toContain("(ước tính)");
    const xa = { ...vungTau, lat: 20.7, lon: 106.8 };
    expect(conNuoc({ tides: [xa] }, 1.5)).toEqual([]);
  });

  it("hoursAt lệch → không biết giờ tới → chỉ có dòng xuất phát", () => {
    expect(conNuoc({ tides: [vungTau] }, 1.5, TU_VT, [0]).map((h) => h.id)).toEqual(["trieu:di"]);
  });
});

describe("luồng khống chế", () => {
  const luong = decodeFairwayDepths({
    v: 1,
    tuyen: [{ ten: "Luồng thử", noi: "", prov: {} }],
    thongBao: [{ so: "1", ngay: "2026-01-05", tieuDe: "", url: "", pdf: "", vung: "", prov: {} }],
    doan: [[0, 0, 23, 0, 106.997, 9.45, 106.997, 9.55, "Từ phao 1 đến phao 3"]], // ~330 m tây tuyến
    boSot: [],
  });

  it("tin có ngày; biết mớn mà thiếu nước → vàng (không đỏ)", () => {
    expect(luong).toHaveLength(1);
    const tin = audit({ fairways: luong });
    expect(tin.hits[0]).toMatchObject({ loai: "luong", muc: "tin" });
    expect(tin.hits[0].cau).toContain("2,3 m");
    expect(tin.hits[0].cau).toContain("đo 1/2026");
    const vang = audit({ fairways: luong, tides: [tramGan(0)] }, 2.5);
    expect(vang.hits[0].muc).toBe("vang");
    expect(vang.hits[0].cau).toContain("Luồng");
    expect(vang.hits[0].cau).toContain("tàu cần 3 m");
  });
});

describe("phao / tiêu sẽ gặp", () => {
  it("hành lang 1 km, ≤ 8 dòng theo thứ tự gặp, dòng cuối gộp số còn lại; bên trái/phải", () => {
    // 12 phao luồng rải dọc tuyến, xen trái/phải
    const sm = Array.from({ length: 12 }, (_, i) => ({
      lat: 9.95 - i * 0.07,
      lon: 107 + (i % 2 ? 0.004 : -0.004),
      type: "buoy_lateral",
      colour: i % 2 ? "red" : "green",
    }));
    const r = audit({ seamarks: sm });
    const phao = r.hits.filter((h) => h.loai === "phao");
    expect(phao).toHaveLength(8);
    for (let i = 1; i < phao.length; i++) expect(phao[i].alongKm).toBeGreaterThanOrEqual(phao[i - 1].alongKm);
    expect(phao[7].cau).toBe("…và 5 phao, tiêu nữa dọc tuyến.");
    // tuyến đi về nam: đông (lon lớn hơn) là bên TRÁI tàu
    expect(phao[0].cau).toContain("bên phải");
    expect(phao[1].cau).toContain("bên trái");
    expect(phao[0].cau).toContain("Phao luồng");
    expect(phao[1].cau).toContain("để phao này bên");
  });

  it("báo hiệu nhà nước (vnAids) thắng bản OSM cùng chỗ; phao ảo/cảng/trụ buộc không tính", () => {
    const r = audit({
      seamarks: [
        { lat: 9.5, lon: 107.002, type: "buoy_lateral" },
        { lat: 9.6, lon: 107.002, type: "virtual_aton" },
        { lat: 9.7, lon: 107.002, type: "harbour" },
      ],
      vnAids: [{ lat: 9.5001, lon: 107.002, type: "buoy_lateral", ten: "Phao 7", tacDung: null, tuyen: null }],
    });
    const phao = r.hits.filter((h) => h.loai === "phao");
    expect(phao).toHaveLength(1);
    expect(phao[0].cau).toContain("Phao 7 (Phao luồng)");
  });
});

describe("ranh giới VMS", () => {
  it("tuyến đi qua điểm trên ranh giới → đỏ, có số hải lý; tuyến ven bờ → im", () => {
    const b = VN_OUTER_BORDER[60];
    const tren: LatLon = { lat: b[1], lon: b[0] };
    const r = audit({ border: true }, null, [{ lat: tren.lat - 0.3, lon: tren.lon - 0.3 }, tren, { lat: tren.lat + 0.3, lon: tren.lon + 0.3 }], [0, 2, 4]);
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]).toMatchObject({ id: "ranh-gioi", muc: "do" });
    expect(r.hits[0].cau).toMatch(/hải lý/);
    expect(audit({ border: true }).hits).toEqual([]);
  });
});

describe("chữ", () => {
  it("khoangCachText: mét tròn 50 dưới 1 km, hải lý phía trên", () => {
    expect(khoangCachText(0.12)).toBe("100 m");
    expect(khoangCachText(0.62)).toBe("600 m");
    expect(khoangCachText(1.852)).toBe("1 hải lý");
    expect(khoangCachText(3)).toBe("1,6 hải lý");
    expect(khoangCachText(30)).toBe("16 hải lý");
    expect(khoangCachText(-1)).toBe("");
  });
});

/* ── DỮ LIỆU THẬT: Vũng Tàu → Côn Đảo, đủ kho ──────────────────────────── */
describe("chạy trọn trên dữ liệu thật", () => {
  it("Vũng Tàu → Côn Đảo: không ném, không thiếu kho, câu sạch, in số", () => {
    const list = buildHazardList({ xacTau, laneFeatures: lanes, seamarks }, 2.5, NAM_NAY);
    const stores: RouteAuditStores = {
      hazards: list.hazards,
      passable: list.passable,
      soundings,
      verdicts,
      fairways,
      lanes,
      seamarks,
      vnAids,
      reefs,
      tides,
      border: true,
    };
    const wps: LatLon[] = [
      { lat: 10.34, lon: 107.07 },
      { lat: 10.1, lon: 107.1 },
      { lat: 9.3, lon: 106.9 },
      { lat: 8.72, lon: 106.62 },
    ];
    const t0 = performance.now();
    const r = auditRoute({ waypoints: wps, hoursAt: [0, 1.5, 6.5, 10.5], departMs: DEPART, draftM: 2, stores });
    const ms = performance.now() - t0;
    expect(r.missing).toEqual([]);
    for (let i = 1; i < r.hits.length; i++) expect(r.hits[i].alongKm).toBeGreaterThanOrEqual(r.hits[i - 1].alongKm);
    expect(new Set(r.hits.map((h) => h.id)).size).toBe(r.hits.length);
    for (const h of r.hits) {
      expect(h.cau.length).toBeGreaterThan(5);
      for (const re of CAU_CAM) expect(h.cau).not.toMatch(re);
      expect(h.etaH).not.toBeNull();
    }
    const dem: Record<string, number> = {};
    for (const h of r.hits) dem[`${h.loai}/${h.muc}`] = (dem[`${h.loai}/${h.muc}`] ?? 0) + 1;
    console.log(
      [
        "",
        `  auditRoute Vũng Tàu→Côn Đảo (mớn 2 m): ${r.hits.length} dòng trong ${ms.toFixed(1)} ms`,
        `  ${Object.entries(dem).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
        `  soundings giải mã ${soundings.length}/${soundingsRaw.diem.length} hàng (verdict tra theo chỉ số mảng đã giải mã)`,
        ...r.hits.slice(0, 6).map((h) => `    km ${h.alongKm.toFixed(0)} [${h.muc}] ${h.cau}`),
        "",
      ].join("\n"),
    );
    // đo trên máy bàn ~ vài ms; trần nới cho CI
    expect(ms).toBeLessThan(2000);
  });

  it("draftM null trên dữ liệu thật: không câu nào nói 'tàu cần' / 'chờ nước'", () => {
    const list = buildHazardList({ xacTau, laneFeatures: lanes, seamarks }, null, NAM_NAY);
    const r = auditRoute({
      waypoints: [
        { lat: 20.75, lon: 106.85 },
        { lat: 20.6, lon: 107.0 },
        { lat: 20.3, lon: 107.3 },
      ],
      hoursAt: [0, 2, 5],
      departMs: DEPART,
      draftM: null,
      stores: { hazards: list.hazards, passable: list.passable, soundings, verdicts, fairways, lanes, seamarks, vnAids, reefs, tides, border: true },
    });
    for (const h of r.hits) {
      expect(h.cau).not.toMatch(/tàu cần|chờ nước|con nước/);
      expect(h.loai).not.toBe("do-sau");
    }
  });
});
