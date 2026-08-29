// Tạo lưới độ sâu tĩnh cho dẫn đường (Trục 1) — chạy MỘT LẦN khi cần làm mới:
//   node scripts/generate-depth-grid.mjs
//
// Nguồn: ETOPO 2022 (NOAA NCEI, public domain) qua ERDDAP OceanWatch PIFSC,
// lấy mẫu ĐÚNG BƯỚC GỐC 15 giây cung (1/240° ≈ 450 m). Trước 2026-08-29 script
// lấy mẫu 0,05° (~5,5 km) — tức tự vứt 12 lần độ phân giải của chính dữ liệu đã
// tải về; rạn hẹp và bãi cạn ven bờ lọt khe hết. Nay không còn khe: mỗi ô lưới
// LÀ một ô nguồn, nên cũng KHÔNG cần quét lại vùng rạn theo kiểu min-pool nữa
// (min-pool ở độ phân giải gốc = chính nó).
// Độ sâu đáy biển không đổi theo ngày → đóng gói thành asset tĩnh, runtime
// không gọi API.
//
// Vì sao tải bằng `.dods` (nhị phân DAP2) chứ không `.json`: 17 triệu ô ở dạng
// JSON là ~700 MB chữ, tải cả buổi; `.dods` là float32 thuần ≈ 68 MB, chia
// băng vĩ độ tải trong ~2 phút.
//
// Đầu ra: public/data/depth-grid.v1.bin — 2 bit/ô, 4 ô/byte, row-major
// từ góc Tây Nam (~4,07 MB). Hằng số lưới phải KHỚP src/lib/depth-grid.ts.
//   0 = đất liền (z > -2 m)
//   1 = rất cạn  (z > -4 m)  → tuyến không đi qua (rạn, bãi nổi)
//   2 = nước nông (z > -12 m) → đi được, cảnh báo (tàu cá VN mớn 1,5–3 m
//       chạy vùng 5–8 m hằng ngày — vd vịnh Rạch Giá cạn <10 m suốt 45 km;
//       lưu ý ETOPO ~mực nước trung bình, thuỷ triều có nơi ±2 m)
//   3 = đủ sâu

import { writeFileSync, mkdirSync } from "node:fs";

// Ô ETOPO 15" là ô TÂM: tâm ô nằm ở (k + 0,5)/240 độ. Neo LAT0/LON0 vào đúng
// tâm ô đầu tiên ≥ 5°N / 102°Đ để mọi toạ độ nguồn rơi trúng chỉ số nguyên.
const STEP = 1 / 240; // 15 giây cung ≈ 463 m theo vĩ độ
const LAT0 = 5 + STEP / 2; // 5,002083…
const LON0 = 102 + STEP / 2; // 102,002083…
const N_LAT = 4441; // phủ tới 23,502°B (khung cũ: 5–23,5°B)
const N_LON = 3841; // phủ tới 118,002°Đ (khung cũ: 102–118°Đ)

const ERDDAP =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.dods";
// ERDDAP trả 403 + HTML nếu thiếu User-Agent (án lệ 2026-06-23)
const HEADERS = { "User-Agent": "SDFish/1.0 (+https://github.com/Long-Forfun/ForFish)" };
const ROWS_PER_BAND = 120; // ~1,9 MB/băng — đủ nhỏ để thử lại rẻ
const TRIES = 4;

function classify(z) {
  if (z > -2) return 0;
  if (z > -4) return 1;
  if (z > -12) return 2;
  return 3;
}

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
    `${ERDDAP}?z%5B(${latA.toFixed(6)}):1:(${latB.toFixed(6)})%5D` +
    `%5B(${LON0.toFixed(6)}):1:(${(LON0 + (N_LON - 1) * STEP).toFixed(6)})%5D`;
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

const grid = new Int8Array(N_LAT * N_LON).fill(-1);
const bands = Math.ceil(N_LAT / ROWS_PER_BAND);
const t0 = Date.now();

for (let b = 0; b < bands; b++) {
  const i0 = b * ROWS_PER_BAND;
  const i1 = Math.min(N_LAT - 1, i0 + ROWS_PER_BAND - 1);
  const latA = LAT0 + i0 * STEP;
  const latB = LAT0 + i1 * STEP;
  process.stdout.write(
    `băng ${b + 1}/${bands} ${latA.toFixed(3)}–${latB.toFixed(3)}°B … `,
  );
  const { dv, zOff, lats, lons } = await fetchBand(latA, latB);
  let filled = 0;
  for (let a = 0; a < lats.length; a++) {
    const i = Math.round((lats[a] - LAT0) / STEP);
    if (i < 0 || i >= N_LAT) continue;
    for (let c = 0; c < lons.length; c++) {
      const j = Math.round((lons[c] - LON0) / STEP);
      if (j < 0 || j >= N_LON) continue;
      grid[i * N_LON + j] = classify(dv.getFloat32(zOff + (a * lons.length + c) * 4));
      filled++;
    }
  }
  console.log(`${filled} ô (${Math.round((Date.now() - t0) / 1000)} s)`);
}

const missing = grid.reduce((n, v) => (v === -1 ? n + 1 : n), 0);
if (missing > N_LAT * N_LON * 0.01) {
  throw new Error(`Thiếu ${missing} ô (> 1%) — kiểm tra lại bước/nguồn`);
}
// ô thiếu lẻ tẻ coi như đủ sâu (an toàn nghiêng về "không chặn nhầm giữa khơi")
const packed = new Uint8Array(Math.ceil((N_LAT * N_LON) / 4));
for (let k = 0; k < N_LAT * N_LON; k++) {
  const cls = grid[k] === -1 ? 3 : grid[k];
  packed[k >> 2] |= cls << ((k & 3) * 2);
}

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/depth-grid.v1.bin", packed);
console.log(
  `OK: public/data/depth-grid.v1.bin — ${N_LAT}×${N_LON} ô, ${packed.length} byte, thiếu ${missing}`,
);

// kiểm tra nhanh vài điểm đã biết
const at = (lat, lon) => {
  const k =
    Math.round((lat - LAT0) / STEP) * N_LON + Math.round((lon - LON0) / STEP);
  return (packed[k >> 2] >> ((k & 3) * 2)) & 3;
};
console.log("khơi Nam Trung Bộ (13, 110.5) →", at(13, 110.5), "(mong 3)");
console.log("đồng bằng Cà Mau (9.1, 105.1) →", at(9.1, 105.1), "(mong 0)");
console.log("Vịnh Bắc Bộ (19.5, 107.3)    →", at(19.5, 107.3), "(mong 2-3)");
// Rạn giữa biển: ở bước 450 m một điểm đơn lẻ có thể rơi trúng LÒNG HỒ giữa rạn
// (sâu thật) → soi cả mảng quanh đó rồi báo lớp nguy hiểm nhất, đúng thứ tuyến
// đường quan tâm. Đây chỉ là in kiểm tra, không đụng dữ liệu đã đóng gói.
const worstAround = (lat, lon, rings) => {
  let w = 3;
  for (let a = -rings; a <= rings; a++)
    for (let b = -rings; b <= rings; b++)
      w = Math.min(w, at(lat + a * STEP, lon + b * STEP));
  return w;
};
console.log("Đá Chữ Thập TS (9.55, 112.89) quanh ~11 km →", worstAround(9.55, 112.89, 24), "(mong 0)");
console.log("Đảo Phú Lâm HS (16.83, 112.33) quanh ~5 km →", worstAround(16.83, 112.33, 12), "(mong 0)");
