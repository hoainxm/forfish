// Sinh TUYẾN HÀNG HẢI + LUỒNG + CHI TIẾT HẢI ĐỒ cho Trục 1 — chạy MỘT LẦN:
//   node scripts/generate-sea-lanes.mjs
//
// Đầu ra: public/data/vn-sea-lanes.v1.json — FeatureCollection, mỗi feature có
//   properties.kind:
//     "tuyen"     — tuyến hàng hải lớn (tàu hàng hay đi) — VẼ TAY, có `ten`
//     "luong"     — luồng vào cảng (fairway, OSM)
//     "phanluong" — sơ đồ phân luồng / traffic separation (OSM)
//     "cap"       — cáp ngầm / ống ngầm (OSM)
//     "giankhoan" — giàn khoan / công trình biển (OSM, điểm)
//   Vùng cấm/khu hạn chế gộp vào "phanluong" hình OUTLINE (ranh khu) — không tô.
//
// ── HAI NGUỒN, GỘP LẠI ────────────────────────────────────────────────────
// (A) TUYẾN LỚN — VẼ TAY. Nguồn mở duy nhất (Global Shipping Lanes) xung đột
//     giấy phép BY-SA/BY-NC → không nhúng (app thương mại). Vẽ THÔ, nhãn
//     "tham khảo" (né va chạm, KHÔNG phải để lái).
// (B) LUỒNG/PHÂN LUỒNG/VÙNG CẤM/CÁP/GIÀN — kéo OpenStreetMap (Overpass, ODbL)
//     LÚC BUILD. Hình học THẬT cộng đồng map.
//     ⚠️ CHỦ QUYỀN: BỎ HẾT tag `name` — chỉ giữ hình học + loại. OSM vùng tranh
//     chấp gắn tên nước ngoài/chữ Hán; giữ tên là lọt đúng thứ app cấm.
//     Khung phủ TRỌN vùng biển VN (gồm Hoàng Sa/Trường Sa) để có ĐỦ luồng +
//     phân luồng + hạ tầng — nhưng vì đã bỏ tên nên KHÔNG lộ nhãn nhạy cảm.
//
// Build-time chứ không runtime: Overpass là host ngoài, mất sóng không về +
// rate-limit. Xuất sẵn asset cùng-origin → service worker giữ → offline vẫn có.

import { writeFileSync, mkdirSync } from "node:fs";

// ── (A) TUYẾN LỚN VẼ TAY ───────────────────────────────────────────────────
// Toạ độ THÔ (~0,5°), chủ ý không mịn: "vùng tàu hàng hay đi", không phải luồng
// lái tàu. [lng, lat].
const TUYEN_LON = [
  {
    ten: "Tuyến Bắc – Nam Biển Đông",
    coords: [
      [104.5, 1.3], [105.6, 2.6], [106.6, 4.6], [107.6, 6.5], [108.6, 8.3],
      [109.4, 10.0], [110.0, 11.8], [110.6, 13.5], [111.3, 15.2], [112.2, 17.0],
      [113.4, 18.8], [114.8, 20.3], [116.0, 21.6],
    ],
  },
  {
    ten: "Nhánh vào Vũng Tàu",
    coords: [[108.6, 8.3], [107.9, 9.3], [107.4, 10.0], [107.08, 10.34]],
  },
  {
    ten: "Nhánh vào Hải Phòng",
    coords: [[113.4, 18.8], [110.5, 19.8], [108.2, 20.5], [106.9, 20.75]],
  },
  {
    ten: "Nhánh vào Đà Nẵng",
    coords: [[110.6, 13.5], [109.6, 15.4], [108.5, 16.1]],
  },
  {
    ten: "Nhánh vào Quy Nhơn",
    coords: [[110.0, 11.8], [109.6, 13.4], [109.28, 13.77]],
  },
];

// ── (B) KHUNG TRỌN VÙNG BIỂN VN cho Overpass (Nam, Tây, Bắc, Đông) ──────────
const OVP_BBOX = [4.0, 102.0, 24.0, 118.0];

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
  way["seamark:type"="fairway"]${b};
  way["seamark:type"="separation_lane"]${b};
  way["seamark:type"="separation_boundary"]${b};
  way["seamark:type"="separation_zone"]${b};
  way["seamark:type"="separation_line"]${b};
  way["seamark:type"="recommended_track"]${b};
  way["seamark:type"="navigation_line"]${b};
  way["seamark:type"="restricted_area"]${b};
  way["seamark:type"="cable_submarine"]${b};
  way["seamark:type"="pipeline_submarine"]${b};
  way["seamark:type"="platform"]${b};
  node["seamark:type"="platform"]${b};
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

// gộp seamark:type → 5 nhóm hiển thị
function osmKind(t) {
  if (t === "fairway") return "luong";
  if (t === "cable_submarine" || t === "pipeline_submarine") return "cap";
  if (t === "platform") return "giankhoan";
  if (t === "restricted_area") return "vungcam";
  // separation_* / recommended_track / navigation_line
  return "phanluong";
}

const features = [];

// (A) tuyến lớn
for (const t of TUYEN_LON) {
  features.push({
    type: "Feature",
    properties: { kind: "tuyen", ten: t.ten },
    geometry: { type: "LineString", coordinates: t.coords },
  });
}
console.log(`tuyến lớn (vẽ tay): ${TUYEN_LON.length}`);

// (B) OSM — hình học THẬT, BỎ HẾT tên
const ovp = await fetchOverpass();
const tally = { luong: 0, phanluong: 0, vungcam: 0, cap: 0, giankhoan: 0 };
if (ovp?.elements) {
  for (const el of ovp.elements) {
    const kind = osmKind(el.tags?.["seamark:type"]);
    if (el.type === "node") {
      // giàn khoan điểm
      if (!Number.isFinite(el.lon) || !Number.isFinite(el.lat)) continue;
      features.push({
        type: "Feature",
        properties: { kind }, // KHÔNG copy name
        geometry: {
          type: "Point",
          coordinates: [Number(el.lon.toFixed(4)), Number(el.lat.toFixed(4))],
        },
      });
      tally[kind]++;
    } else if (el.type === "way" && Array.isArray(el.geometry)) {
      const coords = el.geometry
        .filter((g) => g && Number.isFinite(g.lon) && Number.isFinite(g.lat))
        .map((g) => [Number(g.lon.toFixed(4)), Number(g.lat.toFixed(4))]);
      if (coords.length < 2) continue;
      // giàn khoan dạng way → lấy tâm làm điểm
      if (kind === "giankhoan") {
        const cx = coords.reduce((a, c) => a + c[0], 0) / coords.length;
        const cy = coords.reduce((a, c) => a + c[1], 0) / coords.length;
        features.push({
          type: "Feature",
          properties: { kind },
          geometry: {
            type: "Point",
            coordinates: [Number(cx.toFixed(4)), Number(cy.toFixed(4))],
          },
        });
      } else {
        features.push({
          type: "Feature",
          properties: { kind }, // vùng cấm giữ dạng OUTLINE (LineString), không tô
          geometry: { type: "LineString", coordinates: coords },
        });
      }
      tally[kind]++;
    }
  }
}
console.log("OSM (bỏ tên):", tally);
if (Object.values(tally).every((n) => n === 0)) {
  console.warn(
    "⚠️ Overpass không trả gì — file chỉ có tuyến vẽ tay. Chạy lại khi có mạng.",
  );
}

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
writeFileSync("public/data/vn-sea-lanes.v1.json", JSON.stringify(out));
console.log(
  `OK: public/data/vn-sea-lanes.v1.json — ${features.length} feature, ${Math.round(
    JSON.stringify(out).length / 1024,
  )} KB`,
);
