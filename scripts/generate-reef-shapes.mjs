// Sinh HÌNH DẠNG RẠN / BÃI ĐÁ NGẦM cho Trục 1 — chạy MỘT LẦN (khi có mạng):
//   node scripts/generate-reef-shapes.mjs
//
// Đầu ra: public/data/reef-shapes.v1.json — FeatureCollection, properties.kind:
//   "reef"  (rạn san hô, Polygon/LineString)   | "shoal" (bãi cạn/ngầm, Polygon/Line)
//   "rock"  (đá ngầm/chướng ngại hàng hải, Point) | "wreck" (xác tàu, Point)
//   rock/wreck = ĐIỂM HIỂM HOẠ gần bờ (seamark:type) — nơi natural=reef thưa.
//   KHÔNG có tên — chỉ hình học (nhãn tên Việt lấy từ coral-reefs.v1.json).
//
// ── NGUỒN ──────────────────────────────────────────────────────────────────
// OpenStreetMap qua Overpass (ODbL, dùng thương mại được) — tag `natural=reef`
// và `natural=shoal`. Cùng khuôn generate-sea-lanes.mjs (kéo LÚC BUILD, không
// runtime): Overpass là host ngoài, mất sóng không về + rate-limit → xuất sẵn
// asset cùng-origin để service worker giữ (offline có hình rạn).
//
// ⚠️ CHỦ QUYỀN: BỎ HẾT tag `name` — OSM vùng tranh chấp gắn tên nước ngoài/chữ
// Hán (Fiery Cross Reef…); giữ tên là lọt đúng thứ app cấm. Chỉ hình học + loại.
//
// ĐƠN GIẢN HOÁ (không thêm dependency): radial-distance thuần + làm tròn 4 số.
// Ngư dân xem PHẠM VI rạn ở mức vùng, không phải để lái sát mép → ~150 m đủ.

import { writeFileSync, mkdirSync } from "node:fs";

// Khung trọn vùng biển VN (Nam, Tây, Bắc, Đông) — gồm Hoàng Sa/Trường Sa.
const OVP_BBOX = [4.0, 102.0, 24.0, 118.0];
const SIMPLIFY_TOL = 0.007; // ~770 m — ngư dân xem PHẠM VI rạn mức vùng, không lái sát mép; ưu tiên nhẹ để offline
const ROUND = 4; // 4 số thập phân ~11 m

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

function overpassQL() {
  const [s, w, n, e] = OVP_BBOX;
  const b = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:180];
(
  way["natural"="reef"]${b};
  way["natural"="shoal"]${b};
  relation["natural"="reef"]${b};
  relation["natural"="shoal"]${b};
  node["seamark:type"="rock"]${b};
  node["seamark:type"="obstruction"]${b};
  node["seamark:type"="wreck"]${b};
);
out geom;`;
}

async function fetchOverpass() {
  const body = "data=" + encodeURIComponent(overpassQL());
  for (const url of OVERPASS_MIRRORS) {
    try {
      process.stdout.write(`Overpass ${new URL(url).host} … `);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SDFish-build/1.0 (fisherman app; nautical chart)",
        },
        body,
      });
      if (!res.ok) {
        console.log(`HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      console.log(`ok — ${json.elements?.length ?? 0} phần tử`);
      return json;
    } catch (e) {
      console.log(`lỗi: ${e.message}`);
    }
  }
  return null;
}

const r = (v) => Number(v.toFixed(ROUND));

/** Đơn giản hoá radial-distance: bỏ điểm cách điểm-giữ-trước < tol. An toàn cho
    cả đường mở lẫn vòng kín (không sập vòng như Douglas-Peucker cùng 2 mút). */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) >= tol) {
      out.push(p);
      prev = p;
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** way OSM (mảng {lon,lat}) → mảng [lng,lat] làm tròn, lọc điểm lỗi. */
function toCoords(geometry) {
  return (geometry ?? [])
    .filter((g) => g && Number.isFinite(g.lon) && Number.isFinite(g.lat))
    .map((g) => [r(g.lon), r(g.lat)]);
}

function isClosed(coords) {
  const a = coords[0];
  const b = coords[coords.length - 1];
  return coords.length >= 4 && a[0] === b[0] && a[1] === b[1];
}

/** Đóng gói một mảng toạ độ (đã simplify) thành Feature Polygon (nếu kín) hoặc
    LineString (nếu hở), hoặc null nếu suy biến. */
function toFeature(rawCoords, kind) {
  const closed = isClosed(rawCoords);
  let coords = simplify(rawCoords, SIMPLIFY_TOL);
  if (closed) {
    // giữ vòng kín: mút cuối trùng mút đầu
    if (coords.length < 4) return null;
    coords[coords.length - 1] = coords[0];
    return {
      type: "Feature",
      properties: { kind },
      geometry: { type: "Polygon", coordinates: [coords] },
    };
  }
  if (coords.length < 2) return null;
  return {
    type: "Feature",
    properties: { kind },
    geometry: { type: "LineString", coordinates: coords },
  };
}

const kindOf = (t) => (t === "shoal" ? "shoal" : "reef");

const ovp = await fetchOverpass();
const features = [];
const tally = { reef: 0, shoal: 0, rock: 0, wreck: 0 };
let rawVerts = 0;
let keptVerts = 0;

if (ovp?.elements) {
  for (const el of ovp.elements) {
    // ĐIỂM HIỂM HOẠ hàng hải: seamark rock/obstruction/wreck (đá ngầm / chướng
    // ngại / xác tàu) — thường ở GẦN BỜ, nơi natural=reef thưa. Render dạng điểm.
    if (el.type === "node") {
      if (!Number.isFinite(el.lon) || !Number.isFinite(el.lat)) continue;
      const st = el.tags?.["seamark:type"];
      const hk = st === "wreck" ? "wreck" : "rock"; // rock + obstruction → "rock"
      features.push({
        type: "Feature",
        properties: { kind: hk },
        geometry: { type: "Point", coordinates: [r(el.lon), r(el.lat)] },
      });
      tally[hk]++;
      continue;
    }
    const kind = kindOf(el.tags?.natural);
    if (el.type === "way" && Array.isArray(el.geometry)) {
      const coords = toCoords(el.geometry);
      if (coords.length < 2) continue;
      rawVerts += coords.length;
      const f = toFeature(coords, kind);
      if (!f) continue;
      keptVerts += f.geometry.coordinates.flat(Infinity).length / 2;
      features.push(f);
      tally[kind]++;
    } else if (el.type === "relation" && Array.isArray(el.members)) {
      // multipolygon: mỗi member way outer/inner → vẽ từng vòng như đường viền
      for (const m of el.members) {
        if (m.type !== "way" || !Array.isArray(m.geometry)) continue;
        const coords = toCoords(m.geometry);
        if (coords.length < 2) continue;
        rawVerts += coords.length;
        const f = toFeature(coords, kind);
        if (!f) continue;
        keptVerts += f.geometry.coordinates.flat(Infinity).length / 2;
        features.push(f);
        tally[kind]++;
      }
    }
  }
}

console.log("OSM reef/shoal (bỏ tên):", tally, `— giữ ${Math.round(keptVerts)}/${rawVerts} đỉnh`);
if (features.length === 0) {
  console.warn(
    "⚠️ Overpass không trả gì — KHÔNG ghi đè file cũ. Chạy lại khi có mạng.",
  );
  process.exit(0);
}

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
writeFileSync("public/data/reef-shapes.v1.json", JSON.stringify(out));
console.log(
  `OK: public/data/reef-shapes.v1.json — ${features.length} hình, ${Math.round(
    JSON.stringify(out).length / 1024,
  )} KB`,
);
