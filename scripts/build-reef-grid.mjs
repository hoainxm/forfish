// LƯỚI RẠN 0,25° cho dự báo cá → src/data/reef-grid-025.v1.json (2026-10-03).
//
// VÌ SAO CÓ FILE NÀY: cổng độ sâu `inshore` chấm theo độ sâu ĐÁY TRUNG BÌNH ô
// 0,25° (~27 km). Rạn Trường Sa/Hoàng Sa là chóp san hô nhô từ nền 1.000–2.000 m
// nên ô chứa rạn vẫn "sâu" ⇒ cá hồng/mú/kẽm bị ×0 ngay chỗ ngư dân câu ở sườn
// rạn 20–150 m. Lưới này trả lời "ô này CÓ RẠN không" để cổng rạn (`requiresReef`
// trong fish-predict.ts) cho đi qua.
//
// NGUỒN (đều là bản RÕ trong git, không fetch):
//   · public/data/reef-shapes-aca.v1.bin — Allen Coral Atlas + WCMC-008 (CC-BY 4.0),
//     680 reef + 854 shoal MultiPolygon, 4,03 triệu đỉnh. Phủ cả Trường Sa (809
//     feature trong 6–12°N/111–118°E) và Hoàng Sa (35) — đo 2026-10-03.
//   · public/data/reef-shapes.v1.json — OSM natural=reef/shoal (Polygon) + rock/
//     wreck (Point): lấp rạn đá ven bờ mà ACA (chỉ san hô) không có.
//   · public/data/coral-reefs.v1.json — rạn/đá/bãi CÓ TÊN (Point, Wikipedia VI).
//
// CÁCH TÍNH: tô đa giác lên lưới mịn 0,01° (~1,1 km; 625 điểm/ô) bằng quét dòng
// chẵn–lẻ, rồi đếm tỷ lệ điểm có rạn trong mỗi ô 0,25° ⇒ `frac` ∈ [0,1]. Điểm
// (rock/wreck/rạn có tên) đánh dấu đúng 1 điểm mịn (frac ≥ 1/625) — có mặt là đủ
// cho cổng, không bịa diện tích.
//
// VÌ SAO TÍNH LÚC BUILD, KHÔNG ĐỌC .bin LÚC CHẠY: dự báo cá tính ở server
// (fish-forecast-run.ts, cron). Trên Vercel `public/data/**` lúc chạy là BẢN MÃ
// (SDF1) và không chắc nằm trên đĩa của function; `data-fetch.ts` là cửa đọc cho
// TRÌNH DUYỆT (URL cùng origin). Lưới 80×64 ô ~20 KB nằm trong `src/data` đi
// theo bundle server — không mạng, không giải mã, chạy cả Vercel lẫn IIS lẫn test.
//
// Chạy lại CHỈ KHI nguồn rạn đổi:  node scripts/build-reef-grid.mjs
// Cổng `reef-grid.test.ts` đỏ nếu `sourceHash` trong file lệch với 3 nguồn.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeReefShapes } from "../src/lib/reef-bin.mjs";

export const OUT = "src/data/reef-grid-025.v1.json";
export const SOURCES = [
  "public/data/reef-shapes-aca.v1.bin",
  "public/data/reef-shapes.v1.json",
  "public/data/coral-reefs.v1.json",
];
/** khung = header ACA bbox [102,4,118,24] — trùm toàn biển VN */
export const BBOX = { lon0: 102, lat0: 4, lon1: 118, lat1: 24 };
export const STEP = 0.25;
/** bước lưới mịn — 25 điểm mỗi cạnh ô */
export const FINE = 0.01;

/** @param {string} root */
export function sourceHash(root = process.cwd()) {
  const h = createHash("sha256");
  for (const p of SOURCES) h.update(readFileSync(join(root, p)));
  return h.digest("hex").slice(0, 16);
}

/**
 * Tô một Polygon (ring[0] ngoài, còn lại là lỗ) vào mặt nạ mịn theo luật chẵn–lẻ.
 * @param {Uint8Array} mask  nFineLat × nFineLon
 * @param {number[][][]} rings
 */
function fillPolygon(mask, rings, nFineLat, nFineLon) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const r of rings) for (const [, y] of r) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const r0 = Math.max(0, Math.floor((minY - BBOX.lat0) / FINE));
  const r1 = Math.min(nFineLat - 1, Math.floor((maxY - BBOX.lat0) / FINE));
  const xs = [];
  for (let row = r0; row <= r1; row++) {
    const y = BBOX.lat0 + (row + 0.5) * FINE;
    xs.length = 0;
    for (const r of rings) {
      const n = r.length;
      for (let k = 0; k < n; k++) {
        const [x1, y1] = r[k];
        const [x2, y2] = r[(k + 1) % n];
        if (y1 === y2) continue;
        if (y < Math.min(y1, y2) || y >= Math.max(y1, y2)) continue;
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - BBOX.lon0) / FINE - 0.5));
      const c1 = Math.min(nFineLon - 1, Math.floor((xs[k + 1] - BBOX.lon0) / FINE - 0.5));
      for (let c = c0; c <= c1; c++) mask[row * nFineLon + c] = 1;
    }
  }
}

/** @param {Uint8Array} mask @param {number} lon @param {number} lat */
function markPoint(mask, lon, lat, nFineLat, nFineLon) {
  const c = Math.floor((lon - BBOX.lon0) / FINE);
  const r = Math.floor((lat - BBOX.lat0) / FINE);
  if (c < 0 || r < 0 || c >= nFineLon || r >= nFineLat) return;
  mask[r * nFineLon + c] = 1;
}

/** @param {string} root gốc repo */
export function buildReefGrid(root = process.cwd()) {
  const nFineLat = Math.round((BBOX.lat1 - BBOX.lat0) / FINE);
  const nFineLon = Math.round((BBOX.lon1 - BBOX.lon0) / FINE);
  const mask = new Uint8Array(nFineLat * nFineLon);
  const counts = { polygons: 0, points: 0 };

  const addFeature = (f) => {
    const g = f.geometry;
    if (!g) return;
    if (g.type === "Polygon") {
      counts.polygons++;
      fillPolygon(mask, g.coordinates, nFineLat, nFineLon);
    } else if (g.type === "MultiPolygon") {
      counts.polygons++;
      for (const poly of g.coordinates) fillPolygon(mask, poly, nFineLat, nFineLon);
    } else if (g.type === "Point") {
      counts.points++;
      markPoint(mask, g.coordinates[0], g.coordinates[1], nFineLat, nFineLon);
    }
    // LineString (OSM reef dạng đường) bỏ — không có diện tích; 207 feature, ven bờ
  };

  const aca = decodeReefShapes(new Uint8Array(readFileSync(join(root, SOURCES[0]))));
  for (const f of aca.features) addFeature(f);
  const osm = JSON.parse(readFileSync(join(root, SOURCES[1]), "utf8"));
  for (const f of osm.features) addFeature(f);
  const named = JSON.parse(readFileSync(join(root, SOURCES[2]), "utf8"));
  for (const f of named.features) addFeature(f);

  const per = Math.round(STEP / FINE); // 25
  const nLat = Math.round((BBOX.lat1 - BBOX.lat0) / STEP);
  const nLon = Math.round((BBOX.lon1 - BBOX.lon0) / STEP);
  const lats = Array.from({ length: nLat }, (_, i) => +(BBOX.lat0 + (i + 0.5) * STEP).toFixed(4));
  const lons = Array.from({ length: nLon }, (_, j) => +(BBOX.lon0 + (j + 0.5) * STEP).toFixed(4));
  const values = [];
  let cellsWithReef = 0;
  for (let i = 0; i < nLat; i++) {
    const row = [];
    for (let j = 0; j < nLon; j++) {
      let n = 0;
      for (let a = 0; a < per; a++) {
        const base = (i * per + a) * nFineLon + j * per;
        for (let b = 0; b < per; b++) n += mask[base + b];
      }
      const frac = n / (per * per);
      if (frac > 0) cellsWithReef++;
      row.push(+frac.toFixed(4));
    }
    values.push(row);
  }
  return {
    v: 1,
    builtFrom: SOURCES,
    sourceHash: sourceHash(root),
    stats: { ...counts, cellsWithReef, cells: nLat * nLon },
    unit: "unknown",
    date: "2026-10-03",
    lats,
    lons,
    values,
  };
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const t0 = Date.now();
  const out = buildReefGrid();
  writeFileSync(join(process.cwd(), OUT), JSON.stringify(out) + "\n");
  console.log(`[reef-grid] ghi ${OUT} — ${JSON.stringify(out.stats)} trong ${Date.now() - t0} ms`);
}
