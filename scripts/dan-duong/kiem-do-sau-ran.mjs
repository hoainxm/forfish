#!/usr/bin/env node
// KIỂM ĐỘ SÂU RẠN — chạy trên máy GPU (anh Long 2026-10-22: "trên gpu tổ chức cả 1 cái kiểm độ sâu đi, so với bản đồ
// độ sâu đó, dữ liệu mình đủ hết mà sao lại không có độ sâu?").
//
// Câu trả lời cần chứng minh bằng số, không nói suông: hình rạn (OSM 2 622 hình, ACA 5 m) KHÔNG mang số độ sâu, còn
// hai mô hình độ sâu (ETOPO 2022, GEBCO_2026, ô 450 m) có số nhưng KHÔNG PHÂN GIẢI nổi một cái rạn — đầu
// generate-depth-grid.mjs ghi "ETOPO↔GEBCO khớp 100 % ở biển sâu, chỉ 85,2 % ở vùng rạn; có ô ETOPO −344 m mà GEBCO
// −5 m". Việc này ĐO lại điều đó trên TỪNG hình rạn, rồi xếp từng rạn vào một trong bốn kết luận:
//   · can      — có bằng chứng rạn cạn (lớp ACA Reef Crest/Flat/Shallow Lagoon, hoặc GEBCO/ETOPO ≤ 5 m, hoặc số đo sâu)
//   · trung    — 5–20 m theo mô hình, hai nguồn khớp
//   · sau      — ≥ 20 m, HAI nguồn khớp (|Δ| ≤ 5 m), KHÔNG lớp ACA cạn trong hình ⇒ ứng viên hạ từ CHẶN xuống CẢNH BÁO
//   · mau-thuan — hai mô hình lệch > 5 m, hoặc mô hình nói sâu mà ACA nói crest/flat ⇒ mô hình sai tại rạn, giữ chặn
// Nguồn: ODB NTU GEBCO (`mode=zonly&sample=1`, như generate-depth-grid.mjs), ERDDAP PIFSC ETOPO 15" (.json từng khung
// nhỏ), ACA WFS `geomorphic_data_verbose` theo ô 1° có cache (như generate-reef-shapes-aca.mjs), soundings TBHH.
// Thuần Node ≥ 20, không dependency. Cache từng rạn ⇒ chạy lại nối tiếp được.
//
//   node scripts/dan-duong/kiem-do-sau-ran.mjs [--out <dir>] [--cache <dir>] [--gioi-han N] [--khong-aca] [--khong-etopo]
// Ra: <out>/kiem-do-sau-ran.json (từng rạn) + kiem-do-sau-ran.md (tổng kết) + ung-vien-ran-sau.json (chỉ rạn `sau`).
// Kết quả là BÁO CÁO cho lead/anh Long đọc, KHÔNG tự đổi luật chặn — quyết định hạ chặn là nghiệp vụ (doc §7 Q3).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(k);
const OUT = resolve(arg("--out", join(REPO, ".dan-duong")));
const CACHE = resolve(arg("--cache", process.env.SDFISH_DOSAU_CACHE ?? join(tmpdir(), "sdfish-do-sau-ran")));
const GIOI_HAN = Number(arg("--gioi-han", "0")) || Infinity;
mkdirSync(OUT, { recursive: true }); mkdirSync(join(CACHE, "ran"), { recursive: true }); mkdirSync(join(CACHE, "aca"), { recursive: true });

const UA = "SDFish-build/1.0 (fisherman app; nautical chart)";
const ODB_GEBCO = "https://api.odb.ntu.edu.tw/gebco";
const ERDDAP = "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json";
const ACA_URL = "https://allencoralatlas.org/geoserver/ows";
const ACA_LAYER = "coral-atlas:geomorphic_data_verbose";
/** lớp ACA chắc chắn CẠN (≤ ~2–5 m) — rạn mang lớp này không bao giờ là ứng viên "sâu" */
const ACA_CAN = new Set(["Reef Crest", "Outer Reef Flat", "Inner Reef Flat", "Shallow Lagoon", "Terrestrial Reef Flat", "Back Reef Slope"]);
const PAD_KM = 0.5, NGU_MS = 300, TIMEOUT_MS = 60_000;
const SAU_M = 20, CAN_M = 5, LECH_M = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function getJson(url, label) {
  for (let t = 1; t <= 3; t++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`${label} ${res.status}`);
      return await res.json();
    } catch (e) { if (t === 3) throw e; await sleep(1500 * t); }
  }
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

// ── hình rạn OSM ──────────────────────────────────────────────────────────────
const osm = JSON.parse(readFileSync(join(REPO, "public/data/reef-shapes.v1.json"), "utf8")).features;
function toaDo(g) {
  if (g.type === "Point") return [g.coordinates];
  if (g.type === "LineString") return g.coordinates;
  if (g.type === "Polygon") return g.coordinates.flat();
  if (g.type === "MultiPolygon") return g.coordinates.flat(2);
  return [];
}
function bboxCua(pts, padKm) {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const [lon, lat] of pts) { w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat); }
  const dLat = padKm / 111.32, dLon = padKm / (111.32 * Math.cos(((s + n) / 2) * Math.PI / 180));
  return [w - dLon, s - dLat, e + dLon, n + dLat];
}

// ── số đo sâu TBHH (dm → m), chỉ để đối chiếu khi có trong 2 km ─────────────
const soundings = (() => {
  try { return JSON.parse(readFileSync(join(REPO, "public/data/soundings.v1.json"), "utf8")).diem.map(([lon, lat, dm]) => [lon, lat, dm / 10]); }
  catch { return []; }
})();
const kmGiua = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * r); return 111.32 * Math.hypot(dl, b[1] - a[1]); };

// ── ACA theo ô 1° có cache (đọc lớp class_name, bỏ hình để nhẹ: giữ bbox + lớp) ─
async function acaTrongKhung(bb) {
  if (flag("--khong-aca")) return null;
  const x0 = Math.floor(bb[0]), y0 = Math.floor(bb[1]), x1 = Math.floor(bb[2]), y1 = Math.floor(bb[3]);
  const lop = new Map();
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const f = join(CACHE, "aca", `${x}_${y}.json`);
    let tile;
    if (existsSync(f)) tile = JSON.parse(readFileSync(f, "utf8"));
    else {
      const qs = new URLSearchParams({ service: "WFS", version: "1.0.0", request: "GetFeature", typeName: ACA_LAYER, outputFormat: "application/json", srsName: "EPSG:4326", maxFeatures: "15000", bbox: `${x},${y},${x + 1},${y + 1}` });
      try {
        const j = await getJson(`${ACA_URL}?${qs}`, "ACA");
        tile = (j.features ?? []).map((ft) => ({ c: ft.properties?.class_name ?? "?", b: bboxCua(toaDo(ft.geometry), 0) }));
      } catch (e) { log("ACA ô", x, y, "hỏng:", e.message); tile = []; }
      writeFileSync(f, JSON.stringify(tile)); await sleep(NGU_MS);
    }
    for (const t of tile) if (t.b[0] <= bb[2] && t.b[2] >= bb[0] && t.b[1] <= bb[3] && t.b[3] >= bb[1]) lop.set(t.c, (lop.get(t.c) ?? 0) + 1);
  }
  return Object.fromEntries(lop);
}

// ── GEBCO + ETOPO trong khung ────────────────────────────────────────────────
async function gebco(bb) {
  const src = JSON.stringify({ type: "Polygon", coordinates: [[[bb[0], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]], [bb[2], bb[1]], [bb[0], bb[1]]]] });
  const j = await getJson(`${ODB_GEBCO}?mode=zonly&sample=1&jsonsrc=${encodeURIComponent(src)}`, "ODB");
  if (j.Error) throw new Error(String(j.Error));
  const z = (j.z ?? []).filter((v) => Number.isFinite(v));
  return z.length ? { min: Math.max(...z), med: med(z), n: z.length } : null; // z âm = sâu; "min độ sâu" = max(z)
}
async function etopo(bb) {
  if (flag("--khong-etopo")) return null;
  const url = `${ERDDAP}?z%5B(${bb[1].toFixed(5)}):1:(${bb[3].toFixed(5)})%5D%5B(${bb[0].toFixed(5)}):1:(${bb[2].toFixed(5)})%5D`;
  const j = await getJson(url, "ERDDAP");
  const iz = j.table.columnNames.indexOf("z");
  const z = j.table.rows.map((r) => r[iz]).filter((v) => Number.isFinite(v));
  return z.length ? { min: Math.max(...z), med: med(z), n: z.length } : null;
}

// ── kết luận cho một rạn ─────────────────────────────────────────────────────
function ketLuan(r) {
  const acaCan = r.aca ? Object.keys(r.aca).some((c) => ACA_CAN.has(c)) : false;
  const dS = r.gebco && r.etopo ? Math.abs(r.gebco.min - r.etopo.min) : null;
  const sauNhat = Math.max(r.gebco?.min ?? -Infinity, r.etopo?.min ?? -Infinity); // chỗ NÔNG nhất trong khung (z lớn nhất)
  const nongM = sauNhat === -Infinity ? null : -sauNhat;
  if (r.soundingM != null && r.soundingM <= CAN_M) return "can";
  if (acaCan && nongM != null && nongM >= SAU_M) return "mau-thuan";
  if (acaCan || (nongM != null && nongM <= CAN_M)) return "can";
  if (dS != null && dS > LECH_M) return "mau-thuan";
  if (nongM == null) return "khong-so";
  if (nongM >= SAU_M && r.gebco && r.etopo) return "sau";
  if (nongM >= SAU_M) return "sau-mot-nguon";
  return "trung";
}

// ── chạy ─────────────────────────────────────────────────────────────────────
const ra = [];
let i = 0;
for (const f of osm) {
  if (i++ >= GIOI_HAN) break;
  const id = `osm-${i - 1}`;
  const cf = join(CACHE, "ran", `${id}.json`);
  if (existsSync(cf)) { ra.push(JSON.parse(readFileSync(cf, "utf8"))); continue; }
  const pts = toaDo(f.geometry);
  if (!pts.length) continue;
  const bb = bboxCua(pts, PAD_KM);
  const r = { id, kind: f.properties?.kind, geom: f.geometry.type, bbox: bb.map((v) => +v.toFixed(5)), gebco: null, etopo: null, aca: null, soundingM: null, loi: [] };
  try { r.gebco = await gebco(bb); } catch (e) { r.loi.push(`gebco: ${e.message}`); }
  await sleep(NGU_MS);
  try { r.etopo = await etopo(bb); } catch (e) { r.loi.push(`etopo: ${e.message}`); }
  try { r.aca = await acaTrongKhung(bb); } catch (e) { r.loi.push(`aca: ${e.message}`); }
  const tam = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
  let gan = null;
  for (const s of soundings) { const d = kmGiua(tam, s); if (d <= 2 && (gan == null || d < gan.d)) gan = { d, m: s[2] }; }
  if (gan) r.soundingM = gan.m;
  r.ketLuan = ketLuan(r);
  writeFileSync(cf, JSON.stringify(r));
  ra.push(r);
  if (ra.length % 50 === 0) log(`${ra.length}/${Math.min(osm.length, GIOI_HAN)} rạn`);
}

// ── tổng kết ─────────────────────────────────────────────────────────────────
const dem = {};
for (const r of ra) dem[r.ketLuan] = (dem[r.ketLuan] ?? 0) + 1;
const coHai = ra.filter((r) => r.gebco && r.etopo);
const lech = coHai.map((r) => Math.abs(r.gebco.min - r.etopo.min));
const khop = coHai.filter((r, k) => lech[k] <= LECH_M).length;
const moHinhSaiTaiRan = ra.filter((r) => r.aca && Object.keys(r.aca).some((c) => ACA_CAN.has(c)) && Math.max(r.gebco?.min ?? -1e9, r.etopo?.min ?? -1e9) <= -SAU_M).length;
const ungVien = ra.filter((r) => r.ketLuan === "sau");
writeFileSync(join(OUT, "kiem-do-sau-ran.json"), JSON.stringify({ luc: new Date().toISOString(), n: ra.length, dem, khopHaiNguon: coHai.length ? +(100 * khop / coHai.length).toFixed(1) : null, moHinhSaiTaiRan, ran: ra }, null, 1));
writeFileSync(join(OUT, "ung-vien-ran-sau.json"), JSON.stringify(ungVien.map(({ id, kind, bbox, gebco, etopo, aca }) => ({ id, kind, bbox, gebcoM: -gebco.min, etopoM: -etopo.min, aca })), null, 1));
const md = [
  `# Kiểm độ sâu rạn — ${new Date().toISOString().slice(0, 16)}`, ``,
  `Rạn OSM đã soi: **${ra.length}** / ${osm.length}. Hai mô hình (GEBCO, ETOPO) cùng có số: ${coHai.length}; khớp trong ${LECH_M} m: **${coHai.length ? (100 * khop / coHai.length).toFixed(1) : "—"} %**.`, ``,
  `| Kết luận | Số rạn | Nghĩa |`, `|---|---|---|`,
  `| can | ${dem.can ?? 0} | có bằng chứng cạn (ACA crest/flat/lagoon nông, mô hình ≤ ${CAN_M} m, hoặc số đo sâu) — GIỮ CHẶN |`,
  `| trung | ${dem.trung ?? 0} | 5–20 m, hai nguồn khớp — giữ chặn, có thể cân nhắc theo mớn sau |`,
  `| sau | ${dem.sau ?? 0} | ≥ ${SAU_M} m, hai nguồn khớp, không lớp ACA cạn — **ứng viên hạ CHẶN → CẢNH BÁO** (anh Long chốt, doc §7 Q3) |`,
  `| sau-mot-nguon | ${dem["sau-mot-nguon"] ?? 0} | ≥ ${SAU_M} m nhưng chỉ một mô hình có số — chưa đủ tin |`,
  `| mau-thuan | ${dem["mau-thuan"] ?? 0} | hai mô hình lệch > ${LECH_M} m, hoặc mô hình nói sâu mà ACA nói crest/flat — MÔ HÌNH SAI TẠI RẠN, giữ chặn |`,
  `| khong-so | ${dem["khong-so"] ?? 0} | không nguồn nào có số |`, ``,
  `**Mô hình nói ≥ ${SAU_M} m nhưng ACA nói rạn cạn: ${moHinhSaiTaiRan} rạn.** Đây là con số trả lời câu "dữ liệu đủ mà sao không có độ sâu": mô hình độ sâu 450 m KHÔNG đo được rạn — ở đúng những chỗ nó nói sâu nhất mà ảnh vệ tinh 5 m thấy mặt rạn.`, ``,
  `Ứng viên rạn sâu: \`ung-vien-ran-sau.json\` (${ungVien.length}). Từng rạn: \`kiem-do-sau-ran.json\`.`,
].join("\n");
writeFileSync(join(OUT, "kiem-do-sau-ran.md"), md + "\n");
console.log(md);
