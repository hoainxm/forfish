// VECTOR VÀNG CHO DẪN ĐƯỜNG (app-map 18 §5, đợt 2f) + SINH CẢNG / RANH GIỚI.
//
//   node native/scripts/sinh-duong.mjs ⇒ native/shared/src/jvmTest/resources/duong/vang.json ⇒ DuongVangTest.kt
//                                      + commonMain/.../danduong/CangSinh.kt (src/data/ports.ts PORTS)
//                                      + commonMain/.../danduong/BienSinh.kt (geofence.ts VN_OUTER_BORDER / VN_ALLOWED_POLYS)
//
// Chạy CHÍNH code web (jiti, alias "@"): route-plan, route-grid, route-weather (gridToWeatherField, noWeatherField),
// hazards, route-hazards (auditRoute), route-multi, route-legs, route-storm, storms (stormGateForRoute),
// route-danger-items, route-stops, saved-routes, depth-grid, reef-depth + bộ giải kho (xac-tau, seamarks, vn-aids,
// soundings, soundings-verified, fairway-depth, tides). Khối `compute()` của src/components/route-planner.tsx (~727–1130)
// viết thẳng trong component ⇒ CHÉP Y vào `tinhNhuManHinh` dưới đây; sửa ở web thì sửa bản chép, chạy lại script,
// rồi sửa DanDuong.kt cho xanh.
//
// Đầu vào: file THẬT public/data (độ sâu, độ sâu rạn, xác tàu, sea-lanes, seamarks, vn-aids, số đo sâu, đối chiếu,
// luồng, rạn có tên, trạm triều — bản rõ trong git; test Kotlin đọc thẳng) + lưới thời tiết GIẢ dựng từ CÔNG THỨC SỐ
// NGUYÊN (`oMat` — Kotlin chép y) qua đúng đường ô `routegrid` ⇒ `stitchRouteField`. Mốc giờ GHIM.
// Mẫu GỌN: chỉ ghi kết quả (đường đi dạng mảng phẳng lat,lon,…).
process.env.TZ = "Asia/Ho_Chi_Minh";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const lib = (p) => jiti.import("@/lib/" + p);

const rp = await lib("route-plan");
const rg = await lib("route-grid");
const rw = await lib("route-weather");
const hz = await lib("hazards");
const rh = await lib("route-hazards");
const rm = await lib("route-multi");
const rl = await lib("route-legs");
const rs = await lib("route-storm");
const sto = await lib("storms");
const rdi = await lib("route-danger-items");
const rst = await lib("route-stops");
const svr = await lib("saved-routes");
const dg = await lib("depth-grid");
const rd = await lib("reef-depth");
const xt = await lib("xac-tau");
const sm = await lib("seamarks");
const va = await lib("vn-aids");
const snd = await lib("soundings");
const sv = await lib("soundings-verified");
const fw = await lib("fairway-depth");
const td = await lib("tides");
const sl = await lib("sea-lanes");
const gf = await lib("geofence");
const sea = await lib("sea");
const { PORTS } = await jiti.import("@/data/ports");

const KT = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/danduong");
mkdirSync(KT, { recursive: true });

/* ── 0a. CangSinh.kt ── */
{
  const s = (x) => JSON.stringify(x);
  const kt =
    "// SINH TỰ ĐỘNG bởi native/scripts/sinh-duong.mjs từ src/data/ports.ts (PORTS) — ĐỪNG SỬA TAY.\n" +
    "package vn.sdvico.forfish.shared.danduong\n\n" +
    "/** = FishingPort */\n" +
    "data class CangCa(val id: String, val name: String, val province: String, val lat: Double, val lon: Double)\n\n" +
    "/** = PORTS: cảng cá lớn dọc bờ biển VN, Bắc → Nam. */\n" +
    "object CangSinh {\n" +
    "    val PORTS = listOf(\n" +
    PORTS.map((p) => `        CangCa(${s(p.id)}, ${s(p.name)}, ${s(p.province)}, ${p.lat}, ${p.lon}),\n`).join("") +
    "    )\n}\n";
  writeFileSync(join(KT, "CangSinh.kt"), kt);
}

/* ── 0b. BienSinh.kt (hằng của geofence: mép ngoài vùng VMS + đa giác vùng được phép) ── */
{
  const line = JSON.stringify(gf.VN_OUTER_BORDER);
  const polys = JSON.stringify(gf.VN_ALLOWED_POLYS);
  const kt =
    "// SINH TỰ ĐỘNG bởi native/scripts/sinh-duong.mjs từ src/data/vms-zones.json (VN_OUTER_BORDER / VN_ALLOWED_POLYS\n" +
    "// của geofence.ts) — ĐỪNG SỬA TAY.\n" +
    "package vn.sdvico.forfish.shared.danduong\n\n" +
    "internal object BienSinh {\n" +
    "    /** đường biên ngoài khơi [[lon, lat], …] */\n" +
    `    const val LINE = ${JSON.stringify(line)}\n` +
    "    /** vùng được phép [poly][ring][[lon, lat]] */\n" +
    `    const val POLYS = ${JSON.stringify(polys)}\n` +
    "}\n";
  if (Buffer.byteLength(polys) > 60000) throw new Error("BienSinh.POLYS vượt trần hằng chuỗi JVM");
  writeFileSync(join(KT, "BienSinh.kt"), kt);
}

/* ── 1. kho thật ── */
const data = (ten) => readFileSync(join(repo, "public/data", ten));
const json = (ten) => JSON.parse(data(ten).toString("utf8"));
const buf = (ten) => { const b = data(ten); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const depth = dg.decodeDepthGrid(buf("depth-grid.v1.bin"));
const reefDepth = rd.decodeReefDepth(buf("reef-depth.v1.bin"));
const fc = (ten) => { const j = json(ten); return Array.isArray(j?.features) ? j.features : []; };
const KHO = {
  xacTau: xt.decodeXacTau(json("xac-tau.v1.json")),
  laneFeatures: fc("vn-sea-lanes.v1.json"),
  seamarks: sm.decodeSeamarks(json("seamarks.v1.json")),
  soundings: snd.decodeSoundings(json("soundings.v1.json")),
  verdicts: sv.decodeVerdicts(json("soundings-verified.v1.json")),
  fairways: fw.decodeFairwayDepths(json("fairway-depths.v1.json")),
  vnAids: va.decodeVnAids(json("vn-aids.v1.json")),
  reefs: fc("coral-reefs.v1.json"),
  tides: td.decodeTideStations(json("tide-stations.v1.json")),
};

/* ── 2. lưới thời tiết GIẢ: công thức số nguyên theo mắt toàn cục (I, J) và giờ t ── */
const NOW = Date.UTC(2026, 10, 4, 1, 20, 0); // 08:20 giờ VN, 2026-11-04
const DAY = 86400000;
const toaDo = (base, k) => Number((base + k * rg.ROUTE_GRID_STEP).toFixed(3));
function oMat(I, J, t, kb) {
  const lat = toaDo(rg.ROUTE_GRID_LAT0, I);
  const lon = toaDo(rg.ROUTE_GRID_LON0, J);
  if (dg.depthClassAt(depth, lat, lon) === 0) return null;
  if (kb.lo && I >= kb.lo[0] && I <= kb.lo[1] && J >= kb.lo[2] && J <= kb.lo[3]) return null;
  const s = kb.seed;
  let w = 100 + ((I * 37 + J * 53 + t * 11 + s * 7) % 150);
  const wd = (I * 13 + J * 29 + t * 5 + s) % 360;
  let h = 50 + ((I * 17 + J * 23 + t * 3 + s * 5) % 120);
  const hd = (I * 7 + J * 11 + t * 2 + s * 3) % 360;
  const p = 50 + ((I + J + t) % 60);
  const c = (I * 3 + J * 5 + t) % 80;
  const cd = (I * 19 + J * 31 + t * 7) % 360;
  if (kb.du && I >= kb.du[0] && I <= kb.du[1] && J >= kb.du[2] && J <= kb.du[3]) { h += kb.du[4]; w += kb.du[5]; }
  const songNull = kb.songNull && (I + J + t) % kb.songNull === 0;
  return { w, wd, h: songNull ? null : h, hd: songNull ? null : hd, p: songNull ? null : p, c: (I + t) % 9 === 0 ? null : c, cd: (I + t) % 9 === 0 ? null : cd };
}
function dungO(kb) {
  const tiles = new Map();
  const start = rg.vnDate(new Date(NOW - (kb.lui ?? 0) * DAY));
  const builtAt = new Date(NOW - 3600000).toISOString();
  const H = rg.ROUTE_GRID_FORECAST_DAYS * 24;
  for (let r = 0; r < rg.ROUTE_TILES; r++)
    for (let c = 0; c < rg.ROUTE_TILES; c++) {
      if (kb.thieuO && kb.thieuO.includes(`${r}:${c}`)) continue;
      const cells = [];
      for (let i = 0; i < rg.ROUTE_TILE_N; i++)
        for (let j = 0; j < rg.ROUTE_TILE_N; j++) {
          const I = r * rg.ROUTE_TILE_N + i, J = c * rg.ROUTE_TILE_N + j;
          if (oMat(I, J, 0, kb) === null) { cells.push(null); continue; }
          const k = { w: [], wd: [], h: [], hd: [], p: [], c: [], cd: [] };
          for (let t = 0; t < H; t++) { const v = oMat(I, J, t, kb); for (const key in k) k[key].push(v[key]); }
          cells.push(k);
        }
      const tile = { v: 1, r, c, start, builtAt, cells };
      if (!rg.isRouteTile(tile)) throw new Error("ô giả sai hình");
      tiles.set(rg.routeTileId(r, c), tile);
    }
  return tiles;
}

/* lưới Windy GIẢ đã lưu (cho nhánh offline gridToWeatherField) — cùng kiểu công thức */
function luoiLuu(seed) {
  const pts = [];
  // = gridPoints() của forecast-grid (13 × 12, 98–123°Đ, 1–24°B, làm tròn 0,01)
  for (let i = 0; i < 12; i++) for (let j = 0; j < 13; j++)
    pts.push({ lat: Math.round((1 + (i * 23) / 11) * 100) / 100, lon: Math.round((98 + (j * 25) / 12) * 100) / 100 });
  const times = [];
  const t0 = Date.parse(`${rg.vnDate(new Date(NOW - DAY))}T00:00:00Z`);
  for (let k = 0; k < 32; k++) times.push(new Date(t0 + k * 3 * 3600000).toISOString().slice(0, 16));
  const cells = pts.map((p, n) => ({
    lat: p.lat, lon: p.lon,
    hours: times.map((_, k) => (n % 7 === 0
      ? { windKmh: 10 + ((n + k) % 20), windDirDeg: (n * 11 + k * 7) % 360, waveM: null, waveDirDeg: null, curKmh: null, curDirDeg: null }
      : { windKmh: (100 + ((n * 7 + k * 13 + seed) % 200)) / 10, windDirDeg: (n * 11 + k * 7) % 360, waveM: (40 + ((n * 5 + k * 3 + seed) % 150)) / 100,
          waveDirDeg: (n * 3 + k * 17) % 360, curKmh: null, curDirDeg: null })),
  }));
  return { cells, times };
}

/* ── 3. CHÉP Y route-planner.tsx compute() (~727–1130), phần thuần ── */
const VN_SEA = { latMin: 4, latMax: 24.5, lonMin: 99, lonMax: 119 };
const clampBBox = (b) => ({ latMin: Math.max(b.latMin, VN_SEA.latMin), latMax: Math.min(b.latMax, VN_SEA.latMax),
  lonMin: Math.max(b.lonMin, VN_SEA.lonMin), lonMax: Math.min(b.lonMax, VN_SEA.lonMax) });
const vnHourIndex = (ms) => Math.floor((((ms + 7 * 3600000) % DAY) + DAY) % DAY / 3600000);

function tinhNhuManHinh(dv, truongCho) {
  const legPts = [dv.start, ...dv.stops];
  for (let i = 1; i < legPts.length; i++) if (rp.haversineKm(legPts[i - 1], legPts[i]) < 5) return { kind: "qua-gan", chang: i };
  const ngoai = legPts.findIndex((p) => p.lat < VN_SEA.latMin || p.lat > VN_SEA.latMax || p.lon < VN_SEA.lonMin || p.lon > VN_SEA.lonMax);
  if (ngoai >= 0) return { kind: "ngoai-vung", chiSo: ngoai };
  const boat = dv.boat;
  const departHourIdx = vnHourIndex(dv.nowMs);
  let dist = 0;
  for (let i = 1; i < legPts.length; i++) dist += rp.haversineKm(legPts[i - 1], legPts[i]);
  const margins = [Math.min(150, Math.max(45, dist * 0.3)), Math.min(420, Math.max(200, dist * 1.1))];
  const k = dv.kho;
  const reefDepthK = dv.reefDepth;
  const thieuDoSauRan = reefDepthK ? [] : ["do-sau-ran"];
  const needM = hz.requiredDepthM(boat.draftM ?? null, null);
  const kho = hz.buildHazardList({ xacTau: k.xacTau, laneFeatures: k.laneFeatures, seamarks: k.seamarks }, needM, dv.namNay);
  const soiHiemHoa = k.xacTau != null || k.laneFeatures != null || k.seamarks != null;
  let plan = null, stopWpIdx = [], legSums = [], chosenField = null, failedLeg = 0, failure = "no-route", biTuChoi = false, biTuChoiNgay = false;
  for (let mi = 0; mi < margins.length; mi++) {
    const bbox = clampBBox(rp.bboxOfPoints(legPts, margins[mi]));
    const field = truongCho(bbox);
    if (field.rateLimited) biTuChoi = true;
    if (field.rateLimitDaily) biTuChoiNgay = true;
    const hazards = soiHiemHoa ? hz.packHazards(hz.hazardsInBBox(kho.hazards, bbox, 0)) : null;
    const legs = [];
    let hoursSoFar = 0;
    for (let i = 1; i < legPts.length; i++) {
      const outcome = rp.planRouteWithDiagnostics({
        start: legPts[i - 1], dest: legPts[i], boat, departHourIdx: departHourIdx + Math.round(hoursSoFar), field, depth: dv.depth, bbox,
        hazards, noGo: soiHiemHoa ? kho.noGo : null, reefDepth: reefDepthK ? rd.reefDepthInBBox(reefDepthK, bbox) : null,
      });
      const leg = outcome.plan;
      if (!leg) { failedLeg = i; failure = outcome.failure ?? "no-route"; break; }
      legs.push(leg);
      hoursSoFar += leg.hours;
    }
    if (legs.length === legPts.length - 1) {
      const merged = rm.mergeLegPlans(legs);
      if (merged) { plan = merged.plan; stopWpIdx = merged.stopWpIdx; legSums = merged.legs; chosenField = field; break; }
    }
  }
  if (!plan) return { kind: "khong-ra-tuyen", chang: Math.max(1, failedLeg), failure, biTuChoi, biTuChoiNgay };
  const gate = sto.stormGateForRoute(dv.stormStatus, dv.nowMs);
  const conflict = rs.routeStormConflict(plan.waypoints, dv.storms);
  if (conflict) return { kind: "bao-chan", stormId: conflict.storm.id, distKm: conflict.distKm, cong: gate };
  let hits, missing;
  try {
    const kq = rh.auditRoute({
      waypoints: plan.waypoints, hoursAt: plan.hoursAt, departMs: dv.nowMs, draftM: boat.draftM ?? null,
      waveMAt: (i) => {
        const wp = plan.waypoints[i];
        if (!wp) return null;
        const h = rp.sampleField(chosenField, wp.lat, wp.lon, departHourIdx + (plan.hoursAt[i] ?? 0));
        return h ? h.waveM ?? sea.estimateWaveFromWind(h.windKmh) : null;
      },
      stores: {
        hazards: kho.hazards, passable: kho.passable, soundings: k.soundings ?? undefined, verdicts: k.verdicts ?? undefined,
        fairways: k.fairways ?? undefined, lanes: k.laneFeatures ?? undefined, seamarks: k.seamarks ?? undefined,
        vnAids: k.vnAids ?? undefined, reefs: k.reefs ?? undefined, tides: k.tides ?? undefined, border: true,
      },
    });
    hits = kq.hits;
    missing = [...new Set([...kho.missing, ...kq.missing, ...thieuDoSauRan])];
  } catch {
    hits = [];
    missing = [...new Set([...kho.missing, rdi.KHO_HAU_KIEM, ...thieuDoSauRan])];
  }
  return {
    kind: "co-tuyen", plan, stopWpIdx, legs: legSums, legBoundsKm: rl.cumulativeKmAt(plan.waypoints, stopWpIdx),
    fieldSource: chosenField.source ?? null, cong: gate, hits, missing,
    canhBao: rdi.buildDangerItems(plan, hits), seGap: rdi.buildWillMeet(hits), chuaSoi: rdi.moTaThieu(missing),
  };
}

/* ── 4. gọn hoá kết quả ── */
const phang = (pts) => pts.flatMap((p) => [p.lat, p.lon]);
const gonPlan = (p) => ({ ...p, waypoints: phang(p.waypoints) });
function gonKq(r) {
  if (r.kind !== "co-tuyen") return r;
  return { ...r, plan: gonPlan(r.plan) };
}

/* ── 5. kịch bản ── */
const P = Object.fromEntries(PORTS.map((p) => [p.id, { lat: p.lat, lon: p.lon }]));
const BOAT = rp.DEFAULT_BOAT;
const khongCoBao = { kind: "khong-co", checkedAt: NOW - 3600000 };
const KB = [
  { ten: "vt-con-dao", start: P["vung-tau"], stops: [{ lat: 8.68, lon: 106.61 }], boat: BOAT, kb: { seed: 1 } },
  { ten: "quy-nhon-2-diem", start: P["quy-nhon"], stops: [{ lat: 13.3, lon: 109.75 }, { lat: 12.75, lon: 109.6 }],
    boat: { speedKn: 8.5, litersPerHour: 26, draftM: 1.8, fuelTankL: 1500, lengthM: 15 }, kb: { seed: 2, lui: 1, songNull: 7 } },
  { ten: "song-du", start: P["phan-thiet"], stops: [{ lat: 10.1, lon: 109.0 }], boat: BOAT,
    kb: { seed: 3, du: [10, 16, 18, 22, 330, 450] } },
  { ten: "song-du-chan-het", start: P["hon-ro"], stops: [{ lat: 11.6, lon: 109.6 }], boat: BOAT,
    kb: { seed: 4, du: [0, 47, 0, 47, 420, 300] } },
  { ten: "khong-du-bao", start: P["vung-tau"], stops: [{ lat: 8.68, lon: 106.61 }], boat: BOAT, kb: null },
  { ten: "rach-gia-khong-du-bao", start: P["rach-gia"], stops: [{ lat: 10.05, lon: 104.3 }], boat: BOAT, kb: null },
  { ten: "lo-du-bao", start: P["vung-tau"], stops: [{ lat: 9.4, lon: 107.9 }], boat: { ...BOAT, draftM: 2.5 },
    kb: { seed: 5, lo: [9, 12, 15, 17] } },
  { ten: "luoi-luu", start: P["tho-quang"], stops: [{ lat: 15.9, lon: 109.0 }], boat: BOAT, luu: 9 },
  { ten: "bao-chan", start: P["vung-tau"], stops: [{ lat: 8.68, lon: 106.61 }], boat: BOAT, kb: { seed: 1 },
    storms: [{ id: "s1", name: "TEST", kindLabel: "Bão", windKmh: 90, lat: 8.0, lon: 108.2, alert: "danger", updated: "2026-11-04T00:00:00Z",
      track: [[110, 7.5], [108.2, 8.0], [107.0, 8.8], [106.0, 9.5]], areas: [] }] },
  { ten: "cang-song", start: { lat: 10.36, lon: 106.36 }, stops: [{ lat: 9.9, lon: 106.9 }], boat: BOAT, kb: { seed: 6 } },
  { ten: "gian-khoan", start: P["vung-tau"], stops: [{ lat: 9.2, lon: 108.4 }], boat: { ...BOAT, draftM: 2.2 }, kb: { seed: 7 } },
  { ten: "truong-sa", start: { lat: 11.43, lon: 114.33 }, stops: [{ lat: 10.95, lon: 114.65 }], boat: { ...BOAT, draftM: 2.0 }, kb: { seed: 8 } },
  { ten: "luong-vt", start: P["vung-tau"], stops: [{ lat: 10.42, lon: 106.95 }], boat: { ...BOAT, draftM: 2.5 }, kb: { seed: 9 } },
  { ten: "bien-gioi", start: { lat: 9.0, lon: 104.3 }, stops: [{ lat: 7.6, lon: 103.6 }], boat: BOAT, kb: { seed: 10 } },
  { ten: "da-nang-cap", start: P["tho-quang"], stops: [{ lat: 16.3, lon: 108.6 }], boat: { ...BOAT, draftM: 3 }, kb: { seed: 11 } },
  { ten: "qua-cua-so", start: P["vung-tau"], stops: [{ lat: 8.68, lon: 106.61 }], boat: BOAT, kb: { seed: 1, lui: 3 } },
  { ten: "vong-qua-tran", start: P["phan-thiet"], stops: [{ lat: 10.1, lon: 109.0 }], boat: BOAT, kb: { seed: 3, du: [6, 30, 17, 23, 200, 250] } },
  { ten: "cua-lo-luong", start: P["cua-lo"], stops: [{ lat: 18.65, lon: 106.2 }], boat: { ...BOAT, draftM: 2.5 }, kb: { seed: 12 } },
  { ten: "sa-ky-luong", start: P["sa-ky"], stops: [{ lat: 15.0, lon: 109.3 }], boat: { ...BOAT, draftM: 3.2 }, kb: { seed: 13 } },
  { ten: "gian-khoan-bac", start: { lat: 20.8, lon: 111.1 }, stops: [{ lat: 21.2, lon: 112.0 }], boat: BOAT, kb: { seed: 14 } },
  { ten: "vong-a", start: P["phan-thiet"], stops: [{ lat: 10.1, lon: 109.0 }], boat: BOAT, kb: { seed: 3, du: [9, 15, 17, 20, 200, 350] } },
  { ten: "vong-b", start: P["phan-thiet"], stops: [{ lat: 10.1, lon: 109.0 }], boat: BOAT, kb: { seed: 3, du: [11, 13, 17, 20, 150, 350] } },
  { ten: "vong-c", start: P["vung-tau"], stops: [{ lat: 8.68, lon: 106.61 }], boat: BOAT, kb: { seed: 2, du: [6, 11, 12, 15, 200, 350] } },
  { ten: "qua-gan", start: P["vung-tau"], stops: [{ lat: 10.33, lon: 107.1 }], boat: BOAT, kb: { seed: 1 } },
  { ten: "ngoai-vung", start: P["vung-tau"], stops: [{ lat: 3.5, lon: 107.1 }], boat: BOAT, kb: { seed: 1 } },
];

const ra = { now: NOW, kichBan: [] };
for (const k of KB) {
  const t0 = performance.now();
  let truongCho;
  if (k.luu != null) {
    const g = luoiLuu(k.luu);
    truongCho = () => rw.gridToWeatherField(g, new Date(NOW), NOW - 5 * 3600000) ?? rw.noWeatherField(new Error("x"));
  } else if (k.kb == null) {
    truongCho = () => rw.noWeatherField(new rw.WeatherRateLimitError(true));
  } else {
    const tiles = dungO(k.kb);
    truongCho = (bbox) => rg.stitchRouteField(bbox, tiles, new Date(NOW), 72) ?? rw.noWeatherField(new Error("x"));
  }
  const kq = tinhNhuManHinh({
    start: k.start, stops: k.stops, boat: k.boat, nowMs: NOW, depth, kho: KHO, reefDepth,
    stormStatus: k.storms ? { kind: "co-bao", storms: k.storms, checkedAt: NOW - 3600000, cu: false } : khongCoBao,
    storms: k.storms ?? [], namNay: 2026,
  }, truongCho);
  const ms = Math.round(performance.now() - t0);
  console.log(`${k.ten}: ${kq.kind} ${ms} ms` + (kq.plan ? ` · ${kq.plan.waypoints.length} điểm · ${kq.plan.distKm.toFixed(1)} km` : ""));
  ra.kichBan.push({ ten: k.ten, ms, ...k, kq: gonKq(kq) });
}

/* ── 6. vector lẻ ── */
ra.le = {
  formatHours: [0, 0.04, 0.5, 1, 1.999, 9.58, 25.0417, 100.2].map((h) => [h, rp.formatHoursVN(h)]),
  fuel: [[null, 50], [1000, 300], [1000, 400], [0, 10], [500, -1], [200000, 10]].map(([t, f]) => [t, f, rp.fuelReturnCheck({ fuelTankL: t }, f)]),
  khoangCach: [0, 0.01, 0.4, 0.974, 0.975, 1.852, 10, 18.5, 18.52, 30, 200].map((km) => [km, rh.khoangCachText(km)]),
  tileIds: [
    { latMin: 8, latMax: 10.6, lonMin: 105.5, lonMax: 108.2 },
    { latMin: 5, latMax: 25, lonMin: 100, lonMax: 120 },
    { latMin: 30, latMax: 31, lonMin: 105, lonMax: 106 },
    { latMin: 15.9, latMax: 16.1, lonMin: 104.7, lonMax: 104.9 },
  ].map((b) => [b, rg.routeTileIdsForBBox(b)]),
  cong: [
    { kind: "dang-hoi" }, { kind: "khong-hoi-duoc", checkedAt: null }, { kind: "khong-hoi-duoc", checkedAt: NOW - 5 * 3600000 },
    { kind: "khong-hoi-duoc", checkedAt: NOW - 80 * 3600000 }, { kind: "khong-co", checkedAt: NOW },
  ].map((s) => [s, sto.stormGateForRoute(s, NOW)]),
  placeId: [[10.3456, 107.0849], [-0.0004, 0.0005], [12.2, 109.25]].map(([a, b]) => [a, b, (() => {
    const l = rst.addStop([], a, b); return l[0]?.id ?? null; })()]),
  suggest: [[], [{ id: "a", lat: 1, lon: 2 }], [{ id: "a", lat: 1, lon: 2, name: "Rạn ông Tư" }], [{ id: "a", lat: 1, lon: 2 }, { id: "b", lat: 1, lon: 3 }]]
    .map((s) => [s, svr.suggestName(s)]),
  doSauRan: [[8.6461, 111.92], [10.4, 114.36], [9.9, 114.48], [16.5, 112.0], [11.43, 114.33]].map(([a, b]) => [a, b, rd.reefDepthAtM(rd.buildReefDepthIndex(reefDepth), a, b)]),
  nguongRan: [[null, null, 7], [1.5, 2.2, 10], [2.5, 5, 6]].map(([d, w, s]) => [d, w, s, rd.nguongChanRanM(d, w, s)]),
  lopDoSau: [[10.34, 107.09], [8.68, 106.61], [10.2, 107.5], [16.12, 108.26], [21.5, 107.8], [4.5, 110]].map(([a, b]) => [a, b, dg.depthClassAt(depth, a, b)]),
  bien: [[10.2, 107.5], [7.0, 109.5], [6.0, 106.0], [16.12, 108.26], [17.5, 111.5]].map(([a, b]) => {
    const p = gf.borderProximity(a, b); return [a, b, p.applies, p.outside, p.distanceNm];
  }),
  kho: (() => {
    const l = hz.buildHazardList({ xacTau: KHO.xacTau, laneFeatures: KHO.laneFeatures, seamarks: KHO.seamarks }, 2.3, 2026);
    return {
      hazards: l.hazards.map((h) => [h.id, h.lat, h.lon, h.rKm, h.loai, h.tinVua]),
      passable: l.passable.map((h) => h.id), noGo: l.noGo.map((z) => z.id), khongXacDinh: l.khongXacDinh,
      moTa: l.hazards.slice(0, 40).map((h) => hz.moTaHazard(h)),
      soLuong: { xacTau: KHO.xacTau.length, seamarks: KHO.seamarks.length, vnAids: KHO.vnAids.length, soundings: KHO.soundings.length,
        fairways: KHO.fairways.length, verdicts: KHO.verdicts.size, tides: KHO.tides.length },
    };
  })(),
};

const out = join(goc, "../shared/src/jvmTest/resources/duong/vang.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(ra));
console.log("ghi", out, Math.round(JSON.stringify(ra).length / 1024), "KB");
