// Sinh NỀN TỐI GIẢN OFFLINE cho bản đồ Ra khơi — chạy MỘT LẦN:
//   node scripts/generate-coastline.mjs
//
// Vì sao cần: toàn bộ tile bản đồ nền là host ngoài (cartocdn). Mất sóng giữa
// biển thì tile không về → màn hình trắng, bà con không thấy bờ, không thấy
// đảo, mũi tên gió lơ lửng giữa khoảng không. File này đóng gói hình BỜ + ĐẢO
// vào máy (public/) để service worker giữ sẵn, mất sóng vẫn vẽ được.
//
// Nguồn: Natural Earth 1:10m (PUBLIC DOMAIN, không key, không phí)
//   · ne_10m_land          — đất liền + đảo lớn (Phú Quốc, Côn Đảo, Hải Nam…)
//   · ne_10m_minor_islands — đảo nhỏ, gồm Hoàng Sa (12) + Trường Sa (11)
// Xử lý: cắt về khung biển VN → giản lược Douglas–Peucker → làm tròn 3 số.
//
// Đầu ra: public/data/vn-coast.v1.json — FeatureCollection<Polygon>
// (không thuộc tính: chỉ cần HÌNH để bà con định hướng; tên đảo/nhãn chủ quyền
//  do lớp nhãn HTML trong app lo, không nhồi vào đây cho nhẹ file).

import { writeFileSync, mkdirSync } from "node:fs";

// Khung: trọn biển VN + Hoàng Sa + Trường Sa + bờ nước bạn quanh vịnh
const BOX = { x0: 99.0, y0: 3.0, x1: 121.0, y1: 24.0 };
// Giản lược: 0,004° ≈ 440 m — đủ mịn ở z9, mà file vẫn nhỏ
const TOL_LAND = 0.004;
const NE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const FILES = ["ne_10m_land", "ne_10m_minor_islands"];

const r3 = (v) => Math.round(v * 1000) / 1000;

// ── cắt vòng (ring) về khung chữ nhật — Sutherland–Hodgman ───────────────
/** side > 0 nghĩa là điểm nằm phía TRONG của cạnh đang cắt */
function clipRing(ring, inside, intersect) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i + ring.length - 1) % ring.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

function clipToBox(ring) {
  const edges = [
    {
      inside: (p) => p[0] >= BOX.x0,
      intersect: (a, b) => [BOX.x0, lerpY(a, b, BOX.x0)],
    },
    {
      inside: (p) => p[0] <= BOX.x1,
      intersect: (a, b) => [BOX.x1, lerpY(a, b, BOX.x1)],
    },
    {
      inside: (p) => p[1] >= BOX.y0,
      intersect: (a, b) => [lerpX(a, b, BOX.y0), BOX.y0],
    },
    {
      inside: (p) => p[1] <= BOX.y1,
      intersect: (a, b) => [lerpX(a, b, BOX.y1), BOX.y1],
    },
  ];
  let cur = ring;
  for (const e of edges) {
    if (cur.length === 0) return [];
    cur = clipRing(cur, e.inside, e.intersect);
  }
  return cur;
}

const lerpY = (a, b, x) =>
  b[0] === a[0] ? a[1] : a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
const lerpX = (a, b, y) =>
  b[1] === a[1] ? a[0] : a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);

// ── giản lược Douglas–Peucker ────────────────────────────────────────────
function sqSegDist(p, a, b) {
  let x = a[0],
    y = a[1];
  let dx = b[0] - x,
    dy = b[1] - y;
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
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplify(pts, tol) {
  if (pts.length <= 3) return pts;
  const sq = tol * tol;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let maxD = 0,
      idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = sqSegDist(pts[i], pts[lo], pts[hi]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > sq && idx > 0) {
      keep[idx] = true;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** diện tích ký hiệu (độ²) — dùng để bỏ vụn 0 diện tích sau khi cắt */
function ringArea(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(s / 2);
}

function closeRing(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}

// ── chạy ─────────────────────────────────────────────────────────────────
const features = [];
let rawCoords = 0;
let keptCoords = 0;

for (const name of FILES) {
  process.stdout.write(`${name} … `);
  const res = await fetch(`${NE}/${name}.geojson`);
  if (!res.ok) throw new Error(`Natural Earth ${name}: HTTP ${res.status}`);
  const json = await res.json();
  // Đảo nhỏ (Hoàng Sa/Trường Sa cỡ vài trăm mét) KHÔNG giản lược — giản là mất
  const tol = name === "ne_10m_land" ? TOL_LAND : 0;
  let kept = 0;
  for (const ft of json.features ?? []) {
    const g = ft.geometry;
    if (!g) continue;
    const polys =
      g.type === "Polygon"
        ? [g.coordinates]
        : g.type === "MultiPolygon"
          ? g.coordinates
          : [];
    for (const poly of polys) {
      const rings = [];
      for (const ring of poly) {
        rawCoords += ring.length;
        const clipped = clipToBox(ring);
        if (clipped.length < 4) continue;
        const simple = tol > 0 ? simplify(clipped, tol) : clipped;
        if (simple.length < 4) continue;
        const rounded = closeRing(simple.map(([x, y]) => [r3(x), r3(y)]));
        if (ringArea(rounded) < 1e-7) continue; // vụn sát cạnh khung
        rings.push(rounded);
        keptCoords += rounded.length;
      }
      if (rings.length === 0) continue;
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: rings },
      });
      kept++;
    }
  }
  console.log(`ok — ${kept} mảng đất`);
}

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
const text = JSON.stringify(out);
writeFileSync("public/data/vn-coast.v1.json", text);
console.log(
  `OK: public/data/vn-coast.v1.json — ${features.length} mảng, ` +
    `${keptCoords}/${rawCoords} điểm, ${Math.round(text.length / 1024)} KB`,
);
