// Tạo lưới độ sâu tĩnh cho dẫn đường (Trục 1) — chạy MỘT LẦN khi cần làm mới:
//   node scripts/generate-depth-grid.mjs
//
// Nguồn: ETOPO 2022 (NOAA NCEI, public domain) qua ERDDAP OceanWatch PIFSC,
// lấy mẫu bước 0,05° (~5,5 km — khớp cỡ lưới tìm đường). Độ sâu đáy biển
// không đổi theo ngày → đóng gói thành asset tĩnh, runtime không gọi API.
//
// Đầu ra: public/data/depth-grid.v1.bin — 2 bit/ô, 4 ô/byte, row-major
// từ góc Tây Nam. Hằng số lưới phải KHỚP src/lib/depth-grid.ts.
//   0 = đất liền (z > -2 m)
//   1 = rất cạn  (z > -4 m)  → tuyến không đi qua (rạn, bãi nổi)
//   2 = nước nông (z > -12 m) → đi được, cảnh báo (tàu cá VN mớn 1,5–3 m
//       chạy vùng 5–8 m hằng ngày — vd vịnh Rạch Giá cạn <10 m suốt 45 km;
//       lưu ý ETOPO ~mực nước trung bình, thuỷ triều có nơi ±2 m)
//   3 = đủ sâu

import { writeFileSync, mkdirSync } from "node:fs";

const LAT0 = 5.0, LAT1 = 23.5, LON0 = 102.0, LON1 = 118.0, STEP = 0.05;
const N_LAT = Math.round((LAT1 - LAT0) / STEP) + 1; // 371
const N_LON = Math.round((LON1 - LON0) / STEP) + 1; // 321
// ETOPO 15 giây cung → bước 0,05° = stride 12
const ERDDAP =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json";

function classify(z) {
  if (z > -2) return 0;
  if (z > -4) return 1;
  if (z > -12) return 2;
  return 3;
}

const grid = new Int8Array(N_LAT * N_LON).fill(-1);

// kéo theo dải vĩ độ cho nhẹ từng request
const BANDS = 8;
for (let b = 0; b < BANDS; b++) {
  // band chồng mép 1 bước để stride không làm rơi hàng giáp ranh
  const a = Math.max(LAT0, LAT0 + ((LAT1 - LAT0) * b) / BANDS - STEP);
  const z = LAT0 + ((LAT1 - LAT0) * (b + 1)) / BANDS;
  const url =
    `${ERDDAP}?z%5B(${a.toFixed(3)}):12:(${z.toFixed(3)})%5D` +
    `%5B(${LON0}):12:(${LON1})%5D`;
  process.stdout.write(`band ${b + 1}/${BANDS} ${a.toFixed(2)}–${z.toFixed(2)}°N … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ERDDAP ${res.status} cho band ${b}`);
  const json = await res.json();
  let filled = 0;
  for (const [lat, lon, zv] of json.table.rows) {
    const i = Math.round((lat - LAT0) / STEP);
    const j = Math.round((lon - LON0) / STEP);
    if (i < 0 || i >= N_LAT || j < 0 || j >= N_LON) continue;
    grid[i * N_LON + j] = classify(zv);
    filled++;
  }
  console.log(`${filled} ô`);
}

// Vùng rạn san hô giữa biển: rạn hẹp ~1 km lọt khe lấy mẫu 0,05° → quét lại
// Ở ĐỘ PHÂN GIẢI GỐC 15" (~450 m) và lấy LỚP NGUY HIỂM NHẤT trong từng ô
// (min-pool — bảo toàn an toàn; chỗ khác đáy thoải, lấy mẫu điểm là đủ)
const REEF_BOXES = [
  { name: "Quần đảo Trường Sa", latMin: 7.4, latMax: 11.8, lonMin: 111.0, lonMax: 115.9 },
  { name: "Quần đảo Hoàng Sa", latMin: 15.4, latMax: 17.4, lonMin: 110.3, lonMax: 113.0 },
  { name: "Bãi Macclesfield/Scarborough", latMin: 14.9, latMax: 17.0, lonMin: 113.3, lonMax: 115.9 },
];
for (const box of REEF_BOXES) {
  const strips = Math.ceil(box.latMax - box.latMin);
  for (let s = 0; s < strips; s++) {
    const a = box.latMin + s;
    const z = Math.min(box.latMax, a + 1);
    const url =
      `${ERDDAP}?z%5B(${a.toFixed(3)}):1:(${z.toFixed(3)})%5D` +
      `%5B(${box.lonMin}):1:(${box.lonMax})%5D`;
    process.stdout.write(`rạn: ${box.name} ${a.toFixed(1)}–${z.toFixed(1)}°N … `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ERDDAP ${res.status} cho ${box.name}`);
    const json = await res.json();
    let hits = 0;
    for (const [lat, lon, zv] of json.table.rows) {
      const i = Math.round((lat - LAT0) / STEP);
      const j = Math.round((lon - LON0) / STEP);
      if (i < 0 || i >= N_LAT || j < 0 || j >= N_LON) continue;
      const k = i * N_LON + j;
      const cls = classify(zv);
      const cur = grid[k] === -1 ? 3 : grid[k];
      if (cls < cur) {
        grid[k] = cls;
        hits++;
      }
    }
    console.log(`${json.table.rows.length} điểm, siết ${hits} ô`);
  }
}

const missing = grid.filter((v) => v === -1).length;
if (missing > N_LAT * N_LON * 0.01) {
  throw new Error(`Thiếu ${missing} ô (> 1%) — kiểm tra lại stride/nguồn`);
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
console.log("Đá Chữ Thập TS (9.55, 112.89) →", at(9.55, 112.89), "(mong 0-1)");
console.log("Đảo Phú Lâm HS (16.83, 112.33) →", at(16.83, 112.33), "(mong 0-1)");
