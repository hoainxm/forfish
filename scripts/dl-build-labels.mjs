#!/usr/bin/env node
// scripts/dl-build-labels.mjs — DỰNG NHÃN huấn luyện/kiểm định lớp cá từ dữ liệu DataLake đã tải
// (scripts/dl-collect.mjs). Chạy offline, không mạng.
// ─────────────────────────────────────────────────────────────────────────────
// 1. Cắt track VMS theo đúng chuyến của từng nhật ký (giờ rời → giờ cập).
// 2. Mỗi đoạn giữa hai điểm liền nhau: tốc độ = quãng/thời gian. Đoạn "đang đánh" khi tốc độ
//    nằm trong [vmin, vmax] của NGHỀ, đoạn không dài quá GAP_H và không sát bến (≤ PORT_KM
//    từ điểm đầu/cuối chuyến — chỗ neo đậu).
// 3. [vmin, vmax] KHÔNG ĐẶT TAY: dò lưới, chọn cặp làm số mẻ tìm được khớp nhất với
//    `haulCount` tàu khai (tương quan Spearman trên chuyến có VMS phủ tốt). Đây là nhãn
//    tự giám sát duy nhất có được khi nhật ký không ghi vị trí mẻ.
// 4. LỜI KHAI CÓ THỂ SAI: vị trí chỉ lấy từ VMS; loài/kg nhân trọng số tin cậy (trustWeight),
//    năng suất vượt p99 của nghề bị kéo về p99; số mẻ để chỉnh ngưỡng ưu tiên nhật ký điện tử.
// 5. Sản lượng loài của chuyến (bốc dỡ nếu có, không thì khai thác) chia theo GIỜ ĐÁNH vào
//    ô 0,05° × ngày (giờ VN). Mẻ có toạ độ (nếu API trả) thì dùng thẳng — chưa có trường đó.
//
// Ra (cạnh dữ liệu vào, NGOÀI repo):
//   labels/effort.csv   date,lat,lon,hours,geartype   ← đọc thẳng bằng fish-validate-positions.mjs
//   labels/catch.csv    date,lat,lon,species,gear,kg  (species = MÃ ASFIS 3 chữ — tên API không thống nhất)
//   labels/report.json  ngưỡng đã chọn theo nghề + độ phủ + bảng loài
//   labels/catch-vessels-025.csv  month,lat,lon,species,vessels — số tàu theo ô 0,25° (cổng riêng tư
//                       của build-species-catch-grid.mjs)
//   --window a,b ⇒ labels-<a>/ chỉ chuyến rời bến trong [a,b] (dựng cả năm theo khúc)
//
//   node scripts/dl-build-labels.mjs [--dir ~/sdfish-data/dl] [--from 2026-08-01 --to 2026-09-30]
//   node scripts/dl-build-labels.mjs --selftest
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const GAP_H = 4; // đoạn dài hơn = mất tín hiệu, không gán giờ
export const PORT_KM = 5;
export const CELL = 0.05;
const KN_PER_KMH = 1 / 1.852;
const VN_OFFSET_S = 7 * 3600;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Đoạn của một chuyến: [{t, lat, lon, dtH, kn, nearPort}] — t/lat/lon là TRUNG ĐIỂM đoạn. */
export function segments(points) {
  if (points.length < 2) return [];
  const [, la0, lo0] = points[0];
  const [, la1, lo1] = points[points.length - 1];
  const out = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ta, a1, b1] = points[i];
    const [tb, a2, b2] = points[i + 1];
    const dtH = (tb - ta) / 3600;
    if (dtH <= 0) continue;
    const lat = (a1 + a2) / 2;
    const lon = (b1 + b2) / 2;
    const nearPort = Math.min(haversineKm(lat, lon, la0, lo0), haversineKm(lat, lon, la1, lo1)) <= PORT_KM;
    out.push({ t: (ta + tb) / 2, lat, lon, dtH, kn: (haversineKm(a1, b1, a2, b2) / dtH) * KN_PER_KMH, nearPort });
  }
  return out;
}

export const isFishing = (s, [vmin, vmax]) => !s.nearPort && s.dtH <= GAP_H && s.kn >= vmin && s.kn <= vmax;

/** Số lần đánh = số đợt liên tiếp đoạn "đang đánh" (đứt khi gặp đoạn khác hoặc mất tín hiệu). */
export function episodes(segs, band) {
  let n = 0, prev = false;
  for (const s of segs) {
    const f = isFishing(s, band);
    if (f && !prev) n++;
    prev = f;
  }
  return n;
}

export function spearman(x, y) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(x), ry = rank(y), n = x.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

export const VMIN = [0, 0.3, 0.6, 1, 1.5, 2];
export const VMAX = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6];

/** Chọn [vmin,vmax] làm số đợt đánh tương quan cao nhất với haulCount. Trả {band, rho, n}. */
export function calibrate(trips) {
  let best = { band: [0, 3], rho: -Infinity, n: trips.length };
  if (trips.length < 30) return { ...best, rho: NaN, fallback: true };
  const hauls = trips.map((t) => t.hauls);
  for (const a of VMIN)
    for (const b of VMAX) {
      if (b <= a + 0.4) continue;
      const rho = spearman(trips.map((t) => episodes(t.segs, [a, b])), hauls);
      if (rho > best.rho) best = { band: [a, b], rho, n: trips.length };
    }
  return best;
}

const csv = (x) => String(x).replace(/[,\n]/g, ";");
/**
 * TRỌNG SỐ TIN CẬY của một nhật ký — lời khai có thể sai (vị trí, loài, sản lượng). VỊ TRÍ không bao
 * giờ lấy từ lời khai (chỉ từ VMS, máy tự ghi); phần còn tự khai là loài + kg, nên hạ trọng số:
 *   · bốc dỡ KHÔNG có cán bộ giám sát (`landingMonitored` ≠ true)   × TRUST_UNMONITORED
 *   · sản lượng theo loài Y HỆT một chuyến khác của cùng tàu (chép nhật ký) × TRUST_TEMPLATE
 *   · khai thác và bốc dỡ lệch nhau quá 2 lần                          × TRUST_MISMATCH
 * Đo 2026-10-10 trên 107.109 nhật ký 8–9/2026: 70 % có giám sát, 2.792 chuyến (4 %) lặp y hệt,
 * 337/3.160 chuyến có cả hai số lệch > 2 lần.
 */
export const TRUST_UNMONITORED = 0.5;
export const TRUST_TEMPLATE = 0.3;
export const TRUST_MISMATCH = 0.7;
export function trustWeight(lb, isTemplate) {
  const why = [];
  let w = 1;
  if (!(lb.landingMonitored === true && (lb.landedKg ?? 0) > 0)) { w *= TRUST_UNMONITORED; why.push("tự khai"); }
  if (isTemplate) { w *= TRUST_TEMPLATE; why.push("lặp y hệt chuyến khác"); }
  const c = lb.catchKg ?? 0, l = lb.landedKg ?? 0;
  if (c > 0 && l > 0 && (l / c > 2 || l / c < 0.5)) { w *= TRUST_MISMATCH; why.push("khai thác ≠ bốc dỡ"); }
  return { w, why };
}

/** Dấu vân tay sản lượng (loài + kg làm tròn) — hai chuyến cùng tàu trùng dấu = nghi chép lại. */
export const catchPrint = (sp) =>
  (sp ?? []).filter((x) => x.kg > 0).map((x) => `${x.code}:${Math.round(x.kg)}`).sort().join("|");

const snap = (v) => (Math.floor(v / CELL) * CELL + CELL / 2).toFixed(3);
const vnDate = (t) => new Date((t + VN_OFFSET_S) * 1000).toISOString().slice(0, 10);

function selftest() {
  const t0 = 1_780_000_000;
  // 2 mẻ kéo 3 kn xen chạy 8 kn, có đầu/cuối ở bến
  const pts = [[t0, 10, 107]];
  let lat = 10, t = t0;
  const step = (kn, h) => { t += h * 3600; lat += (kn * 1.852 * h) / 111.2; pts.push([t, lat, 107]); };
  step(8, 2); step(3, 1); step(3, 1); step(8, 1); step(3, 1); step(3, 1); step(8, 2);
  const segs = segments(pts);
  const ep = episodes(segs, [1.5, 4]);
  if (ep !== 2) throw new Error(`selftest: episodes ${ep} ≠ 2`);
  if (episodes(segs, [0, 10]) !== 1) throw new Error("selftest: dải rộng phải gộp thành 1 đợt");
  if (Math.abs(spearman([1, 2, 3], [2, 4, 9]) - 1) > 1e-9) throw new Error("selftest: spearman");
  if (trustWeight({ landingMonitored: true, landedKg: 100, catchKg: 0 }, false).w !== 1) throw new Error("selftest: trust giám sát");
  const tw = trustWeight({ landingMonitored: false, landedKg: 500, catchKg: 100 }, true).w;
  if (Math.abs(tw - TRUST_UNMONITORED * TRUST_TEMPLATE * TRUST_MISMATCH) > 1e-12) throw new Error("selftest: trust nhân dồn");
  if (catchPrint([{ code: "B", kg: 2 }, { code: "A", kg: 1.4 }, { code: "C", kg: 0 }]) !== "A:1|B:2") throw new Error("selftest: catchPrint");
  console.log("selftest OK");
}

if (process.argv.includes("--selftest")) { selftest(); process.exit(0); }

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const DIR = arg("dir", join(homedir(), "sdfish-data", "dl")).replace(/^~/, homedir());
const FROM = arg("from", "2026-08-01");
const TO = arg("to", "2026-09-30");
// --trust weighted (mặc định): mọi chuyến, nhân trọng số tin cậy · monitored: CHỈ chuyến có giám sát
// bốc dỡ, không chép, không lệch (kiểm độ nhạy: kết luận đổi theo chế độ = đừng tin kết luận).
const TRUST = arg("trust", "weighted");
// --window 2026-01-01,2026-02-28: chỉ nhật ký có NGÀY RỜI (giờ VN) trong khoảng ⇒ labels-<từ>/.
// Dựng nhãn cả năm theo từng khúc cho vừa bộ nhớ (track 11 tháng × 14 nghìn tàu không nạp một lần được).
const WINDOW = arg("window", "").split(",").filter(Boolean);
const OUT = join(DIR, (TRUST === "weighted" ? "labels" : `labels-${TRUST}`) + (WINDOW.length ? `-${WINDOW[0]}` : ""));
mkdirSync(OUT, { recursive: true });

const trips = new Map(JSON.parse(readFileSync(join(DIR, `trips_${FROM}_${TO}.json`), "utf8")).map((t) => [t.code, t]));
const depDay = (lb) => {
  const t = trips.get(lb.trip?.code);
  const d = Date.parse(t?.vms?.dep ?? t?.dep ?? "");
  return Number.isFinite(d) ? vnDate(d / 1000) : null;
};
// Xếp theo tàu — sort ỔN ĐỊNH nên thứ tự nhật ký trong MỘT tàu giữ nguyên (luật "lặp y hệt chuyến
// khác" không đổi) — để bộ đệm track chỉ cần giữ một tàu.
const logbooks = JSON.parse(readFileSync(join(DIR, `logbooks_${FROM}_${TO}.json`), "utf8"))
  .filter((lb) => !WINDOW.length || ((d) => d && d >= WINDOW[0] && d <= WINDOW[1])(depDay(lb)))
  .sort((a, b) => String(a.vessel?.id ?? "").localeCompare(String(b.vessel?.id ?? "")));
const vessels = new Map(JSON.parse(readFileSync(join(DIR, "vessels.json"), "utf8")).map((v) => [v.id, v]));
const trackCache = new Map();
const track = (id) => {
  if (!trackCache.has(id)) {
    trackCache.clear();
    const f = join(DIR, "track", `${id}.json`);
    trackCache.set(id, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
  }
  return trackCache.get(id);
};

// ── ghép nhật ký ↔ chuyến ↔ track ─────────────────────────────────────────
const cov = { logbooks: logbooks.length, noTrip: 0, noTime: 0, noVms: 0, fewPts: 0, used: 0, distrust: 0, declaredButNoFishing: 0 };
const rows = [];
const landedOf = (lb) => ((lb.landedKg ?? 0) > 0 ? lb.species?.landed : lb.species?.catch) ?? [];
const seenPrint = new Map(); // tàu → tập dấu vân tay đã gặp
const trustWhy = {};
for (const lb of logbooks) {
  const vid = lb.vessel?.id;
  const tr = trips.get(lb.trip?.code);
  if (!tr) { cov.noTrip++; continue; }
  const dep = Date.parse(tr.vms?.dep ?? tr.dep ?? "") / 1000;
  const arr = Date.parse(tr.vms?.arr ?? tr.arr ?? "") / 1000;
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep || arr - dep > 60 * 86400) { cov.noTime++; continue; }
  const tk = vid ? track(vid) : null;
  if (!tk?.hasVms) { cov.noVms++; continue; }
  const pts = tk.p.filter(([t]) => t >= dep && t <= arr);
  // phủ tốt: trung bình ≤ 3 h một điểm
  if (pts.length < 4 || (arr - dep) / 3600 / pts.length > 3) { cov.fewPts++; continue; }
  const fp = catchPrint(landedOf(lb));
  const prints = seenPrint.get(vid) ?? seenPrint.set(vid, new Set()).get(vid);
  const trust = trustWeight(lb, !!fp && prints.has(fp));
  if (fp) prints.add(fp);
  for (const y of trust.why) trustWhy[y] = (trustWhy[y] ?? 0) + 1;
  if (TRUST === "monitored" && trust.w < 1) { cov.distrust++; continue; }
  cov.used++;
  const gear = csv(vessels.get(vid)?.gear ?? "?");
  rows.push({ lb, gear, segs: segments(pts), hauls: lb.haulCount ?? 0, w: trust.w, electronic: lb.form === "ELECTRONIC" });
}

// ── chỉnh ngưỡng theo nghề ────────────────────────────────────────────────
const byGear = new Map();
for (const r of rows) (byGear.get(r.gear) ?? byGear.set(r.gear, []).get(r.gear)).push(r);
const bands = {};
// Số mẻ cũng là lời khai: nhật ký ĐIỆN TỬ ghi từng mẻ ngay trên biển, giấy thường điền sau ⇒
// chỉnh ngưỡng bằng nhật ký điện tử khi nghề đó đủ ≥ 30 chuyến, thiếu mới dùng cả giấy.
const haulRows = (rs) => {
  const e = rs.filter((r) => r.hauls >= 1 && r.electronic);
  return e.length >= 30 ? e : rs.filter((r) => r.hauls >= 1);
};
const globalCal = calibrate(haulRows(rows));
for (const [g, rs] of byGear) {
  const c = calibrate(haulRows(rs));
  bands[g] = c.fallback || !(c.rho > 0.1) ? { ...globalCal, fallbackGlobal: true, nGear: rs.length } : { ...c, nGear: rs.length };
}

// ── gán giờ + sản lượng vào ô–ngày ────────────────────────────────────────
const eff = new Map(); // date|lat|lon|gear → hours
const cat = new Map(); // date|lat|lon|species|gear → kg (đã nhân trọng số tin cậy)
const spTot = new Map();
const catVessels = new Map(); // tháng|ô 0,25°|loài → Set(tàu)
// tâm ô 0,25° của lưới cá (x,025 / x,275 / x,525 / x,775 — fish-forecast SST stride 5)
const axis025 = (v) => (Math.round((v - 0.025) / 0.25) * 0.25 + 0.025).toFixed(3);
// Trần năng suất: kg/giờ đánh của chuyến vượt p99 của nghề ⇒ kéo về p99 (khai phồng hoặc VMS
// thấy quá ít giờ đánh — đằng nào cũng không đáng dồn cả khối kg vào vài ô).
const fishingOf = (r) => r.segs.filter((s) => isFishing(s, bands[r.gear].band));
const cpue = new Map();
for (const r of rows) {
  const H = fishingOf(r).reduce((a, s) => a + s.dtH, 0);
  const kg = landedOf(r.lb).reduce((a, x) => a + (x.kg > 0 ? x.kg : 0), 0);
  r.H = H;
  r.kg = kg;
  if (H > 0 && kg > 0) (cpue.get(r.gear) ?? cpue.set(r.gear, []).get(r.gear)).push(kg / H);
}
const cap = {};
for (const [g, v] of cpue) { v.sort((a, b) => a - b); cap[g] = v[Math.floor(0.99 * (v.length - 1))]; }
let capped = 0;
for (const r of rows) {
  if (!r.H) { if (r.kg > 0) cov.declaredButNoFishing++; continue; }
  const fishing = fishingOf(r);
  const H = r.H;
  const sp = landedOf(r.lb);
  const scale = r.kg / H > cap[r.gear] ? (capped++, (cap[r.gear] * H) / r.kg) : 1;
  for (const s of fishing) {
    const k = `${vnDate(s.t)},${snap(s.lat)},${snap(s.lon)}`;
    eff.set(`${k},${r.gear}`, (eff.get(`${k},${r.gear}`) ?? 0) + s.dtH);
    for (const x of sp) {
      if (!(x.kg > 0)) continue;
      const kg = (x.kg * scale * r.w * s.dtH) / H;
      const kk = `${k},${csv(x.code || "?")},${r.gear}`;
      cat.set(kk, (cat.get(kk) ?? 0) + kg);
      // số TÀU khác nhau theo tháng × ô 0,25° (trục lưới cá) × loài — cổng riêng tư của lưới
      // sản lượng loài (build-species-catch-grid.mjs chỉ giữ ô ≥ 3 tàu)
      const vk = `${vnDate(s.t).slice(0, 7)},${axis025(s.lat)},${axis025(s.lon)},${csv(x.code || "?")}`;
      (catVessels.get(vk) ?? catVessels.set(vk, new Set()).get(vk)).add(r.lb.vessel?.id);
    }
  }
  for (const x of sp) if (x.kg > 0) spTot.set(`${x.code}|${x.name}`, (spTot.get(`${x.code}|${x.name}`) ?? 0) + x.kg);
}
writeFileSync(join(OUT, "effort.csv"), "date,lat,lon,geartype,hours\n" + [...eff].map(([k, h]) => `${k},${h.toFixed(2)}`).join("\n"));
writeFileSync(join(OUT, "catch.csv"), "date,lat,lon,species,gear,kg\n" + [...cat].map(([k, v]) => `${k},${v.toFixed(1)}`).join("\n"));
writeFileSync(join(OUT, "catch-vessels-025.csv"), "month,lat,lon,species,vessels\n" + [...catVessels].map(([k, v]) => `${k},${v.size}`).join("\n"));
const report = {
  builtAt: new Date().toISOString(),
  trust: TRUST,
  coverage: cov,
  distrustReasons: trustWhy,
  cpueCapKgPerH: cap,
  capped,
  bands,
  globalBand: globalCal,
  effortHours: [...eff.values()].reduce((a, b) => a + b, 0),
  species: [...spTot].sort((a, b) => b[1] - a[1]).map(([k, kg]) => ({ code: k.split("|")[0], name: k.split("|")[1], kg: Math.round(kg) })),
};
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ trust: TRUST, coverage: cov, distrustReasons: trustWhy, capped, cap, bands: Object.fromEntries(Object.entries(bands).map(([g, b]) => [g, `${b.band.join("–")} kn ρ=${b.rho?.toFixed(2)} n=${b.n}${b.fallbackGlobal ? " (chung)" : ""}`])), effortHours: Math.round(report.effortHours) }, null, 1));
