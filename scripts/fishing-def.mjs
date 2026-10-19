// scripts/fishing-def.mjs — MỘT ĐỊNH NGHĨA "GIỜ ĐÁNH BẮT" dùng chung nhãn v2 (dl-build-labels --v2)
// và lưới đội tàu (build-fleet-effort-grid --v2). Rà pipeline 2026-10-18, mảnh 2C
// (docs/app-map/ops/fish-train-review-2026-10-18, README §7).
// ─────────────────────────────────────────────────────────────────────────────
//  · Lưới cảng 0,5° + "gần BẤT KỲ cảng nào trong catalog-ports ≤ 10 km" (trước đây chép trong fleet grid).
//  · Bảng dải tốc độ MỘT-lần-cả-năm theo nhóm nghề: scripts/fishing-bands.v2.json (dựng bởi
//    scripts/dl-calibrate-bands.mjs, có nguồn + ngày + CI bootstrap).
//  · Giờ "đánh" = đoạn VMS ≤ maxGapH, tốc độ trong dải nhóm nghề, KHÔNG trong 10 km một cảng nào,
//    KHÔNG nằm giữa một lần IN và OUT thật của port-calls (tk.c). vmin = 0 CHỈ cho nhóm vây
//    ánh sáng (nightStill) vào ban đêm 18–06 giờ VN.
//   node scripts/fishing-def.mjs --selftest
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const MIN_PORT_KM = 10;
export const GEARS = ["vay", "cau", "re", "keo", "chup", "khac"];
export const BANDS_FILE = join(dirname(fileURLToPath(import.meta.url)), "fishing-bands.v2.json");

export function hav(lat1, lng1, lat2, lng2) {
  const R = 6371, t = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * t) / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(((lng2 - lng1) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Nghề trong sổ tàu VNF → nhóm nghề của lưới. */
export function gearGroup(g) {
  const s = (g || "").toLowerCase();
  if (s.includes("vây")) return "vay";
  if (s.includes("câu")) return "cau";
  if (s.includes("rê")) return "re";
  if (s.includes("kéo")) return "keo";
  if (s.includes("chụp")) return "chup";
  return "khac";
}

/** Tên nghề chuẩn (cột `gear` của nhãn) cho nhóm — dùng khi nghề do bộ phân loại suy ra. */
export const GROUP_NAME = { vay: "Vây", cau: "Câu", re: "Rê", keo: "Kéo", chup: "Lưới chụp", khac: "Khác" };

/** Lưới cảng 0,5° từ catalog-ports (items có lat/lng). */
export function makePortIndex(items) {
  const grid = new Map();
  for (const p of items || []) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const k = `${Math.floor(p.lat * 2)},${Math.floor(p.lng * 2)}`;
    (grid.get(k) || grid.set(k, []).get(k)).push(p);
  }
  return grid;
}

/** Điểm (lat,lng) cách MỘT cảng nào đó < km (mặc định 10 km, đúng luật MIN_PORT_KM của lưới đội tàu). */
export function nearAnyPort(idx, lat, lng, km = MIN_PORT_KM) {
  const a = Math.floor(lat * 2), b = Math.floor(lng * 2);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
    for (const p of idx.get(`${a + i},${b + j}`) || []) if (hav(lat, lng, p.lat, p.lng) < km) return true;
  return false;
}

/** Giờ VN (0..24) của mốc giây Unix. */
export const vnHour = (t) => (((t + 7 * 3600) / 3600) % 24 + 24) % 24;
export const isNightVN = (t, from = 18, to = 6) => { const h = vnHour(t); return h >= from || h < to; };

export function loadBands(file = BANDS_FILE) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * Dải [vmin,vmax] hiệu lực của nhóm nghề tại mốc t. vmin = 0 chỉ khi nhóm nằm trong nightStill.gears
 * VÀ đang ban đêm; ngoài ra dùng vmin của bảng (>0).
 */
export function bandAt(table, group, t) {
  const b = table.bands[group] ?? table.bands.khac;
  const ns = table.nightStill;
  if (ns?.gears?.includes(group) && isNightVN(t, ns.from, ns.to)) return [0, b.band[1]];
  return b.band;
}

/** Khoảng [IN, OUT] trong cảng từ port-calls tk.c = [[dir,t,src,type],…], cắt ở [lo,hi] (giây). */
export function inPortIntervals(c, lo, hi) {
  if (!Array.isArray(c) || !c.length) return [];
  const ev = c.filter((e) => e && Number.isFinite(e[1]) && e[1] >= lo - 12 * 3600 && e[1] <= hi + 12 * 3600).sort((a, b) => a[1] - b[1]);
  const out = [];
  let open = null;
  for (const [dir, t] of ev) {
    if (dir === "IN") { if (open === null) open = t; }
    else if (dir === "OUT") {
      if (open !== null) { out.push([open, t]); open = null; }
      else out.push([lo - 12 * 3600, t]); // OUT mà không thấy IN trước: tàu đang ở cảng từ đầu cửa sổ
    }
  }
  if (open !== null) out.push([open, Infinity]);
  return out;
}
export const inIntervals = (t, ivs) => { for (const [a, b] of ivs) if (t >= a && t <= b) return true; return false; };

/** Đoạn giữa hai điểm liền nhau (TRUNG ĐIỂM) — không gắn nearPort; tốc độ hải lý/giờ. */
export function segmentsRaw(points) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ta, a1, b1] = points[i];
    const [tb, a2, b2] = points[i + 1];
    const dtH = (tb - ta) / 3600;
    if (dtH <= 0) continue;
    out.push({ t: (ta + tb) / 2, lat: (a1 + a2) / 2, lon: (b1 + b2) / 2, dtH, kn: hav(a1, b1, a2, b2) / 1.852 / dtH });
  }
  return out;
}

/**
 * Phán quyết cho một đoạn: "fish" | "gap" | "band" | "inport" (giữa IN/OUT thật) | "port" (trong 10 km một cảng).
 * ctx = {table, ports}. `group` là nhóm nghề đã chốt (đã suy nếu sổ tàu thiếu).
 */
export function fishingVerdict(s, group, ctx, ivs = []) {
  if (!(s.dtH <= ctx.table.maxGapH)) return "gap";
  const [lo, hi] = bandAt(ctx.table, group, s.t);
  if (s.kn < lo || s.kn > hi) return "band";
  if (ivs.length && inIntervals(s.t, ivs)) return "inport";
  return nearAnyPort(ctx.ports, s.lat, s.lon, ctx.table.minPortKm ?? MIN_PORT_KM) ? "port" : "fish";
}
export const isFishingV2 = (s, group, ctx, ivs = []) => fishingVerdict(s, group, ctx, ivs) === "fish";

/** Điểm trong đa giác (even-odd). ring = [[lon,lat],…] */
export function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/**
 * Vòng "vùng biển Việt Nam": đọc đúng src/data/vn-maritime-border.ts (MỘT nguồn, không chép toạ độ) rồi đóng vòng
 * qua đất liền. Chỉ là phép THỬ SƠ (ranh để cảnh báo, không phải đường pháp lý — xem chú thích file nguồn).
 */
export function loadVnRing(file = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "vn-maritime-border.ts")) {
  if (!existsSync(file)) return null;
  const pts = [...readFileSync(file, "utf8").matchAll(/^\s*\[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\],?\s*$/gm)].map((m) => [+m[1], +m[2]]);
  if (pts.length < 40) return null;
  return [...pts, [104.5, pts[pts.length - 1][1]], [104.5, pts[0][1]]];
}

function selftest() {
  const ports = makePortIndex([{ lat: 10, lng: 107 }]);
  if (!nearAnyPort(ports, 10.05, 107)) throw new Error("selftest: 5,5 km phải gần cảng");
  if (nearAnyPort(ports, 10.2, 107)) throw new Error("selftest: 22 km không gần cảng");
  if (nearAnyPort(makePortIndex([{ lat: NaN, lng: 1 }]), 10, 1)) throw new Error("selftest: cảng thiếu toạ độ");
  if (gearGroup("Lưới rê") !== "re" || gearGroup("Lưới chụp") !== "chup" || gearGroup("Lưới vây") !== "vay" || gearGroup("?") !== "khac") throw new Error("selftest: gearGroup");
  // 18:00 VN = 11:00 UTC
  const tNight = Date.UTC(2026, 7, 1, 15, 0) / 1000, tDay = Date.UTC(2026, 7, 1, 5, 0) / 1000;
  if (!isNightVN(tNight) || isNightVN(tDay)) throw new Error("selftest: isNightVN");
  const table = { maxGapH: 4, minPortKm: 10, nightStill: { gears: ["vay"], from: 18, to: 6 }, bands: { vay: { band: [0.6, 3] }, re: { band: [0.3, 1] }, khac: { band: [0.3, 1] } } };
  if (bandAt(table, "vay", tNight)[0] !== 0 || bandAt(table, "vay", tDay)[0] !== 0.6) throw new Error("selftest: vay vmin ban đêm");
  if (bandAt(table, "re", tNight)[0] !== 0.3) throw new Error("selftest: rê không có vmin = 0");
  if (bandAt(table, "xx", tDay)[0] !== 0.3) throw new Error("selftest: nhóm lạ lùi về khac");
  const ctx = { table, ports };
  const far = { t: tNight, lat: 11, lon: 108, dtH: 1, kn: 0.1 };
  if (!isFishingV2(far, "vay", ctx) || isFishingV2(far, "re", ctx)) throw new Error("selftest: đứng yên chỉ vây ban đêm");
  if (isFishingV2({ ...far, lat: 10.02, lon: 107.0 }, "vay", ctx)) throw new Error("selftest: trong 10 km cảng không tính");
  if (isFishingV2({ ...far, dtH: 5 }, "vay", ctx)) throw new Error("selftest: gap > maxGapH");
  const ivs = inPortIntervals([["IN", 1000, "K", "x"], ["OUT", 5000, "K", "x"], ["IN", 90000, "K", "x"]], 0, 100000);
  if (JSON.stringify(ivs) !== JSON.stringify([[1000, 5000], [90000, Infinity]])) throw new Error(`selftest: inPortIntervals ${JSON.stringify(ivs)}`);
  if (!inIntervals(3000, ivs) || inIntervals(6000, ivs) || !inIntervals(1e9, ivs)) throw new Error("selftest: inIntervals");
  if (isFishingV2({ ...far, t: 3000, kn: 1 }, "vay", ctx, ivs)) throw new Error("selftest: giữa IN/OUT không tính");
  if (fishingVerdict({ ...far, t: 3000, kn: 1 }, "vay", ctx, ivs) !== "inport" || fishingVerdict({ ...far, lat: 10.02, lon: 107 }, "vay", ctx) !== "port" || fishingVerdict({ ...far, kn: 9 }, "vay", ctx) !== "band" || fishingVerdict({ ...far, dtH: 5 }, "vay", ctx) !== "gap") throw new Error("selftest: fishingVerdict");
  const sg = segmentsRaw([[0, 10, 107], [3600, 10, 107.0167], [3600, 10, 107.1]]);
  if (sg.length !== 1 || Math.abs(sg[0].kn - 1) > 0.05) throw new Error(`selftest: segmentsRaw ${JSON.stringify(sg)}`);
  const ring = loadVnRing();
  if (ring) {
    if (!pointInRing(107, 20.5, ring) || !pointInRing(109.5, 12, ring) || !pointInRing(112.5, 10, ring)) throw new Error("selftest: vùng biển VN phải chứa Vịnh Bắc Bộ / Nam Trung Bộ / Trường Sa");
    if (pointInRing(118, 14, ring) || pointInRing(115, 22, ring)) throw new Error("selftest: ngoài khơi xa phải ở ngoài");
  }
  console.log("selftest OK (fishing-def)");
}
if (process.argv[1]?.endsWith("fishing-def.mjs") && process.argv.includes("--selftest")) selftest();
