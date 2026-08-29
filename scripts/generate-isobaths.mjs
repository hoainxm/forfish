// Sinh ĐƯỜNG ĐẲNG SÂU (isobath) cho lớp hải đồ Trục 1 — chạy MỘT LẦN:
//   node scripts/generate-isobaths.mjs
//
// Vì sao tự sinh: WMS đẳng sâu của EMODnet chỉ phủ châu Âu — vùng VN trắng.
// Nguồn: ETOPO 2022 (NOAA, public domain) qua ERDDAP — cùng nguồn với
// generate-depth-grid.mjs. Marching squares rồi nối đoạn thành tuyến dài để
// bản đồ dán được nhãn "50 m" dọc đường.
//
// Đầu ra: public/data/isobaths.v1.json — FeatureCollection<LineString, {d}>
// d = độ sâu mét (dương).
//
// ── BA LỰA CHỌN CỦA ĐỢT 2026-08-29 (nâng độ phân giải, giữ ngân sách) ──────
// 1) BƯỚC LƯỚI 1/48° ≈ 0,0208° (~2,3 km), trước là 0,1° (~11 km). Không lấy
//    tròn 0,02° vì lưới gốc ETOPO là 15" = 1/240°, mà 0,02° không chia hết cho
//    1/240 → ERDDAP chỉ nhận stride NGUYÊN. Stride 5 (=1/48°) là mức gần 0,02°
//    nhất mà mỗi mắt lưới rơi trúng đúng một ô nguồn, không nội suy oan.
// 2) THÊM HAI MỨC NÔNG 5 m VÀ 10 m. Tàu cá VN mớn 1,5–3 m, vùng 5–8 m là vùng
//    chạy hằng ngày; mức nông nhất cũ là 20 m — quá thô cho ven bờ. Hai mức mới
//    sinh trên TOÀN KHUNG (không giới hạn thềm lục địa): chúng tự chỉ xuất hiện
//    ở nơi có đáy nông, và giới hạn theo hộp toạ độ sẽ cắt mất bãi cạn giữa
//    biển (Trường Sa, Hoàng Sa) — đúng chỗ nguy hiểm nhất.
// 3) GIẢN LƯỢC DOUGLAS–PEUCKER, dung sai theo mức (TOL_DEG). Mọi dung sai đều
//    NHỎ HƠN NHIỀU so với bước lưới 0,0208°, nên đây là cắt điểm thừa gần thẳng
//    hàng, KHÔNG phải làm mờ hình. Mức nông (5/10/20 m) để dung sai chặt nhất
//    (0,002° ≈ 220 m) vì đó là đường bà con thật sự chạy men theo; mức sâu
//    2000 m nới rộng hơn vì chỉ để nhìn thế đáy.
//    Kết quả: ~1,3 MB — nằm dưới trần 1,5 MB. Trần này KHÔNG phải con số đẹp:
//    file nằm trong CRITICAL_SHELL của service worker (tải nguyên khối lúc cài
//    PWA), nặng quá là hỏng ngân sách cài đặt ở cảng sóng yếu.
//
// Vì sao tải bằng `.dods` (nhị phân DAP2) chứ không `.json`: float32 thuần,
// nhẹ hơn cả chục lần so với JSON chữ.

import { writeFileSync, mkdirSync } from "node:fs";

// Ô ETOPO 15" là ô TÂM (tâm ở (k + 0,5)/240 độ) → neo LAT0/LON0 vào tâm ô để
// toạ độ nguồn rơi trúng chỉ số nguyên. Cùng quy ước với generate-depth-grid.
const STRIDE = 5; // trên lưới gốc 15"
const STEP = STRIDE / 240; // 1/48° ≈ 0,0208°
const LAT0 = 5 + 1 / 480, LON0 = 102 + 1 / 480;
const N_LAT = 865; // tới ~23,00°B
const N_LON = 769; // tới ~118,00°Đ
const LEVELS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
/** Dung sai Douglas–Peucker theo mức (độ) — xem lựa chọn 3 ở đầu file */
const TOL_DEG = {
  5: 0.002, 10: 0.002, 20: 0.002, 50: 0.003, 100: 0.005,
  200: 0.006, 500: 0.008, 1000: 0.008, 2000: 0.008,
};

const ERDDAP =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.dods";
// ERDDAP trả 403 + HTML nếu thiếu User-Agent (án lệ 2026-06-23)
const HEADERS = { "User-Agent": "SDFish/1.0 (+https://github.com/Long-Forfun/ForFish)" };
const ROWS_PER_BAND = 200;
const TRIES = 4;

/** Đọc thân nhị phân DAP2: [z float32][latitude float64][longitude float64] */
function parseDods(ab) {
  const buf = Buffer.from(ab);
  const m = buf.indexOf("\nData:\n");
  if (m < 0) throw new Error("thân .dods không có mốc Data:");
  const dv = new DataView(ab);
  let o = m + 7;
  const nz = dv.getInt32(o);
  o += 8;
  const zOff = o;
  o += 4 * nz;
  const nLat = dv.getInt32(o);
  o += 8;
  const lats = new Float64Array(nLat);
  for (let i = 0; i < nLat; i++) lats[i] = dv.getFloat64(o + i * 8);
  o += 8 * nLat;
  const nLon = dv.getInt32(o);
  o += 8;
  const lons = new Float64Array(nLon);
  for (let i = 0; i < nLon; i++) lons[i] = dv.getFloat64(o + i * 8);
  if (nz !== nLat * nLon) throw new Error(`.dods lệch cỡ: ${nz} ≠ ${nLat}×${nLon}`);
  return { dv, zOff, lats, lons };
}

async function fetchBand(latA, latB) {
  const url =
    `${ERDDAP}?z%5B(${latA.toFixed(6)}):${STRIDE}:(${latB.toFixed(6)})%5D` +
    `%5B(${LON0.toFixed(6)}):${STRIDE}:(${(LON0 + (N_LON - 1) * STEP).toFixed(6)})%5D`;
  let last;
  for (let t = 1; t <= TRIES; t++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`ERDDAP ${res.status}`);
      return parseDods(await res.arrayBuffer());
    } catch (e) {
      last = e;
      process.stdout.write(`lỗi (${e.message}), thử lại ${t}/${TRIES} … `);
      await new Promise((r) => setTimeout(r, 1500 * t));
    }
  }
  throw last;
}

// ── kéo lưới z ───────────────────────────────────────────────────────────
const z = new Float32Array(N_LAT * N_LON).fill(NaN);
const bands = Math.ceil(N_LAT / ROWS_PER_BAND);
for (let b = 0; b < bands; b++) {
  const i0 = b * ROWS_PER_BAND;
  const i1 = Math.min(N_LAT - 1, i0 + ROWS_PER_BAND - 1);
  process.stdout.write(`băng ${b + 1}/${bands} … `);
  const { dv, zOff, lats, lons } = await fetchBand(LAT0 + i0 * STEP, LAT0 + i1 * STEP);
  for (let a = 0; a < lats.length; a++) {
    const i = Math.round((lats[a] - LAT0) / STEP);
    if (i < 0 || i >= N_LAT) continue;
    for (let c = 0; c < lons.length; c++) {
      const j = Math.round((lons[c] - LON0) / STEP);
      if (j < 0 || j >= N_LON) continue;
      z[i * N_LON + j] = dv.getFloat32(zOff + (a * lons.length + c) * 4);
    }
  }
  console.log("ok");
}
const holes = z.reduce((n, v) => (Number.isNaN(v) ? n + 1 : n), 0);
if (holes > 0) throw new Error(`Thiếu ${holes} mắt lưới — kiểm tra lại stride/nguồn`);

// ── marching squares cho từng mức sâu ────────────────────────────────────
const lat = (i) => LAT0 + i * STEP;
const lon = (j) => LON0 + j * STEP;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** điểm cắt nội suy giữa 2 đỉnh lưới */
function interp(level, x0, y0, v0, x1, y1, v1) {
  const t = (level - v0) / (v1 - v0);
  return [r3(x0 + t * (x1 - x0)), r3(y0 + t * (y1 - y0))];
}

function segmentsForLevel(level) {
  const L = -level; // z âm dưới mực nước
  const segs = [];
  for (let i = 0; i < N_LAT - 1; i++) {
    for (let j = 0; j < N_LON - 1; j++) {
      const v00 = z[i * N_LON + j], v01 = z[i * N_LON + j + 1];
      const v10 = z[(i + 1) * N_LON + j], v11 = z[(i + 1) * N_LON + j + 1];
      if ([v00, v01, v10, v11].some((v) => Number.isNaN(v))) continue;
      let idx = 0;
      if (v00 > L) idx |= 1;
      if (v01 > L) idx |= 2;
      if (v11 > L) idx |= 4;
      if (v10 > L) idx |= 8;
      if (idx === 0 || idx === 15) continue;
      const x0 = lon(j), x1 = lon(j + 1), y0 = lat(i), y1 = lat(i + 1);
      // các điểm cắt trên 4 cạnh
      const bottom = () => interp(L, x0, y0, v00, x1, y0, v01);
      const top = () => interp(L, x0, y1, v10, x1, y1, v11);
      const left = () => interp(L, x0, y0, v00, x0, y1, v10);
      const right = () => interp(L, x1, y0, v01, x1, y1, v11);
      // bảng marching squares (bỏ qua 2 ca mơ hồ 5/10 — nối đơn giản)
      const TABLE = {
        1: [left, bottom], 2: [bottom, right], 3: [left, right],
        4: [top, right], 6: [bottom, top], 7: [left, top],
        8: [left, top], 9: [bottom, top], 11: [top, right],
        12: [left, right], 13: [bottom, right], 14: [left, bottom],
        5: [left, bottom], 10: [bottom, right],
      };
      const pair = TABLE[idx];
      if (pair) segs.push([pair[0](), pair[1]()]);
    }
  }
  return segs;
}

/** nối đoạn rời thành polyline dài (hashmap đầu mút) để dán nhãn đẹp */
function chain(segs) {
  const key = (p) => `${p[0]},${p[1]}`;
  const byEnd = new Map();
  const used = new Array(segs.length).fill(false);
  segs.forEach((s, i) => {
    for (const p of [s[0], s[1]]) {
      const k = key(p);
      if (!byEnd.has(k)) byEnd.set(k, []);
      byEnd.get(k).push(i);
    }
  });
  const lines = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const line = [...segs[i]];
    // nối về 2 phía
    for (const headFirst of [false, true]) {
      for (;;) {
        const end = headFirst ? line[0] : line[line.length - 1];
        const cands = (byEnd.get(key(end)) ?? []).filter((s) => !used[s]);
        if (cands.length === 0) break;
        const si = cands[0];
        used[si] = true;
        const [a, b] = segs[si];
        const next = key(a) === key(end) ? b : a;
        if (headFirst) line.unshift(next);
        else line.push(next);
      }
    }
    if (line.length >= 4) lines.push(line); // bỏ vụn ngắn
  }
  return lines;
}

/** Douglas–Peucker: bỏ điểm gần thẳng hàng, giữ nguyên đầu/cuối và mọi khúc gãy
    lệch quá `tol` độ. Lặp bằng ngăn xếp — tuyến dài cả vạn điểm không tràn stack. */
function simplify(pts, tol) {
  if (pts.length < 3 || tol <= 0) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1, bi = -1;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = pts[k];
      const d = len === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * (px - ax) - dx * (py - ay)) / len;
      if (d > best) { best = d; bi = k; }
    }
    if (best > tol) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const features = [];
for (const level of LEVELS) {
  const segs = segmentsForLevel(level);
  const lines = chain(segs);
  let pts = 0;
  for (const raw of lines) {
    const coords = simplify(raw, TOL_DEG[level] ?? 0);
    pts += coords.length;
    features.push({
      type: "Feature",
      properties: { d: level },
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  console.log(
    `đẳng sâu ${level} m: ${segs.length} đoạn → ${lines.length} tuyến, ${pts} điểm`,
  );
}

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
writeFileSync("public/data/isobaths.v1.json", JSON.stringify(out));
console.log(
  `OK: public/data/isobaths.v1.json — ${features.length} tuyến, ${Math.round(JSON.stringify(out).length / 1024)} KB`,
);
