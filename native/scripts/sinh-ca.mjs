// VECTOR VÀNG CHO DỰ BÁO CÁ + MẬT ĐỘ TÀU (app-map 18 §5, đợt 2e) + SINH VÙNG BIỂN VN.
//
//   node native/scripts/sinh-ca.mjs ⇒ native/shared/src/jvmTest/resources/ca/vang.json ⇒ CaVangTest.kt
//                                    + native/shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/ca/VungBienSinh.kt
//
// Chạy CHÍNH code web (jiti, alias "@"): src/lib/vung-bien-vn.ts, fish-picks.ts, fish-blend.ts (+ model-params),
// fish-predict.ts (FISH_LEVEL_BANDS), source-registry.ts (fishFailNote), fleet-density.ts. Ba useMemo của
// src/components/fishing-map-view.tsx viết thẳng trong component (fishGridStep ~1772, fishView ~5700, fishGridGeo ~5721,
// fleetGridGeo ~5794, fishHotspots ~5847) và câu trạng thái BaiTauDuBao (ra-khoi-controls.tsx ~1434) ⇒ CHÉP Y dưới đây.
// Sửa chúng ở web thì sửa bản chép, chạy lại script, rồi sửa DuBaoCa.kt / MatDoTau.kt cho xanh.
//
// Đầu vào: phản hồi /api/fish-forecast GIẢ tự dựng (nhỏ, tất định) + file THẬT public/data (fish-climatology,
// model-params, fleet-density — bản rõ trong git; test Kotlin đọc thẳng file đó). Mẫu GỌN (repo chống phình): lát lớn
// chỉ ghi tổng + mẫu thưa.
process.env.TZ = "Asia/Ho_Chi_Minh";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
// CÙNG một chỉ định "@/lib/…" như code web tự import ⇒ một bản module (setModelParams mới tới được fish-blend)
const lib = (p) => jiti.import("@/lib/" + p.replace(/\.ts$/, ""));

const vb = await lib("vung-bien-vn.ts");
const pk = await lib("fish-picks.ts");
const fb = await lib("fish-blend.ts");
const mp = await lib("model-params.ts");
const fp = await lib("fish-predict.ts");
const sr = await lib("source-registry.ts");
const fd = await lib("fleet-density.ts");
const { haversineKm } = await lib("geofence.ts");

const docData = (ten) => JSON.parse(readFileSync(join(repo, "public/data", ten), "utf8"));

/* ── 0. sinh vùng biển VN (hằng trong bundle web: src/data/vms-zones.json qua geofence) ── */
{
  const s = JSON.stringify(vb.VN_SEA_POLYS);
  const kt =
    "// SINH TỰ ĐỘNG bởi native/scripts/sinh-ca.mjs từ src/data/vms-zones.json (VN_ALLOWED_POLYS của geofence.ts) — ĐỪNG SỬA TAY.\n" +
    "package vn.sdvico.forfish.shared.ca\n\n" +
    "/** Vùng biển VN cho dự báo cá = `VN_SEA_POLYS` (src/lib/vung-bien-vn.ts): MultiPolygon [poly][ring][[lon, lat]]. */\n" +
    "internal object VungBienSinh {\n" +
    `    const val POLYS = ${JSON.stringify(s)}\n` +
    "}\n";
  const ra = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/ca/VungBienSinh.kt");
  mkdirSync(dirname(ra), { recursive: true });
  writeFileSync(ra, kt);
}

/* ── 1. phản hồi /api/fish-forecast GIẢ ── */
let hat = 7;
const ngau = () => ((hat = (hat * 9301 + 49297) % 233280) / 233280);
const LOAI = ["ngừ vây vàng", "ngừ vằn", "cá nục", "cá cơm", "mực ống", "cá thu", "bạc má", "cá cờ"];
const ga = (i) => 5.025 + i * 0.25;
const go = (j) => 102.025 + j * 0.25;
const o = (lat, lon) => {
  const s = Math.round(20 + ngau() * 78);
  const sp = {};
  for (const l of LOAI) if (ngau() < 0.55) sp[l] = Math.round(ngau() * 100);
  const top = Object.keys(sp).filter((k) => sp[k] >= 40).sort((a, b) => sp[b] - sp[a]);
  return { lat, lon, s, top, sp, t: Math.round((26 + ngau() * 4) * 10) / 10, c: ngau() < 0.2 ? null : Math.round(ngau() * 100) / 100 };
};
const cells = [];
// ven biên Campuchia (ô vắt qua biên ⇒ cắt mảnh)
for (const [i, j] of [[21, 4], [21, 5], [22, 4], [22, 6]]) cells.push(o(ga(i), go(j)));
// khơi trong vùng
for (let k = 0; k < 30; k++) cells.push(o(ga(14 + Math.floor(ngau() * 14)), go(20 + Math.floor(ngau() * 10))));
// ngoài vùng: Hoàng Sa (vùng chú ý), Trung Quốc, Malaysia, Thái Lan
for (const [la, lo] of [[16.525, 112.025], [20.775, 111.025], [6.025, 103.525], [11.025, 102.275]]) cells.push(o(la, lo));
// hàng lỗi: lat chuỗi, thiếu lon, sp có null + chuỗi số
cells.push({ ...o(10.525, 108.525), lat: "10.525" });
cells.push({ lat: 11.025, s: 70, top: [], sp: {}, t: 27, c: null });
cells.push({ ...o(9.775, 107.775), s: 88, sp: { "cá nục": null, "ngừ vằn": "81", "cá thu": 77 }, top: ["ngừ vằn", "cá thu"] });
cells.push({ ...o(12.275, 109.525), s: 75, sp: { "ngừ vây vàng": 75 }, top: ["ngừ vây vàng"] });
const THO = {
  ok: true,
  date: "2026-11-01",
  cells,
  species: LOAI,
  generatedAt: "2026-11-02T06:00:00.000Z",
  targetDate: "2026-11-01",
  dateSkewDays: 1,
  dataQuality: 0.83,
  sources: { sst: { id: "x", date: "2026-11-01" } },
};
const THO_NEN = { ...THO, baseMode: "fleet-static", date: "2026-10-20" };

/* ── 2. bản chép các useMemo của fishing-map-view ── */
const fishGridStep = (fishCast) => {
  const cells = fishCast?.cells;
  if (!cells?.length) return 0.25;
  const lats = [...new Set(cells.map((c) => c.lat))].sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < lats.length; i++) {
    const d = lats[i] - lats[i - 1];
    if (d > 1e-4 && d < step) step = d;
  }
  return Number.isFinite(step) ? step : 0.25;
};
const fishViewOf = (fishCast, clim, fishLead, viewIso) => {
  if (!fishCast) return null;
  if (fishCast.baseMode) return fishCast;
  if (fishLead <= 0 || !clim || !fb.blendUsable()) return fishCast;
  const month = Number(viewIso.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return fishCast;
  const cells = vb.locOTrongVung(fb.blendFishCells(fishCast.cells, clim, month, fishLead));
  return { ...fishCast, cells };
};
const fishGridGeoOf = (fishView, fishBo, fishGridStep, fishChuaChon) => {
  if (!fishView || fishChuaChon) return null;
  const lo = fp.FISH_LEVEL_BANDS[0].min;
  const h = fishGridStep / 2;
  const features = [];
  for (const c of fishView.cells) {
    const v = pk.diemTheoBo(c, fishBo);
    if (v < lo) continue;
    const r = Math.round(v);
    const khung = vb.khungOTrongVung(c.lat, c.lon, h);
    const cat = khung.length !== 1 || khung[0][2] - khung[0][0] < 2 * h - 1e-9;
    for (const [x0, y0, x1, y1] of khung) {
      features.push({
        type: "Feature",
        properties: cat ? { s: r, m: 1 } : { s: r },
        geometry: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
      });
    }
  }
  return { type: "FeatureCollection", features };
};
const fishHotspotsOf = (fishView, fishBo, fishChuaChon, places, fishLead) => {
  if (!fishView || fishChuaChon) return [];
  const anchors = places.map((p) => ({ lat: p.lat, lon: p.lon }));
  const nearestKm = (lat, lon) => (anchors.length ? Math.min(...anchors.map((a) => haversineKm(a.lat, a.lon, lat, lon))) : Infinity);
  const scored = fishView.cells
    .map((c) => {
      const v = pk.diemTheoBo(c, fishBo);
      const km = nearestKm(c.lat, c.lon);
      const bonus = Math.max(0, 1 - km / 220) * 12;
      return { lat: c.lat, lon: c.lon, v, top: pk.loaiNoiTheoBo(c, fishBo), near: km <= 74, priority: v + bonus };
    })
    .filter((c) => c.v >= 75)
    .sort((a, b) => b.priority - a.priority);
  const spacing = fb.hotspotSpacingDeg(fishLead);
  const maxCount = fb.hotspotMaxCount(fishLead);
  const picked = [];
  for (const c of scored) {
    if (picked.length >= maxCount) break;
    const clash = picked.some((p) => Math.max(Math.abs(p.lat - c.lat), Math.abs(p.lon - c.lon)) < spacing);
    if (!clash) picked.push(c);
  }
  return picked.map(({ lat, lon, v, top, near }) => ({ lat, lon, v, top, near }));
};
const fleetGridGeoOf = (fleetCells, step) => {
  if (!fleetCells.length) return null;
  const h = step / 2;
  return {
    type: "FeatureCollection",
    features: fleetCells.map((c) => ({
      type: "Feature",
      properties: { lv: c.level, n: c.vessels, h: Math.round(c.value * 10) / 10 },
      geometry: { type: "Polygon", coordinates: [[[c.lon - h, c.lat - h], [c.lon + h, c.lat - h], [c.lon + h, c.lat + h], [c.lon - h, c.lat + h], [c.lon - h, c.lat - h]]] },
    })),
  };
};
// BaiTauDuBao (ra-khoi-controls.tsx ~1434): câu dưới chip
const fleetLine = ({ state, empty, windMissing, windPartial, storm, stormCells, thinBase, baseDays }) => {
  const stormLine = storm
    ? stormCells > 0
      ? "Có bão — quanh vùng bão tàu nằm bờ, nơi khác ước bình thường."
      : "Có bão nhưng vùng bão ở xa — ước như ngày thường."
    : null;
  const line = stormLine && (empty || stormCells > 0)
    ? stormLine
    : empty
      ? "Ngày này chưa ước được ô nào."
      : windMissing
        ? "Chưa có gió ngày này — ước theo trăng, mùa."
        : windPartial
          ? "Gió chỉ có gần bờ — khơi xa ước theo trăng, mùa."
          : "Đông hay thưa là so quanh vùng · ước theo trăng, gió, bão, mùa — tham khảo.";
  const thinLine = thinBase ? ` Nền tháng này mới ${baseDays} ngày số liệu — độ tin cậy thấp.` : "";
  if (state === "loading" || state === "idle") return "Đang tải mật độ tàu…";
  if (state === "error") return "Chưa tải được mật độ tàu — cần có sóng lần đầu. Chạm để thử lại.";
  return line + thinLine;
};

/* gọn: hình học ô cá ⇒ [s, m, x0, y0, x1, y1] (Kotlin dựng GeoJSON rồi gọn lại cùng kiểu) */
const gonGeo = (g) =>
  g ? g.features.map((f) => { const r = f.geometry.coordinates[0]; return [f.properties.s, f.properties.m ? 1 : 0, r[0][0], r[0][1], r[2][0], r[2][1]]; }) : null;

/* ── 3. vùng biển ── */
const vung = { diem: [], khung: [] };
for (let k = 0; k < 160; k++) {
  const la = Math.round((5 + ngau() * 17) * 1000) / 1000;
  const lo = Math.round((102 + ngau() * 16) * 1000) / 1000;
  vung.diem.push([la, lo, vb.trongVungBienVN(la, lo)]);
}
for (const [la, lo] of [[10.375, 103.85], [10.5, 104.0], [16.5, 112.3], [21.4, 108.0], [8.0, 104.0], [9.2, 106.0], [0, 0]]) vung.diem.push([la, lo, vb.trongVungBienVN(la, lo)]);
for (const [la, lo, h] of [[10.275, 103.025, 0.125], [10.525, 103.275, 0.125], [10.025, 108.025, 0.125], [16.525, 112.025, 0.125], [10.4, 103.9, 0.05], [21.5, 108.0, 0.25]])
  vung.khung.push([la, lo, h, vb.khungOTrongVung(la, lo, h)]);
const loc = vb.locBanDoCaTrongVung(THO).cells.map((c) => cells.indexOf(c));

/* ── 4. loài bà con đánh ── */
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const NGHE = Object.keys(pk.LOAI_THEO_NGHE);
const AVAIL = [LOAI, ["ngừ vằn", "cá nục", "mực ống", "cá cơm", "cá thu", "ngừ chù"], []];
const VU = [new Set(), new Set(["ngừ vằn", "cá cơm", "cá thu"])];
const picks = {
  max: pk.MAX_FISH_PICKS,
  loaiTheoNghe: pk.LOAI_THEO_NGHE,
  goiY: NGHE.flatMap((n) => AVAIL.flatMap((a) => VU.map((v) => [n, a, [...v], pk.goiYTheoNghe(n, a, v)]))),
  ngheCuaBo: [[], ["ngừ vằn"], pk.goiYTheoNghe("cau-ngu", LOAI, VU[0]), [...pk.goiYTheoNghe("luoi-vay", AVAIL[1], VU[1])].reverse(), ["cá cơm", "mực ống"]].flatMap((b) =>
    AVAIL.slice(0, 2).flatMap((a) => VU.map((v) => [b, a, [...v], pk.ngheCuaBo(b, a, v)])),
  ),
  toggle: [[[], "a"], [["a"], "a"], [["a", "b"], "c"], [["a", "b", "c"], "d"], [["a", "b", "c"], "b"]].map(([p, s]) => [p, s, pk.togglePick(p, s)]),
  bo: [[], ["ngừ vằn"], ["cá nục", "ngừ vằn"], ["cá nục"], ["không có"], ["cá thu", "ngừ vằn", "cá nục"]],
  load: ["", "[]", '["ngừ vằn"]', '["a","b","c","d"]', '[1,"a",null,"b"]', '{"a":1}', "khong-json", '"chuoi"', "[1,2]", null].map((raw) => {
    store.clear();
    if (raw != null) store.set("forfish.fishPicks.v1", raw);
    return [raw, pk.loadFishPicks()];
  }),
  save: [[], ["a"], ["a", "b", "c", "d"], ['có "ngoặc"\\']].map((p) => {
    store.clear();
    const ok = pk.saveFishPicks(p);
    return [p, ok, store.get("forfish.fishPicks.v1")];
  }),
};
const cellIdx = [0, 5, 10, cells.length - 2, cells.length - 1];
picks.diem = cellIdx.flatMap((i) => picks.bo.map((b) => [i, b, pk.diemTheoBo(cells[i], b), pk.loaiNoiTheoBo(cells[i], b)]));

/* ── 5. pha mùa vụ + màn hình lớp cá ── */
const climFile = docData("fish-climatology.v1.json");
const clim = fb.decodeClimatology(climFile);
const tom = (fc) => {
  const cs = fc.cells;
  return {
    n: cs.length,
    sumS: cs.reduce((a, c) => a + c.s, 0),
    nClim: cs.filter((c) => c.fromClim).length,
    // điểm loài: tổng + số mục (bắt sai ở phép co giãn theo tỉ lệ) — không ghi từng ô cho gọn
    spSum: cs.reduce((a, c) => a + Object.values(c.sp).reduce((x, y) => x + y, 0), 0),
    spN: cs.reduce((a, c) => a + Object.keys(c.sp).length, 0),
    // mẫu thưa: mỗi ô thứ 9 (đủ bắt lệch thứ tự xếp hạng) + mọi ô ≥ 75
    mau: cs.flatMap((c, i) => (i % 9 === 0 || c.s >= 75 ? [[i, c.lat, c.lon, c.s, c.fromClim ? 1 : 0]] : [])),
  };
};
// hình ô cá không pha thì chỉ phụ thuộc (bản, bộ loài) ⇒ ghi MỘT lần, các ca sau trỏ tới khoá
const geoKho = {};
const geoMot = (ten, bo, g) => {
  const k = ten + "|" + bo.join(",");
  if (!(k in geoKho)) geoKho[k] = g;
  return k;
};
const geoTom = (g) => (g ? { n: g.features.length, sumS: g.features.reduce((a, f) => a + f.properties.s, 0), nM: g.features.filter((f) => f.properties.m).length } : null);
const NEO = [[], [{ lat: 10.35, lon: 107.07 }], [{ lat: 12.25, lon: 109.2 }, { lat: 9.9, lon: 108.0 }]];
const manHinh = [];
const chuaPha = { lead: [], weight: [], spacing: [] };
mp.__resetModelParamsForTest();
for (const coBang of [false, true]) {
  if (coBang) mp.setModelParams(docData("model-params.v1.json"));
  for (const [ten, cast] of [["tho", THO], ["nen", THO_NEN]]) {
    for (const [viewIso, daysAhead] of [["2026-11-01", 0], ["2026-11-04", 3], ["2026-11-12", 11], ["2026-12-30", 15], ["2026-11-0x", 2]]) {
      const lead = fb.fishLeadDays(cast.date, viewIso, daysAhead);
      const locCast = vb.locBanDoCaTrongVung(cast);
      const view = fishViewOf(locCast, clim, lead, viewIso);
      const daPha = view !== locCast;
      const step = fishGridStep(locCast);
      for (const bo of [[], ["ngừ vằn", "cá nục"]]) {
        const g = fishGridGeoOf(view, bo, step, false);
        manHinh.push({
          coBang, ten, viewIso, daysAhead, lead, step, bo, daPha,
          view: daPha && bo.length === 0 ? tom(view) : null,
          geo: daPha ? null : geoMot(ten, bo, gonGeo(g)),
          geoTom: geoTom(g),
          diemNong: NEO.map((n) => [n, fishHotspotsOf(view, bo, false, n, lead)]),
        });
      }
    }
  }
  chuaPha.weight.push([0, 1, 2, 3, 4, 5, 8, 10, 16, 20, -1].map((d) => [d, fb.blendWeight(d), fb.climShare(d), fb.measuredWeight(d), fb.blendScore(60, 30, d)]));
}
chuaPha.usable = fb.blendUsable();
chuaPha.maxLead = fb.maxMeasuredLead();
chuaPha.lead = [["2026-11-01", "2026-11-04", 0], ["2026-11-04", "2026-11-01", 0], [null, "2026-11-04", 2], ["rac", "2026-11-04", 3], ["2026-11-01", "", 1], ["2026-10-24", "2026-11-04", 3], ["2026-02-31", "2026-03-05", 0], ["2026-11-01", "2026-11-04", -2]].map(
  ([a, b, d]) => [a, b, d, fb.fishLeadDays(a, b, d)],
);
chuaPha.spacing = [0, 1, 2, 3, 4, 5, 6, 8, 9, 12, 14, 16, 30, -3, 0.5].map((d) => [d, fb.hotspotSpacingDeg(d), fb.hotspotMaxCount(d)]);
chuaPha.scale = [[11, cells.map((c) => c.s)], [7, [50, 60, 0, 99, 100, 40]], [3, []], [13, [50]]].map(([m, ds]) => [m, ds, [...fb.buildClimScaleMap(clim, m, ds)]]);
chuaPha.climAt = [[10.025, 108.025, 11], [5.025, 102.025, 1], [22.0, 118.0, 6], [4.0, 110.0, 6], [12.6, 109.4, 13]].map(([a, b, m]) => [a, b, m, fb.climScoreAt(clim, a, b, m)]);

/* ── 6. mật độ tàu (file thật) ── */
const den = docData("fleet-density.v1.json");
const WIND = [
  { lat: 10.35, lon: 107.07, byDate: { "2026-11-04": 30, "2026-11-07": 45, "2026-11-14": 70, "2026-07-15": 20, "2026-07-18": 52 } },
  { lat: 16.07, lon: 108.22, byDate: { "2026-11-04": 64, "2026-11-07": 39, "2026-07-18": 38.9 } },
  { lat: 10.22, lon: 103.96, byDate: { "2026-11-04": 50, "2026-11-07": 61.9 } },
];
const BAO = [{ lat: 14.5, lon: 113.0, track: [[113.0, 14.5], [111.5, 15.2], [110.0, 16.0], [1]], areas: [[[[112, 13], [115, 13], [115, 16], [112, 16], [112, 13]]]] }];
const FCA = [
  { ten: "a", todayIso: "2026-11-04", dayOffset: 0, gear: "tat" },
  { ten: "b", todayIso: "2026-11-04", dayOffset: 3, gear: "cau", wind: WIND, stormDays: ["2026-11-07"], storms: BAO },
  { ten: "c", todayIso: "2026-11-04", dayOffset: 10, gear: "vay", wind: WIND, stormDays: ["2026-11-14"], storms: [] },
  { ten: "d", todayIso: "2026-07-15", dayOffset: 3, gear: "re", wind: WIND },
  { ten: "e", todayIso: "2026-09-29", dayOffset: 5, gear: "khac", wind: [], stormDays: ["2026-10-04"], storms: [{ lat: 9.5, lon: 109.0 }] },
];
const matDo = FCA.map((ca) => {
  const f = fd.forecastFleetDensity({ d: den, todayIso: ca.todayIso, dayOffset: ca.dayOffset, gear: ca.gear, wind: ca.wind, stormDays: ca.stormDays ? new Set(ca.stormDays) : undefined, storms: ca.storms });
  const g = fleetGridGeoOf(f.cells, den.axis.step);
  const { cells: cs, ...meta } = f;
  return {
    ...ca,
    meta,
    n: cs.length,
    sum: [cs.reduce((a, c) => a + c.score, 0), cs.reduce((a, c) => a + c.level, 0), cs.reduce((a, c) => a + c.vessels, 0), cs.reduce((a, c) => a + (c.vesselsPerDay ?? -1), 0), cs.reduce((a, c) => a + c.value, 0), cs.reduce((a, c) => a + c.stormF, 0)],
    mau: cs.flatMap((c, i) => (i % 11 === 0 ? [[i, c.lat, c.lon, c.hoursPerDay, c.vessels, c.value, c.score, c.level, c.vesselsPerDay, c.stormF]] : [])),
    geo: g ? g.features.flatMap((ft, i) => (i % 23 === 0 ? [[i, ft.properties.lv, ft.properties.n, ft.properties.h, ft.geometry.coordinates[0][0][0], ft.geometry.coordinates[0][0][1], ft.geometry.coordinates[0][2][0], ft.geometry.coordinates[0][2][1]]] : [])) : null,
    line: fleetLine({ state: "ok", empty: cs.length === 0, windMissing: f.windMissing, windPartial: f.windPartial, storm: f.storm, stormCells: f.stormCells, thinBase: f.thinBase, baseDays: f.baseDays }),
  };
});
const bool = [false, true];
const dong = [];
for (const state of ["idle", "error"]) dong.push([state, false, false, false, false, 0, false, 6, fleetLine({ state, empty: false, windMissing: false, windPartial: false, storm: false, stormCells: 0, thinBase: false, baseDays: 6 })]);
for (const state of ["ok"])
  for (const empty of bool) for (const windMissing of bool) for (const windPartial of bool) for (const storm of bool) for (const stormCells of [0, 4]) for (const thinBase of bool)
    dong.push([state, empty, windMissing, windPartial, storm, stormCells, thinBase, 6, fleetLine({ state, empty, windMissing, windPartial, storm, stormCells, thinBase, baseDays: 6 })]);
const dl = (vs) => {
  const cs = vs.map((v) => ({ lat: 0, lon: 0, hoursPerDay: v, vessels: 1 }));
  const r = fd.densityLevel(cs);
  return [vs, r.thresholds, cs.map(r.levelOf)];
};
const matDoPhu = {
  windFactor: [undefined, null, NaN, 0, 38.9, 39, 49.99, 50, 61.9, 62, 200].map((k) => [k === undefined ? "u" : k === null || Number.isNaN(k) ? null : k, fd.windFactor(k)]),
  storm: [[14.5, 113.0], [13.5, 113.5], [16.5, 110.0], [12.0, 109.0], [10.0, 107.0], [20.0, 120.0], [8.0, 104.0]].map(([a, b]) => [a, b, fd.stormFactorAt(BAO, a, b), fd.stormFactorAt([], a, b), fd.stormFactorAt([{ lat: 10, lon: 108 }, ...BAO], a, b)]),
  km: [[10, 107, 16, 108], [0, 0, 0, 1], [20, 110, 20, 110], [-5, 100, 25, 120]].map(([a, b, c, d]) => [a, b, c, d, fd.kmBetween(a, b, c, d)]),
  can: ["0938635689", "+84 938 635 689", "84938635689", "0938.635.689", "0912345678", "", null, "8484938635689"].map((p) => [p, fd.canSeeDensity(p)]),
  addDays: [["2026-11-04", 0], ["2026-11-04", 27], ["2026-12-31", 1], ["2026-02-28", 1], ["2028-02-28", 1], ["2026-02-31", 0], ["2026-03-01", -1]].map(([i, n]) => [i, n, fd.addDaysIso(i, n)]),
  moon: ["2026-11-04", "2026-11-09", "2026-11-17", "2026-11-24", "2026-12-01", "2000-01-06", "2026-07-15"].map((i) => [i, fd.moonBinOf(new Date(`${i}T05:00:00Z`))]),
  level: [[], [3], [2, 2, 2], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [0.5, 0.1, 9, 3.3, 3.3, 7]].map(dl),
  baseDays: Array.from({ length: 12 }, (_, k) => String(k + 1).padStart(2, "0")).map((mm) => [mm, fd.seasonBaseDays(den, mm)]),
  species: [[10.525, 107.775, "month", "2026-10"], [10.4, 107.9, "season", "nam"], [12.0, 109.5, "moon", "3"], [3.0, 100.0, "month", "2026-10"], [10.525, 107.775, "day", "2026-13-01"]].map(([a, b, m, k]) => [a, b, m, k, fd.densitySpeciesAt(den, { mode: m, key: k, gear: "tat" }, a, b)]),
  keyFor: [["day", "2026-10-05"], ["month", "2026-03"], ["season", "bac"], ["moon", "4"], ["day", "x"]].map(([m, k]) => [m, k, fd.speciesKeyFor({ mode: m, key: k, gear: "tat" })]),
  chip: Array.from({ length: fd.FLEET_FORECAST_DAYS }, (_, k) => fd.addDaysIso("2026-11-04", k)),
};
const hang = {
  bands: fp.FISH_LEVEL_BANDS,
  levels: fd.DENSITY_LEVELS,
  gears: fd.DENSITY_GEARS,
  modes: fd.DENSITY_MODES,
  seasons: fd.DENSITY_SEASONS,
  moons: fd.DENSITY_MOONS,
  so: [fd.FLEET_FORECAST_DAYS, fd.DENSITY_MIN_SCORE, ...fd.DENSITY_SCORE_BANDS, fd.DENSITY_LOCAL_RADIUS_KM, fd.DENSITY_LOCAL_FLOOR, fd.DENSITY_THIN_DAYS, fd.WIND_STATION_MAX_KM, fd.STORM_NEAR_KM, fd.STORM_FAR_KM],
  built: fd.FLEET_DENSITY_BUILT,
  url: fd.fleetDensityUrl(),
  absent: fb.ABSENT_PERSIST,
};
const failNote = ["login_required", "no_token", "unknown_token", "token_revoked", "premium_required", "unavailable", null, "khac"].map((c) => [c, sr.fishFailNote(c)]);

const vang = { geoKho, tho: THO, thoNen: THO_NEN, loc, vung, picks, chuaPha, manHinh, matDo, matDoPhu, dong, hang, failNote };
const thuMuc = join(goc, "../shared/src/jvmTest/resources/ca");
mkdirSync(thuMuc, { recursive: true });
const out = JSON.stringify(vang) + "\n";
writeFileSync(join(thuMuc, "vang.json"), out);
console.log(`[sinh-ca] ${cells.length} ô giả · ${manHinh.length} ca màn hình · ${matDo.map((m) => m.n).join("/")} ô mật độ · ${(out.length / 1024).toFixed(1)} KB`);
