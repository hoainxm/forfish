// Sinh TUYẾN HÀNG HẢI + LUỒNG + CHI TIẾT HẢI ĐỒ cho Trục 1 — chạy khi nguồn đổi:
//   node scripts/generate-sea-lanes.mjs
//
// Đầu ra: public/data/vn-sea-lanes.v1.json — FeatureCollection, mỗi feature có
//   properties.kind + properties.ten (TIẾNG VIỆT) + properties.src (nguồn):
//     "tuyen"     — tuyến hàng hải lớn (tàu hàng hay đi) — VẼ TAY, có `ten`
//     "luong"     — luồng vào cảng (fairway OSM) HOẶC trục luồng VN (Cục Hàng hải)
//     "phanluong" — sơ đồ phân luồng / traffic separation (OSM)
//     "cap"       — CÁP ngầm (quang / điện) (OSM, LineString)
//     "ong"       — ỐNG DẪN ngầm (khí / dầu / nhiên liệu / nước / xả thải) (OSM, LineString)
//     "cap-bo"    — ĐIỂM CẬP BỜ cáp quang quốc tế tại trạm VN (Point, src=cap-vn)
//     "giankhoan" — giàn khoan / công trình biển (OSM, điểm)
//     "vungcam"   — khu hạn chế (OSM) HOẶC vùng cấm neo 500 m quanh công trình biển
//                   → **Polygon** khép kín (R1 2026-09-03); way OSM hở giữ
//                   LineString + `hoDang: true` (không tự khép = không bịa)
//   src: "van-tay" | "osm" | "vn-aids" | "an-toan" | "cap-vn"
//   loai (phụ, chỉ cap/ong/cap-bo/vungcam — để Lead chọn icon/nhãn):
//     cap/cap-bo: "quang" | "dien" | "chua-ro"
//     ong:        "khi" | "dau" | "nhien-lieu" | "nuoc" | "xa-thai" | "chua-ro"
//     vungcam:    "cam-neo" | "cam-danh-bat" | "cam-vao" | "han-che"
//   tram (chỉ cap-bo): tên trạm cập bờ ("Vũng Tàu" / "Đà Nẵng" / "Quy Nhơn")
//
// ── TÁCH ỐNG DẪN KHỎI CÁP (2026-09-03, review A.4 danh-gia-hai-do-2026-09) ──
// Trước đây `cable_submarine` + `pipeline_submarine` gộp một `kind: "cap"` →
// bà con không phân biệt được ống dẫn khí/dầu (kéo lưới/neo trúng = cháy nổ,
// hải đồ INT1 vẽ L40–L44 KHÁC cáp L30–L32) với cáp quang (trúng = bồi thường).
// Nay: `kind` tách hẳn, `loai` đọc từ tag OSM `substance` /
// `seamark:pipeline_submarine:product` / `seamark:cable_submarine:category`.
// SỰ THẬT về nguồn (đếm 2026-09-03): 25 ống OSM đều ở Hồng Kông / Quảng Đông
// (khí, dầu, nhiên liệu sân bay, cống xả). OSM KHÔNG map ống dầu khí VN
// (Bạch Hổ–Dinh Cố, Nam Côn Sơn 1/2, PM3–Cà Mau) — cần nguồn khác (Thông báo
// hàng hải VMS / PVN) mới bổ sung, KHÔNG bịa.
//
// ── VIỆT HOÁ (chốt 2026-09-03, chỉ đạo chủ dự án) ──────────────────────────
// Trước đây script BỎ HẾT tag `name` của OSM (vùng tranh chấp gắn tên nước
// ngoài/chữ Hán). Nay GIỮ dữ liệu (một cáp ngầm / giàn khoan là SỰ THẬT về thế
// giới, không có bản quyền) nhưng GÁN NHÃN TIẾNG VIỆT theo LOẠI đối tượng +
// vùng biển (dùng tên biển chủ quyền VN: Biển Đông / vịnh Bắc Bộ / vịnh Thái
// Lan). KHÔNG copy `name` gốc của OSM vào file → không lọt chữ Hán / "South
// China Sea" / tên nước ngoài của thực thể VN (cổng audit-names phải SẠCH).
// "Gán mác Việt Nam" = mô tả loại đối tượng bằng tiếng Việt, KHÔNG tuyên bố
// chủ quyền lên lãnh thổ nước khác — một giàn khoan ngoài khơi Hải Nam vẫn ở
// chỗ của nó, ta chỉ mô tả nó bằng tiếng Việt.
//
// Nguồn OSM đã VERIFY 2026-09-03 (bbox 4–24N, 102–118E, cùng truy vấn):
//   fairway 25 · separation_* + navigation_line + recommended_track 108 ·
//   restricted_area 8 · cable_submarine 78 + pipeline_submarine 25 = 103 ·
//   platform 41. Trùng KHỚP số lượng file đang phát → dữ liệu THẬT, không rác.
//   15 phần tử còn tag name (bằng chứng vì sao phải bỏ name): "馬灣航道 Ma Wan
//   Fairway", "太白海鮮舫 Tai Pak Floating Restaurant" (thực ra là nhà hàng nổi
//   HK, KHÔNG phải giàn khoan — lỗi phân loại OSM), cáp thật "FLAG Europe-Asia"
//   (cập bờ Đà Nẵng), "Southeast Asia-Japan Cable" (SJC).
//
// ── BỔ SUNG HẠ TẦNG VN (Phần 2) ────────────────────────────────────────────
// (C) TRỤC LUỒNG VN: OSM gần như KHÔNG có fairway trong vùng biển VN (24/25
//     fairway nằm ở Hồng Kông). Dựng lại trục luồng từ toạ độ báo hiệu CHÍNH
//     THỨC của Cục Hàng hải trong `public/data/vn-aids.v1.json` — gom báo hiệu
//     theo tuyến (cột `rt`), tìm trục chính bằng PCA rồi lấy tâm từng đoạn làm
//     đỉnh (khử lệch trái–phải của cặp phao). Toạ độ SUY từ dữ liệu nhà nước
//     công bố, KHÔNG bịa. Chỉ lấy tuyến ĐỦ tin (≥4 báo hiệu, trải ≥1 km) trong
//     hai bộ tên sạch: index 0–20 ("Tuyến luồng …") + 183–208 ("Luồng hàng hải …").
// (D) VÙNG CẤM NEO 500 m: quanh 7 công trình biển ngoài khơi vịnh Bắc Bộ
//     (lat<21,2 — loại cụm HK/Quảng Đông và nhà hàng nổi). Vòng tròn 500 m là
//     quy tắc an toàn phổ quát (SOLAS/COLREG) quanh MỌI công trình biển — toạ
//     độ vòng SUY hình học từ tâm thật, KHÔNG bịa. Giúp bà con né khi câu gần
//     biên giới. KHÔNG tuyên bố đây là công trình VN.
//
// (Chưa làm — thiếu nguồn, KHÔNG bịa) Ranh giới khu bảo tồn biển VN (16 khu
// theo QĐ 742/QĐ-TTg): có tên + vị trí xấp xỉ công bố, nhưng KHÔNG có toạ độ
// đường bao chính thức → không dựng polygon. Cần nguồn ranh giới có thẩm quyền.
//
// Build-time chứ không runtime: Overpass là host ngoài, mất sóng không về +
// rate-limit. Xuất sẵn asset cùng-origin → service worker giữ → offline vẫn có.
// `vn-aids.v1.json` đọc từ đĩa (không mạng). Đường dẫn file GIỮ NGUYÊN
// `/data/vn-sea-lanes.v1.json` → SW cache lại đúng URL, offline không đổi.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

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
        // mirror hay treo (đo 2026-09-03: kumi >120 s) — không có trần thì
        // script build treo vô hạn
        signal: AbortSignal.timeout(240_000),
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

// gộp seamark:type → 6 nhóm hiển thị (cáp và ống TÁCH RIÊNG)
function osmKind(t) {
  if (t === "fairway") return "luong";
  if (t === "cable_submarine") return "cap";
  if (t === "pipeline_submarine") return "ong";
  if (t === "platform") return "giankhoan";
  if (t === "restricted_area") return "vungcam";
  // separation_* / recommended_track / navigation_line
  return "phanluong";
}

// ── PHÂN LOẠI PHỤ `loai` từ tag OSM (đọc tag, KHÔNG copy name) ──────────────
// Cáp: seamark:cable_submarine:category = fibre_optic | optical | power;
//      hoặc power=cable / communication=line khi thiếu category.
function loaiCap(tags = {}) {
  const cat = tags["seamark:cable_submarine:category"] || "";
  if (/fibre|optic|tele/.test(cat) || tags.communication === "line") return "quang";
  if (cat === "power" || tags.power === "cable") return "dien";
  return "chua-ro";
}
// Ống: substance / seamark:pipeline_submarine:product = gas | oil | fuel |
//      water | stormwater | sewage; category = supply | outfall | intake | sewer.
function loaiOng(tags = {}) {
  const s = (tags.substance || tags["seamark:pipeline_submarine:product"] || "").toLowerCase();
  const cat = tags["seamark:pipeline_submarine:category"] || "";
  if (s === "gas") return "khi";
  if (s === "oil") return "dau";
  if (s === "fuel" || /^fuel/.test(s)) return "nhien-lieu";
  if (s === "water") return "nuoc";
  if (/sewage|stormwater/.test(s) || /outfall|intake|sewer/.test(cat)) return "xa-thai";
  return "chua-ro";
}
// Khu hạn chế: seamark:restricted_area:restriction
function loaiVungCam(tags = {}) {
  const r = tags["seamark:restricted_area:restriction"] || "";
  if (/no_anchoring/.test(r)) return "cam-neo";
  if (/no_fishing/.test(r)) return "cam-danh-bat";
  if (/entry_prohibited|no_entry|restricted_entry/.test(r)) return "cam-vao";
  return "han-che";
}
const TEN_ONG = {
  khi: "Ống dẫn khí",
  dau: "Ống dẫn dầu",
  "nhien-lieu": "Ống dẫn nhiên liệu",
  nuoc: "Ống dẫn nước ngầm",
  "xa-thai": "Ống xả / lấy nước ngầm",
  "chua-ro": "Ống dẫn ngầm",
};
const TEN_CAP = {
  quang: "Cáp quang biển",
  dien: "Cáp điện ngầm",
  "chua-ro": "Cáp ngầm biển",
};
const TEN_VUNGCAM = {
  "cam-neo": "Khu cấm neo",
  "cam-danh-bat": "Khu cấm đánh bắt",
  "cam-vao": "Khu cấm vào",
  "han-che": "Khu hạn chế hàng hải",
};

// ── VÙNG BIỂN (tên chủ quyền VN, trung tính — cổng audit SẠCH) ──────────────
function vungBien(lon, lat) {
  if (lon < 104.5 && lat < 10.5) return "vịnh Thái Lan";
  if (lat >= 17.5 && lon <= 110.5) return "vịnh Bắc Bộ";
  if (lat >= 18) return "Biển Đông (bắc)";
  if (lat >= 12) return "Biển Đông (giữa)";
  return "Biển Đông (nam)";
}

// nhãn tiếng Việt theo LOẠI OSM gốc (+ loại phụ) + vùng biển
function tenOsm(seamarkType, lon, lat, loai) {
  const vb = vungBien(lon, lat);
  switch (seamarkType) {
    case "cable_submarine":
      return `${TEN_CAP[loai] || TEN_CAP["chua-ro"]} — ${vb}`;
    case "pipeline_submarine":
      return `${TEN_ONG[loai] || TEN_ONG["chua-ro"]} — ${vb}`;
    case "platform":
      return `Giàn khoan / công trình biển — ${vb}`;
    case "fairway":
      return `Luồng hàng hải — ${vb}`;
    case "restricted_area":
      return `${TEN_VUNGCAM[loai] || TEN_VUNGCAM["han-che"]} — ${vb}`;
    default:
      return `Phân luồng giao thông — ${vb}`; // separation_* / *_track / *_line
  }
}

// `loai` theo kind (undefined cho kind không có loại phụ → không ghi property)
function loaiOsm(kind, tags) {
  if (kind === "cap") return loaiCap(tags);
  if (kind === "ong") return loaiOng(tags);
  if (kind === "vungcam") return loaiVungCam(tags);
  return undefined;
}

function centroid(coords) {
  const cx = coords.reduce((a, c) => a + c[0], 0) / coords.length;
  const cy = coords.reduce((a, c) => a + c[1], 0) / coords.length;
  return [Number(cx.toFixed(4)), Number(cy.toFixed(4))];
}

const features = [];

// (A) tuyến lớn
for (const t of TUYEN_LON) {
  features.push({
    type: "Feature",
    properties: { kind: "tuyen", ten: t.ten, src: "van-tay" },
    geometry: { type: "LineString", coordinates: t.coords },
  });
}
console.log(`tuyến lớn (vẽ tay): ${TUYEN_LON.length}`);

// (B) OSM — hình học THẬT + nhãn TIẾNG VIỆT (KHÔNG copy name gốc)
const ovp = await fetchOverpass();
const tally = { luong: 0, phanluong: 0, vungcam: 0, cap: 0, ong: 0, giankhoan: 0 };
const tallyLoai = {}; // đếm loại phụ để in ra đối chiếu
const platformPts = []; // để dựng vùng cấm neo 500 m (D)
// properties chung cho một phần tử OSM — chỉ ghi `loai` khi kind có loại phụ
function osmProps(kind, st, tags, lon, lat) {
  const loai = loaiOsm(kind, tags);
  if (loai) tallyLoai[`${kind}/${loai}`] = (tallyLoai[`${kind}/${loai}`] || 0) + 1;
  const p = { kind, ten: tenOsm(st, lon, lat, loai), src: "osm" };
  if (loai) p.loai = loai;
  return p;
}
if (ovp?.elements) {
  for (const el of ovp.elements) {
    const st = el.tags?.["seamark:type"];
    const kind = osmKind(st);
    if (el.type === "node") {
      if (!Number.isFinite(el.lon) || !Number.isFinite(el.lat)) continue;
      const c = [Number(el.lon.toFixed(4)), Number(el.lat.toFixed(4))];
      features.push({
        type: "Feature",
        properties: osmProps(kind, st, el.tags, c[0], c[1]),
        geometry: { type: "Point", coordinates: c },
      });
      if (kind === "giankhoan") platformPts.push(c);
      tally[kind]++;
    } else if (el.type === "way" && Array.isArray(el.geometry)) {
      const coords = el.geometry
        .filter((g) => g && Number.isFinite(g.lon) && Number.isFinite(g.lat))
        .map((g) => [Number(g.lon.toFixed(4)), Number(g.lat.toFixed(4))]);
      if (coords.length < 2) continue;
      if (kind === "giankhoan") {
        const c = centroid(coords);
        features.push({
          type: "Feature",
          properties: osmProps(kind, st, el.tags, c[0], c[1]),
          geometry: { type: "Point", coordinates: c },
        });
        platformPts.push(c);
      } else if (kind === "vungcam") {
        // R1 (review MapLibre): symbol `symbol-placement: point` trên LineString
        // bị đặt ở ĐỈNH ĐẦU từng mảnh sau cắt ô (icon lạc lên vành, nhân bản ở
        // biên ô); fill trên LineString chỉ "tình cờ" chạy. Vùng = Polygon.
        // Way OSM KHÉP KÍN (đỉnh đầu == cuối) → Polygon. Way HỞ → KHÔNG tự khép
        // (khép = bịa diện tích), giữ LineString + cờ `hoDang: true`.
        const mid = coords[Math.floor(coords.length / 2)];
        const props = osmProps(kind, st, el.tags, mid[0], mid[1]);
        const closed =
          coords.length >= 4 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1];
        if (closed) {
          features.push({
            type: "Feature",
            properties: props,
            geometry: { type: "Polygon", coordinates: [coords] },
          });
        } else {
          props.hoDang = true;
          tallyLoai["vungcam/hoDang"] = (tallyLoai["vungcam/hoDang"] || 0) + 1;
          features.push({
            type: "Feature",
            properties: props,
            geometry: { type: "LineString", coordinates: coords },
          });
        }
      } else {
        const mid = coords[Math.floor(coords.length / 2)];
        features.push({
          type: "Feature",
          properties: osmProps(kind, st, el.tags, mid[0], mid[1]),
          geometry: { type: "LineString", coordinates: coords },
        });
      }
      tally[kind]++;
    }
  }
}
console.log("OSM (Việt hoá):", tally);
console.log("OSM loại phụ:", tallyLoai);
if (Object.values(tally).every((n) => n === 0)) {
  console.warn(
    "⚠️ Overpass không trả gì — bỏ qua lớp OSM, giữ tuyến vẽ tay + hạ tầng VN. Chạy lại khi có mạng.",
  );
}

// ── (C) TRỤC LUỒNG VN từ báo hiệu Cục Hàng hải ─────────────────────────────
// PCA: tìm hướng chính của đám phao, sắp theo hình chiếu, chia đoạn, lấy tâm.
function haversineKm(a, b) {
  const R = 6371;
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]);
  const dLon = toR(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function fairwayAxis(pts) {
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) {
    const dx = x - mx, dy = y - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // hướng trục chính
  const ux = Math.cos(th), uy = Math.sin(th);
  const proj = pts
    .map((p) => ({ p, t: (p[0] - mx) * ux + (p[1] - my) * uy }))
    .sort((a, b) => a.t - b.t);
  const spanKm = haversineKm(proj[0].p, proj[proj.length - 1].p);
  const tmin = proj[0].t, tmax = proj[proj.length - 1].t;
  // ~1 đỉnh mỗi 6 km, kẹp [2..12] và không quá nửa số phao
  const K = Math.max(2, Math.min(12, Math.floor(n / 2), Math.round(spanKm / 6) || 2));
  const acc = Array.from({ length: K }, () => ({ x: 0, y: 0, c: 0 }));
  for (const { p, t } of proj) {
    let k = Math.floor(((t - tmin) / ((tmax - tmin) || 1)) * K);
    if (k >= K) k = K - 1;
    if (k < 0) k = 0;
    acc[k].x += p[0]; acc[k].y += p[1]; acc[k].c++;
  }
  const line = acc
    .filter((a) => a.c > 0)
    .map((a) => [Number((a.x / a.c).toFixed(4)), Number((a.y / a.c).toFixed(4))]);
  return { line, spanKm };
}

// hai dải tên SẠCH trong vn-aids.routes (bỏ khoảng 21–182 nhiều OCR rác)
const VN_ROUTE_RANGES = [[0, 20], [183, 208]];
let vnFairways = 0;
try {
  const aids = JSON.parse(
    readFileSync("public/data/vn-aids.v1.json", "utf8"),
  );
  const byRoute = new Map();
  for (const r of aids.marks || []) {
    const rt = r[9]; // cột tuyến
    if (!Number.isFinite(r[0]) || !Number.isFinite(r[1])) continue;
    if (!byRoute.has(rt)) byRoute.set(rt, []);
    byRoute.get(rt).push([r[0], r[1]]);
  }
  const inRange = (rt) =>
    VN_ROUTE_RANGES.some(([a, b]) => rt >= a && rt <= b);
  const seenNames = new Set();
  for (const [rt, pts] of byRoute) {
    if (!inRange(rt)) continue;
    const ten = aids.routes?.[rt]?.ten?.trim();
    if (!ten || pts.length < 4) continue;
    const { line, spanKm } = fairwayAxis(pts);
    if (spanKm < 1.0 || line.length < 2) continue;
    if (seenNames.has(ten)) continue; // khử trùng tên
    seenNames.add(ten);
    features.push({
      type: "Feature",
      properties: { kind: "luong", ten, src: "vn-aids" },
      geometry: { type: "LineString", coordinates: line },
    });
    vnFairways++;
  }
  console.log(`trục luồng VN (vn-aids): ${vnFairways}`);
} catch (e) {
  console.warn(`⚠️ không đọc được vn-aids.v1.json: ${e.message} — bỏ lớp (C)`);
}

// ── (D) VÙNG CẤM NEO 500 m quanh công trình biển vịnh Bắc Bộ ────────────────
// Vòng 16 đỉnh, bán kính 500 m. Chỉ công trình lat<21,2 (loại cụm HK/Quảng Đông
// + nhà hàng nổi). Toạ độ vòng SUY hình học từ tâm thật.
function circle500m(center, radiusM = 500, steps = 16) {
  const [lon, lat] = center;
  const dLat = radiusM / 111320; // m → độ vĩ
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([
      Number((lon + dLon * Math.cos(a)).toFixed(5)),
      Number((lat + dLat * Math.sin(a)).toFixed(5)),
    ]);
  }
  return ring;
}
let safetyZones = 0;
for (const c of platformPts) {
  if (c[1] >= 21.2) continue; // loại cụm HK/Quảng Đông
  features.push({
    type: "Feature",
    properties: {
      kind: "vungcam",
      ten: `Vùng cấm neo quanh công trình biển (bán kính 500 m) — ${vungBien(c[0], c[1])}`,
      src: "an-toan",
      loai: "cam-neo", // Lead: icon `no-anchor` + nhãn "CẤM NEO" riêng, khác khu hạn chế OSM
    },
    // Polygon (R1): vòng 17 đỉnh khép kín → icon/nhãn đặt ở TÂM, fill hợp lệ
    geometry: { type: "Polygon", coordinates: [circle500m(c)] },
  });
  safetyZones++;
}
console.log(`vùng cấm neo 500 m (suy từ tâm giàn khoan): ${safetyZones}`);

// ── (E) CÁP QUANG BIỂN QUỐC TẾ CẬP BỜ VN — ĐIỂM CẬP BỜ (landing) ────────────
// VÌ SAO CHỈ ĐIỂM CẬP BỜ, KHÔNG PHẢI TUYẾN: hình học TUYẾN chi tiết của các
// cáp này chỉ có ở TeleGeography (submarinecablemap.com), giấy phép
// CC BY-NC-SA 3.0 — phần ShareAlike (copyleft) là ràng buộc lên cơ sở dữ liệu
// mà repo CHỦ ĐỘNG TRÁNH (xem CLAUDE.md §Nguồn dữ liệu), và phần NonCommercial
// đụng đúng mô hình bán dữ liệu của họ. OSM KHÔNG map các cáp này (chỉ vài cáp
// quanh Hồng Kông/Đài Loan; "FLAG Europe-Asia" của OSM không chạm Đà Nẵng —
// đỉnh gần nhất cách 509 km). Vì thế theo LUẬT CỨNG của hạng mục: chỉ biết
// ĐIỂM CẬP BỜ (sự thật địa lý công khai, KHÔNG bản quyền) mà không có tuyến
// sạch bản quyền → VẼ ĐIỂM CẬP BỜ, KHÔNG bịa hình tuyến.
//
// ĐIỂM CẬP BỜ = toạ độ trạm cập bờ THẬT (3 trạm VN: Vũng Tàu, Đà Nẵng, Quy
// Nhơn). Danh sách cáp + trạm nào cập ở đâu là thông tin CÔNG KHAI, verify ≥2
// nguồn độc lập cho từng tuyến (TeleGeography + tin VNPT/Viettel/FPT/
// submarinenetworks). Chi tiết truy nguồn: docs/research/cap-ngam-2026-09.md.
//
// SJC (Southeast Asia-Japan Cable bản gốc) KHÔNG có trong danh sách: nó KHÔNG
// cập bờ VN (điểm gần nhất > 15 km, TeleGeography không liệt kê trạm VN). TVH,
// FLAG Europe-Asia (FEA): đã ngừng khai thác → không đưa (không rõ hiện trạng).
const VNCLS = {
  "vung-tau": { ten: "Vũng Tàu", coord: [107.0792, 10.3418] },
  danang: { ten: "Đà Nẵng", coord: [108.2147, 16.0516] },
  "quy-nhon": { ten: "Quy Nhơn", coord: [109.2197, 13.782] },
};
// [tên hiển thị cáp, trạm cập bờ VN] — tên tiếng Việt, không ký tự Hán
const VN_CABLES = [
  ["Cáp quang biển AAG", "vung-tau"], // Asia-America Gateway (2009)
  ["Cáp quang biển AAE-1", "vung-tau"], // Asia-Africa-Europe-1 (2017)
  ["Cáp quang biển Liên Á (IA)", "vung-tau"], // Tata TGN-Intra Asia (2009)
  ["Cáp quang biển VTS (Việt Nam – Singapore)", "vung-tau"], // Viettel–Singtel
  ["Cáp quang biển MViSTA", "vung-tau"], // Stavian Group
  ["Cáp quang biển APG", "danang"], // Asia Pacific Gateway (2016)
  ["Cáp quang biển ALC", "danang"], // Asia Link Cable (2027)
  ["Cáp quang biển SMW-3", "danang"], // SEA-ME-WE 3 (1999, lâu đời nhất)
  ["Cáp quang biển ADC", "quy-nhon"], // Asia Direct Cable (2024)
  ["Cáp quang biển SJC2", "quy-nhon"], // Southeast Asia-Japan Cable 2 (2025)
];
let vnCables = 0;
for (const [ten, cls] of VN_CABLES) {
  const st = VNCLS[cls];
  // ĐIỂM cập bờ = Point riêng `kind: "cap-bo"` (review A.4-3: mẹo LineString
  // độ-dài-0 trước đây hợp lệ về test nhưng VÔ HÌNH trên màn — chấm 1 px).
  // Lead vẽ icon sprite `cable-landing`; `tram` để dán nhãn trạm.
  features.push({
    type: "Feature",
    properties: {
      kind: "cap-bo",
      ten: `${ten} — cập bờ ${st.ten}`,
      src: "cap-vn",
      loai: "quang",
      tram: st.ten,
    },
    geometry: { type: "Point", coordinates: st.coord },
  });
  vnCables++;
}
console.log(`cáp quang biển VN (điểm cập bờ): ${vnCables}`);

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
writeFileSync("public/data/vn-sea-lanes.v1.json", JSON.stringify(out));
console.log(
  `OK: public/data/vn-sea-lanes.v1.json — ${features.length} feature, ${Math.round(
    JSON.stringify(out).length / 1024,
  )} KB`,
);
