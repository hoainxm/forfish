// Sinh HÌNH DẠNG RẠN / BÃI ĐÁ NGẦM cho Trục 1 — chạy MỘT LẦN (khi có mạng):
//   node scripts/generate-reef-shapes.mjs
//
// Đầu ra: public/data/reef-shapes.v1.json — FeatureCollection, properties.kind:
//   "reef"  (rạn san hô, Polygon/LineString)   | "shoal" (bãi cạn/ngầm, Polygon/Line)
//   "rock"  (đá ngầm/chướng ngại hàng hải, Point) | "wreck" (xác tàu, Point)
//   rock/wreck = ĐIỂM HIỂM HOẠ (seamark:type) — thường GẦN BỜ, nơi natural=reef thưa.
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
// Đo 2026-08-29: trong khung này OSM có 160 tên chứa ký tự Hán → cổng CJK cuối
// file quét TOÀN BỘ chuỗi sắp ghi, còn chữ Hán là `throw`, KHÔNG ghi file.
//
// ── ĐƠN GIẢN HOÁ: Douglas–Peucker tự viết (không thêm dependency) ───────────
// Trước 2026-08-29 dùng radial-distance tol 0.007° (~770 m). Hai vấn đề THẬT:
//   (1) radial chỉ thưa điểm, KHÔNG chặn sai số — mép rạn lệch tới ~770 m ở MỌI
//       mức zoom; rạn là vật cản chết người, 770 m là con số lớn.
//   (2) radial giữ đúng 2 mút, nên vòng nhỏ bị rút còn 2 điểm rồi bị loại —
//       ~1.400/2.612 vòng (rạn nhỏ ven bờ) BIẾN MẤT khỏi hải đồ. Đây là lỗ hổng
//       an toàn, không phải chuyện đẹp/xấu.
// Douglas–Peucker CHẶN sai số: điểm bị bỏ không bao giờ lệch quá tol khỏi đường
// vẽ ra. Đo trên cùng bộ dữ liệu, DP thắng radial ở CẢ BA mặt (nhiều hình hơn,
// ít điểm hơn, nhẹ hơn) — bảng đánh đổi (KB thô / KB gzip):
//   tol 0.0007° (~78 m): 2.623 hình · 21.663 đỉnh · 631 KB · gz 113 KB
//   tol 0.0005° (~56 m): 2.623 hình · 24.410 đỉnh · 679 KB · gz 126 KB
//   tol 0.0003° (~33 m): 2.624 hình · 29.276 đỉnh · 765 KB · gz 147 KB  ← CHỐT
//   tol 0.0002° (~22 m): 2.624 hình · 33.808 đỉnh · 845 KB · gz 166 KB
//   tol 0.0001° (~11 m): 2.629 hình · 42.119 đỉnh · 992 KB · gz 198 KB
// Chốt 0.0003°: sai số mép 770 m → ~33 m (tốt lên 23 lần), ~3 px ở zoom 14 —
// mắt không phân biệt nổi nữa. Dưới nữa vô nghĩa vì ROUND=4 đã lượng tử ~11 m.
// Ngân sách 1,2 MB → 765 KB còn ~36% chỗ trống cho OSM mọc thêm lần sinh sau.
// ⚠️ OFFLINE: file nằm trong SHELL của service worker ở tier BEST-EFFORT. Thô
// 315 KB → 765 KB, nhưng qua mạng là gzip 62 KB → 147 KB (+85 KB) — cài ở cảng
// sóng yếu vẫn nhẹ. Nếu lần sinh sau vượt 1,2 MB: HỎI LEAD, đừng tự nâng trần.

import { writeFileSync, mkdirSync } from "node:fs";

// Khung trọn vùng biển VN (Nam, Tây, Bắc, Đông) — gồm Hoàng Sa/Trường Sa.
const OVP_BBOX = [4.0, 102.0, 24.0, 118.0];
const SIMPLIFY_TOL = 0.0003; // ~33 m — trần sai số mép rạn (xem bảng đánh đổi trên)
const ROUND = 4; // 4 số thập phân ~11 m
const MAX_BYTES = 1.2 * 1024 * 1024; // trần ngân sách offline — vượt thì HỎI LEAD

/** seamark:type được coi là điểm hiểm hoạ hàng hải. */
const HAZARD_SEAMARKS = new Set(["rock", "obstruction", "wreck"]);

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

function overpassQL() {
  const [s, w, n, e] = OVP_BBOX;
  const b = `(${s},${w},${n},${e})`;
  // Hiểm hoạ seamark phải hỏi CẢ `way`, không chỉ `node`: đo 2026-08-29 thấy
  // OSM có 16 way rock/obstruction/wreck trong khung (đá/xác tàu vẽ thành hình,
  // không phải chấm) — truy vấn cũ chỉ hỏi node nên bỏ sót hết 16 vật cản này.
  return `[out:json][timeout:180];
(
  way["natural"="reef"]${b};
  way["natural"="shoal"]${b};
  relation["natural"="reef"]${b};
  relation["natural"="shoal"]${b};
  node["seamark:type"="rock"]${b};
  node["seamark:type"="obstruction"]${b};
  node["seamark:type"="wreck"]${b};
  way["seamark:type"="rock"]${b};
  way["seamark:type"="obstruction"]${b};
  way["seamark:type"="wreck"]${b};
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

/** Bình phương khoảng cách từ p tới ĐOẠN ab (không phải đường thẳng vô hạn). */
function segDist2(p, a, b) {
  let x = a[0];
  let y = a[1];
  const dx = b[0] - x;
  const dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  return (p[0] - x) ** 2 + (p[1] - y) ** 2;
}

/** Douglas–Peucker đệ quy: đánh dấu giữ điểm lệch xa đoạn [first,last] nhất. */
function dpRange(pts, first, last, tol2, keep) {
  let maxD = tol2;
  let idx = -1;
  for (let i = first + 1; i < last; i++) {
    const d = segDist2(pts[i], pts[first], pts[last]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (idx === -1) return; // cả đoạn nằm trong tol → bỏ hết điểm giữa
  keep[idx] = true;
  dpRange(pts, first, idx, tol2, keep);
  dpRange(pts, idx, last, tol2, keep);
}

/**
 * Đơn giản hoá Douglas–Peucker — điểm bị bỏ lệch tối đa `tol` khỏi hình vẽ ra.
 * VÒNG KÍN: hai mút trùng nhau nên DP thẳng sẽ sập cả vòng; cắt vòng tại điểm
 * XA mút đầu nhất rồi chạy DP trên hai nửa (thủ thuật chuẩn, không cần lib).
 */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const tol2 = tol * tol;
  const last = pts.length - 1;
  const closed = pts[0][0] === pts[last][0] && pts[0][1] === pts[last][1];
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[last] = true;
  if (closed && pts.length > 3) {
    let far = 1;
    let fd = -1;
    for (let i = 1; i < last; i++) {
      const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
      if (d > fd) {
        fd = d;
        far = i;
      }
    }
    keep[far] = true;
    dpRange(pts, 0, far, tol2, keep);
    dpRange(pts, far, last, tol2, keep);
  } else {
    dpRange(pts, 0, last, tol2, keep);
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * CỨU VÒNG NHỎ: rạn bé hơn ~2×tol bị DP rút còn <4 điểm. KHÔNG được bỏ — mất
 * một vật cản khỏi hải đồ nguy hiểm hơn nhiều so với vẽ nó thô. Giữ 4 đỉnh cực
 * (tây/bắc/đông/nam) THẬT của vòng, theo đúng thứ tự gốc nên không tự cắt nhau;
 * hình bao vẫn chạm đúng mép ngoài cùng — sai lệch nghiêng về phía CẢNH BÁO THỪA.
 */
function extremeRing(pts) {
  const n = pts.length - 1; // bỏ mút cuối (trùng mút đầu)
  let iW = 0;
  let iE = 0;
  let iS = 0;
  let iN = 0;
  for (let i = 1; i < n; i++) {
    if (pts[i][0] < pts[iW][0]) iW = i;
    if (pts[i][0] > pts[iE][0]) iE = i;
    if (pts[i][1] < pts[iS][1]) iS = i;
    if (pts[i][1] > pts[iN][1]) iN = i;
  }
  const idx = [...new Set([iW, iN, iE, iS])].sort((a, b) => a - b);
  if (idx.length < 3) return null; // suy biến thật (mọi điểm trùng nhau)
  const ring = idx.map((i) => pts[i]);
  ring.push(ring[0]);
  return ring;
}

/** way OSM (mảng {lon,lat}) → mảng [lng,lat] làm tròn, lọc điểm lỗi. */
function toCoords(geometry) {
  return (geometry ?? [])
    .filter((g) => g && Number.isFinite(g.lon) && Number.isFinite(g.lat))
    .map((g) => [r(g.lon), r(g.lat)]);
}

/** `out geom` trả TRỌN hình member của relation, kể cả phần tràn ngoài bbox. */
function inFrame(coords) {
  const [s, w, n, e] = OVP_BBOX;
  return coords.every(
    ([lng, lat]) => lng >= w && lng <= e && lat >= s && lat <= n,
  );
}

function isClosed(coords) {
  const a = coords[0];
  const b = coords[coords.length - 1];
  return coords.length >= 4 && a[0] === b[0] && a[1] === b[1];
}

/** Tâm hình học của một way (trung bình đỉnh) — dùng cho hiểm hoạ vẽ thành hình. */
function centroid(coords) {
  const n = isClosed(coords) ? coords.length - 1 : coords.length;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += coords[i][0];
    y += coords[i][1];
  }
  return [r(x / n), r(y / n)];
}

/** Đóng gói một mảng toạ độ thành Feature Polygon (nếu kín) / LineString (nếu hở). */
function toFeature(rawCoords, kind) {
  if (isClosed(rawCoords)) {
    let coords = simplify(rawCoords, SIMPLIFY_TOL);
    if (coords.length < 4) {
      coords = extremeRing(rawCoords);
      if (!coords) return null;
      rescued++;
    }
    coords[coords.length - 1] = coords[0]; // giữ vòng kín
    return {
      type: "Feature",
      properties: { kind },
      geometry: { type: "Polygon", coordinates: [coords] },
    };
  }
  const coords = simplify(rawCoords, SIMPLIFY_TOL);
  if (coords.length < 2) return null;
  return {
    type: "Feature",
    properties: { kind },
    geometry: { type: "LineString", coordinates: coords },
  };
}

const ovp = await fetchOverpass();
const features = [];
const tally = { reef: 0, shoal: 0, rock: 0, wreck: 0 };
let rawVerts = 0;
let keptVerts = 0;
let rescued = 0;
let outOfFrame = 0;
let hazardWays = 0;

/** Hiểm hoạ hàng hải → luôn là Point (hợp đồng render của lớp rạn). */
function pushHazard(coords, seamarkType) {
  const kind = seamarkType === "wreck" ? "wreck" : "rock"; // rock + obstruction → "rock"
  features.push({
    type: "Feature",
    properties: { kind },
    geometry: { type: "Point", coordinates: coords },
  });
  tally[kind]++;
  keptVerts++;
}

function pushShape(geometry, kind) {
  const coords = toCoords(geometry);
  if (coords.length < 2) return;
  if (!inFrame(coords)) {
    outOfFrame++;
    return;
  }
  rawVerts += coords.length;
  const f = toFeature(coords, kind);
  if (!f) return;
  keptVerts += f.geometry.coordinates.flat(Infinity).length / 2;
  features.push(f);
  tally[kind]++;
}

if (ovp?.elements) {
  for (const el of ovp.elements) {
    const seamark = el.tags?.["seamark:type"];

    // ĐIỂM HIỂM HOẠ: seamark rock/obstruction/wreck (đá ngầm / chướng ngại /
    // xác tàu). Node → chính nó. Way → TÂM HÌNH HỌC: các way này bé (2–36 đỉnh,
    // vài chục mét), giữ nguyên hình chẳng thêm thông tin gì cho người lái mà
    // lại phá hợp đồng "rock/wreck = Point" của lớp render; một chấm cảnh báo
    // đúng chỗ là thứ bà con cần.
    if (el.type === "node") {
      if (!Number.isFinite(el.lon) || !Number.isFinite(el.lat)) continue;
      if (HAZARD_SEAMARKS.has(seamark)) pushHazard([r(el.lon), r(el.lat)], seamark);
      continue;
    }
    if (
      el.type === "way" &&
      HAZARD_SEAMARKS.has(seamark) &&
      Array.isArray(el.geometry)
    ) {
      const coords = toCoords(el.geometry);
      if (coords.length && inFrame(coords)) {
        pushHazard(centroid(coords), seamark);
        hazardWays++;
      }
    }

    // HÌNH RẠN/BÃI. Chỉ nhận natural=reef|shoal — truy vấn seamark kéo về cả
    // way natural=coastline / bare_rock, lọt vào đây sẽ bị vẽ nhầm thành rạn.
    // KHÔNG `continue` sau nhánh hiểm hoạ ở trên: 3 way vừa seamark:type=rock
    // vừa natural=reef → CỐ Ý ra cả hai (chấm cảnh báo + hình rạn), vì chấm là
    // thứ thấy được ở zoom xa còn hình mới cho biết rạn rộng tới đâu.
    const natural = el.tags?.natural;
    if (natural !== "reef" && natural !== "shoal") continue;
    const kind = natural === "shoal" ? "shoal" : "reef";
    if (el.type === "way" && Array.isArray(el.geometry)) {
      pushShape(el.geometry, kind);
    } else if (el.type === "relation" && Array.isArray(el.members)) {
      // multipolygon: mỗi member way outer/inner → vẽ từng vòng như đường viền
      for (const m of el.members) {
        if (m.type !== "way" || !Array.isArray(m.geometry)) continue;
        pushShape(m.geometry, kind);
      }
    }
  }
}

console.log(
  "OSM reef/shoal (bỏ tên):",
  tally,
  `— giữ ${Math.round(keptVerts)}/${rawVerts} đỉnh · cứu ${rescued} vòng nhỏ` +
    ` · ${hazardWays} hiểm hoạ dạng way → tâm · bỏ ${outOfFrame} vòng tràn khung`,
);
if (features.length === 0) {
  console.warn(
    "⚠️ Overpass không trả gì — KHÔNG ghi đè file cũ. Chạy lại khi có mạng.",
  );
  process.exit(0);
}

const out = { type: "FeatureCollection", features };
const json = JSON.stringify(out);

// ── CỔNG TỰ KIỂM CHỦ QUYỀN — không cho lọt ký tự Hán/CJK ────────────────────
// Quét TOÀN BỘ chuỗi sắp ghi (không chỉ field mình nhớ tới). Còn chữ Hán là
// throw, KHÔNG ghi file — thà không có lớp rạn còn hơn lọt nhãn nước ngoài.
const CJK = /[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿]/;
const hit = json.match(CJK);
if (hit) {
  throw new Error(
    `CHẶN: dữ liệu sắp ghi còn ký tự Hán/CJK ("${hit[0]}" ở vị trí ${hit.index}) — kiểm lại việc bỏ tag name.`,
  );
}

// Không feature nào được mang thuộc tính ngoài `kind` (name lọt vào là hỏng).
const stray = features.find(
  (f) =>
    Object.keys(f.properties).length !== 1 ||
    !["reef", "shoal", "rock", "wreck"].includes(f.properties.kind),
);
if (stray) {
  throw new Error(
    `CHẶN: feature có thuộc tính lạ — ${JSON.stringify(stray.properties)}`,
  );
}

const bytes = Buffer.byteLength(json);
if (bytes > MAX_BYTES) {
  throw new Error(
    `CHẶN: ${Math.round(bytes / 1024)} KB vượt trần offline ${Math.round(
      MAX_BYTES / 1024,
    )} KB — nới SIMPLIFY_TOL hoặc HỎI LEAD trước khi nâng trần.`,
  );
}

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/reef-shapes.v1.json", json);
console.log(
  `OK: public/data/reef-shapes.v1.json — ${features.length} hình, ${Math.round(
    bytes / 1024,
  )} KB (trần ${Math.round(MAX_BYTES / 1024)} KB)`,
);
