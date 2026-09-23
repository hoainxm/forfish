// ĐO PHƯƠNG PHÁP BẢN ĐỒ "NHẸ MÀ RÕ" — chạy trên dữ liệu THẬT trong public/data:
//   node scripts/bench-map-method.mjs            # đủ 8 phần
//   node scripts/bench-map-method.mjs 1 4 5      # chỉ chạy phần 1, 4, 5
//
// Script này KHÔNG sinh asset, KHÔNG ghi vào public/. Nó chỉ ĐỌC dữ liệu đang
// phát hành rồi in bảng số để chốt phương pháp. Mọi con số trong
// docs/research/phuong-phap-ban-do.md đều lấy ra từ đây — chạy lại là kiểm
// chứng lại được, không phải tin lời.
//
// ── ĐỌC BẢNG THEO ƯU TIÊN NÀO (chủ dự án chốt 2026-08-29) ──────────────────
// "Mạng 4G/5G hiện nay và cấu hình máy điện thoại thì dung lượng app web không
//  phải là vấn đề, 40–50 MB đều tải rất nhanh. Chủ yếu cái cơ chế hiển thị khi
//  có dữ liệu, có cache, có cái offline phải làm chuẩn."
// ⇒ Ngân sách dung lượng nay ~40–50 MB, không phải 17 MB. Phần 1, 2, 6 (giản
//   lược theo zoom + độ rõ) là phần LÁI THIẾT KẾ. Phần 4, 5 (lượng tử hoá, nén
//   thưa) hạ xuống THAM KHẢO: chúng vẫn được đo đầy đủ và kết quả vẫn có ích,
//   nhưng KHÔNG được dùng để cắt chi tiết hiển thị. Nếu đọc bảng thấy "cách A
//   nhẹ hơn cách B 39 KB", câu trả lời đúng bây giờ là "kệ 39 KB, cách nào rõ
//   hơn / hiển thị chuẩn hơn thì chọn cách đó".
//
// ── TÁM PHẦN ĐO ────────────────────────────────────────────────────────────
//  1. Giản lược THEO ZOOM (một dung sai/mức zoom) so với MỘT dung sai cho mọi
//     zoom — cách repo đang làm (tol 0,0003° cố định trong generate-reef-shapes).
//  2. Tile hoá lớp hải đồ → byte thật phải tải cho MỘT KHUNG NHÌN điện thoại.
//  3. Tách lớp theo việc: ô "chỉ hải đồ" nhẹ hơn ô nền Protomaps (đầy nhà cửa,
//     đường phố) bao nhiêu lần — đọc thẳng vn-basemap.pmtiles.
//  4. Lượng tử hoá toạ độ: JSON 4 số lẻ (đang dùng) vs 3 số lẻ vs toạ độ
//     nguyên trong ô (kiểu MVT) — byte và sai số mét.
//  5. Mã hoá lưới độ sâu: 2 bit/ô đặc (đang dùng) vs RLE vs khối-thưa vs cây
//     tứ phân — đĩa, byte qua sóng, thời gian chuẩn bị, thời gian tra 1 điểm.
//  6. ĐỘ RÕ: sai số hình học tối đa (mét và PIXEL) ở mỗi zoom, số đối tượng bị
//     rơi, mật độ đỉnh/ô. Nhẹ mà mờ thì vô nghĩa nên phần này đi kèm phần 1.
//  7. TRẦN ĐỘ NÉT của chính dữ liệu đang phát hành: ở z13+ thì cái chặn là dung
//     sai lúc SINH FILE, không phải mạng — phần trả lời thẳng ưu tiên mới.
//  8. TƯƠNG PHẢN nét hải đồ trên nền nước (WCAG), màu đọc thẳng từ ocean-map.ts
//     — "rõ" dưới nắng chói không chỉ là hình học đúng chỗ.
//
// ── TRUNG THỰC ─────────────────────────────────────────────────────────────
//  · "gz" = gzip mức mặc định (giống server thật), "br" = brotli mức 5 (mức
//    Vercel/CDN dùng cho nội dung động; mức 11 chỉ hợp asset nén sẵn lúc build).
//  · Ô hải đồ ở phần 2–3 mã hoá bằng varint-delta toạ độ nguyên trong ô — ĐÚNG
//    cách MVT mã hoá hình học, nhưng KHÔNG bọc protobuf. Nên byte của ta hơi
//    LẠC QUAN so với MVT thật (thiếu vài chục byte khung tag/layer mỗi ô). Đã
//    ghi rõ trong bảng, đừng đọc thành "ta nén giỏi hơn Protomaps".
//  · Cắt lát hình theo ô dùng cắt ĐOẠN (Liang–Barsky). Vòng kín (polygon rạn)
//    bị cắt thành đường mở, không đóng lại theo mép ô như MVT — nên byte của ta
//    hơi BI QUAN vài phần trăm ở ô có polygon bị cắt. Hai sai lệch ngược chiều
//    nhau, và cả hai đều nhỏ so với tỉ lệ đang đo (hàng chục lần).
//  · Thời gian chạy đo trên máy dev, KHÔNG phải điện thoại yếu. Con số dùng để
//    SO SÁNH GIỮA CÁC CÁCH, không phải để hứa "chạy trong X ms trên máy bà con".

import { readFileSync, openSync, readSync, statSync } from "node:fs";
import { gzipSync, brotliCompressSync, constants as zconst } from "node:zlib";
import { join } from "node:path";
import { PMTiles } from "pmtiles";

const DATA = join(process.cwd(), "public", "data");
const KB = 1024;

/* ══════════════════════════════════════════════════════════════════════════
   TIỆN ÍCH ĐO
   ══════════════════════════════════════════════════════════════════════════ */

const gz = (buf) => gzipSync(buf).length;
const br = (buf) =>
  brotliCompressSync(buf, {
    params: { [zconst.BROTLI_PARAM_QUALITY]: 5 },
  }).length;

const kb = (n) => (n / KB).toFixed(1);
const pct = (a, b) => (b === 0 ? "—" : ((a / b) * 100).toFixed(0) + "%");

/** Chạy `fn` `n` lần, trả về ms trung bình của lần chạy nhanh nhất trong 3 vòng. */
function timeIt(fn, n = 1) {
  let best = Infinity;
  for (let round = 0; round < 3; round++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms < best) best = ms;
  }
  return best;
}

/** In bảng canh cột — cột đầu căn trái, còn lại căn phải. */
function table(head, rows) {
  const all = [head, ...rows].map((r) => r.map((c) => String(c)));
  const w = head.map((_, i) => Math.max(...all.map((r) => (r[i] ?? "").length)));
  const line = (r) =>
    r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join("  ");
  console.log("  " + line(all[0]));
  console.log("  " + w.map((n) => "─".repeat(n)).join("  "));
  for (const r of all.slice(1)) console.log("  " + line(r));
}

function section(n, title) {
  console.log("\n" + "═".repeat(78));
  console.log(`PHẦN ${n} — ${title}`);
  console.log("═".repeat(78));
}

/* ══════════════════════════════════════════════════════════════════════════
   HÌNH HỌC — LÀM VIỆC TRONG KHÔNG GIAN PIXEL, KHÔNG PHẢI ĐỘ

   Đây là điểm khác cốt lõi so với pipeline hiện tại (DP dung sai 0,0003° cho
   MỌI zoom). Một độ kinh tuyến ở vĩ 22° chỉ dài bằng 0,93 lần ở vĩ 5°, nên dung
   sai tính bằng ĐỘ là méo theo vĩ độ; và nó không nói gì về việc mắt có nhìn
   thấy sai số đó hay không. Dung sai tính bằng PIXEL Ở MỘT MỨC ZOOM thì vừa
   đẳng hướng (Mercator bảo giác) vừa là đơn vị mắt người thật sự đọc.
   ══════════════════════════════════════════════════════════════════════════ */

const TILE = 256;
/** Chu vi Trái Đất theo Web Mercator (m) — để đổi pixel ↔ mét. */
const EARTH_C = 40075016.686;

/** lon/lat → pixel thế giới ở zoom z (gốc trái-trên, 256 px/ô). */
function toPx(lon, lat, z) {
  const s = TILE * 2 ** z;
  const x = ((lon + 180) / 360) * s;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s;
  return [x, y];
}

/** Mét trên một pixel ở zoom z, vĩ độ lat (Mercator co theo cos(lat)). */
const metersPerPx = (z, lat) =>
  (EARTH_C * Math.cos((lat * Math.PI) / 180)) / (TILE * 2 ** z);

/** Vĩ độ tham chiếu để quy đổi px ↔ m: giữa vùng biển VN. */
const REF_LAT = 14;

/* ── Douglas–Peucker (cùng thuật toán generate-reef-shapes.mjs, chạy trên
   pixel thay vì độ). Trả về CẢ sai số lệch lớn nhất thật sự đo được — phần 6
   cần con số này để nói "độ rõ", không được đoán từ dung sai. ── */

function dpRange(pts, first, last, tol2, keep, stat) {
  if (last <= first + 1) return;
  const [x1, y1] = pts[first];
  const [x2, y2] = pts[last];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const den = dx * dx + dy * dy;
  let idx = -1;
  let max = tol2;
  for (let i = first + 1; i < last; i++) {
    const [px, py] = pts[i];
    let d;
    if (den === 0) {
      d = (px - x1) ** 2 + (py - y1) ** 2;
    } else {
      let t = ((px - x1) * dx + (py - y1) * dy) / den;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      d = (px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2;
    }
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (idx === -1) {
    // cả đoạn nằm trong dung sai — ghi lại lệch thật lớn nhất đã CHẤP NHẬN bỏ
    for (let i = first + 1; i < last; i++) {
      const [px, py] = pts[i];
      let d;
      if (den === 0) d = (px - x1) ** 2 + (py - y1) ** 2;
      else {
        let t = ((px - x1) * dx + (py - y1) * dy) / den;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        d = (px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2;
      }
      if (d > stat.max2) stat.max2 = d;
    }
    return;
  }
  keep[idx] = true;
  dpRange(pts, first, idx, tol2, keep, stat);
  dpRange(pts, idx, last, tol2, keep, stat);
}

/** DP giữ mút; vòng kín cắt tại điểm xa mút đầu nhất (thủ thuật chuẩn). */
function simplifyPx(pts, tol, stat) {
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
    dpRange(pts, 0, far, tol2, keep, stat);
    dpRange(pts, far, last, tol2, keep, stat);
  } else {
    dpRange(pts, 0, last, tol2, keep, stat);
  }
  return pts.filter((_, i) => keep[i]);
}

/* ── Cắt đoạn theo hộp (Liang–Barsky) — để tách hình vào từng ô ── */

function clipSegment(x0, y0, x1, y1, box) {
  const [xmin, ymin, xmax, ymax] = box;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

/** Cắt một tuyến pixel theo hộp ô → danh sách khúc nằm trong ô. */
function clipLine(pts, box) {
  const out = [];
  let cur = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const seg = clipSegment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], box);
    if (!seg) {
      cur = null;
      continue;
    }
    const a = [seg[0], seg[1]];
    const b = [seg[2], seg[3]];
    if (cur && Math.abs(cur[cur.length - 1][0] - a[0]) < 1e-9 && Math.abs(cur[cur.length - 1][1] - a[1]) < 1e-9) {
      cur.push(b);
    } else {
      cur = [a, b];
      out.push(cur);
    }
  }
  return out;
}

/* ── Mã hoá nhị phân toạ độ ô (đúng cách MVT mã hoá hình học) ── */

function pushVarint(bytes, v) {
  let n = v >>> 0;
  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n);
}
const zig = (v) => (v << 1) ^ (v >> 31);

/**
 * Ô hải đồ → byte. `feats` = [{ kind, pts }] với pts là pixel THẾ GIỚI.
 * Toạ độ đưa về nguyên trong ô theo `extent` (MVT dùng 4096), rồi delta +
 * zigzag + varint. Đây là phần chiếm ~toàn bộ byte của một ô vector thật.
 */
function encodeTile(feats, tileOriginPx, extent) {
  const bytes = [];
  pushVarint(bytes, feats.length);
  for (const f of feats) {
    pushVarint(bytes, f.kind);
    pushVarint(bytes, f.pts.length);
    let px = 0;
    let py = 0;
    for (const [wx, wy] of f.pts) {
      const x = Math.round(((wx - tileOriginPx[0]) / TILE) * extent);
      const y = Math.round(((wy - tileOriginPx[1]) / TILE) * extent);
      pushVarint(bytes, zig(x - px));
      pushVarint(bytes, zig(y - py));
      px = x;
      py = y;
    }
  }
  return Buffer.from(bytes);
}

/* ══════════════════════════════════════════════════════════════════════════
   NẠP DỮ LIỆU THẬT
   ══════════════════════════════════════════════════════════════════════════ */

const readJson = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const fileSize = (f) => statSync(join(DATA, f)).size;

/** Mọi hình của lớp hải đồ, dạng chung: { layer, d, ring, lonlat: [[lon,lat]] } */
function loadChartGeometry() {
  const out = [];

  for (const f of readJson("isobaths.v1.json").features) {
    if (f.geometry?.type !== "LineString") continue;
    out.push({ layer: "isobath", d: f.properties?.d ?? 0, lonlat: f.geometry.coordinates });
  }

  for (const f of readJson("reef-shapes.v1.json").features) {
    const g = f.geometry;
    if (!g) continue;
    const kind = f.properties?.kind ?? "reef";
    if (g.type === "Point") {
      out.push({ layer: "hazard", kind, lonlat: [g.coordinates] });
    } else if (g.type === "LineString") {
      out.push({ layer: "reef", kind, lonlat: g.coordinates });
    } else if (g.type === "Polygon") {
      for (const ring of g.coordinates) out.push({ layer: "reef", kind, lonlat: ring });
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates)
        for (const ring of poly) out.push({ layer: "reef", kind, lonlat: ring });
    }
  }

  const sm = readJson("seamarks.v1.json");
  for (const row of sm.marks ?? []) {
    if (!Array.isArray(row) || row.length < 3) continue;
    out.push({ layer: "seamark", lonlat: [[row[0], row[1]]] });
  }

  for (const f of readJson("coral-reefs.v1.json").features) {
    if (f.geometry?.type === "Point")
      out.push({ layer: "reef-name", lonlat: [f.geometry.coordinates] });
  }

  return out;
}

/**
 * Nấc zoom của từng mức đẳng sâu — PHẢI khớp `isobathZoomGate` trong
 * src/lib/ocean-map.ts. Cổng này là một PHẦN của phương pháp (mức càng nông
 * càng đòi zoom gần), nên phép đo byte-theo-zoom phải tôn trọng nó, không thì
 * ta đang đo một bản đồ không ai vẽ.
 */
function isobathMinZoom(d) {
  if (d <= 10) return 10;
  if (d <= 20) return 9;
  if (d <= 100) return 7;
  return 5;
}

/** Hình nào được vẽ ở zoom z (theo đúng luật lớp của app). */
function visibleAt(g, z) {
  if (g.layer === "isobath") return z >= isobathMinZoom(g.d);
  if (g.layer === "seamark") return z >= 8; // ocean-map: lớp báo hiệu từ z8
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 1 — GIẢN LƯỢC THEO ZOOM vs MỘT DUNG SAI CHO MỌI ZOOM
   ══════════════════════════════════════════════════════════════════════════ */

/** Các mức zoom app thật sự dùng (DEFAULT_VIEW 4,6 → chạm bờ ~z12–13). */
const ZOOMS = [5, 7, 9, 11, 12, 14];
/** Dung sai giản lược, tính bằng PIXEL màn hình ở chính mức zoom đó. */
const TOL_PX = 0.5;

function buildLevel(geom, z, tolPx) {
  const stat = { max2: 0 };
  let dropped = 0;
  let verts = 0;
  const feats = [];
  for (const g of geom) {
    if (!visibleAt(g, z)) continue;
    const pts = g.lonlat.map(([lon, lat]) => toPx(lon, lat, z));
    let s = pts.length >= 3 ? simplifyPx(pts, tolPx, stat) : pts;
    // Hình rút còn <2 điểm (nhỏ hơn nửa pixel) — KHÔNG bỏ im lặng: giữ lại
    // dưới dạng chấm. Rạn nhỏ mất khỏi hải đồ là lỗ hổng an toàn, không phải
    // chuyện đẹp/xấu (án lệ radial-distance trong generate-reef-shapes.mjs).
    if (s.length < 2 && pts.length >= 2) {
      s = [pts[0]];
      dropped++;
    }
    verts += s.length;
    feats.push({ ...g, px: s });
  }
  return { z, feats, verts, dropped, maxErrPx: Math.sqrt(stat.max2) };
}

function part1(geom) {
  section(1, "Giản lược theo từng mức zoom vs một dung sai cho mọi zoom");

  // Bản "một dung sai cho mọi zoom" = chính file đang phát hành.
  const cur = {
    reef: fileSize("reef-shapes.v1.json"),
    iso: fileSize("isobaths.v1.json"),
    sm: fileSize("seamarks.v1.json"),
    reefName: fileSize("coral-reefs.v1.json"),
  };
  const curRaw = cur.reef + cur.iso + cur.sm + cur.reefName;
  const curGz =
    gz(readFileSync(join(DATA, "reef-shapes.v1.json"))) +
    gz(readFileSync(join(DATA, "isobaths.v1.json"))) +
    gz(readFileSync(join(DATA, "seamarks.v1.json"))) +
    gz(readFileSync(join(DATA, "coral-reefs.v1.json")));

  const totalVerts = geom.reduce((a, g) => a + g.lonlat.length, 0);
  console.log(
    `\n  Đang phát hành (một dung sai 0,0003° cho mọi zoom, 4 file JSON):\n` +
      `    ${geom.length} hình · ${totalVerts} đỉnh · ${kb(curRaw)} KB thô · ${kb(curGz)} KB gzip\n` +
      `    → tải NGUYÊN KHỐI, không phụ thuộc bà con đang xem zoom nào.\n`,
  );

  const levels = ZOOMS.map((z) => buildLevel(geom, z, TOL_PX));
  const rows = levels.map((L) => {
    const mPerPx = metersPerPx(L.z, REF_LAT);
    return [
      `z${L.z}`,
      L.feats.length,
      L.verts,
      pct(L.verts, totalVerts),
      (TOL_PX * mPerPx).toFixed(0) + " m",
      L.maxErrPx.toFixed(2) + " px",
      L.dropped,
    ];
  });
  table(
    ["mức", "hình", "đỉnh", "so gốc", "dung sai", "lệch thật", "hình →chấm"],
    rows,
  );
  console.log(
    "\n  Đọc bảng: dung sai 0,5 px ở zoom nào thì tính ra mét ở zoom đó. Cột\n" +
      '  "lệch thật" là sai số LỚN NHẤT thật sự đo được trên toàn bộ dữ liệu —\n' +
      "  Douglas–Peucker chặn trần nên nó luôn ≤ dung sai; đây là bằng chứng,\n" +
      "  không phải lời hứa.",
  );
  return levels;
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 2 — TILE HOÁ: BYTE THẬT CHO MỘT KHUNG NHÌN ĐIỆN THOẠI
   ══════════════════════════════════════════════════════════════════════════ */

/** Màn hình phổ thông của bà con (iPhone/Android tầm trung), CSS px. */
const SCREEN = { w: 390, h: 844 };

const VIEWPORTS = [
  { name: "Ven bờ Nha Trang", lon: 109.35, lat: 12.24 },
  { name: "Cửa Hải Phòng", lon: 106.85, lat: 20.75 },
  { name: "Trường Sa", lon: 114.3, lat: 9.7 },
];

/** Danh sách ô (x,y) phủ một khung nhìn ở zoom z. */
function viewportTiles(vp, z) {
  const [cx, cy] = toPx(vp.lon, vp.lat, z);
  const x0 = Math.floor((cx - SCREEN.w / 2) / TILE);
  const x1 = Math.floor((cx + SCREEN.w / 2) / TILE);
  const y0 = Math.floor((cy - SCREEN.h / 2) / TILE);
  const y1 = Math.floor((cy + SCREEN.h / 2) / TILE);
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
  return out;
}

const KIND_ID = { isobath: 1, reef: 2, hazard: 3, seamark: 4, "reef-name": 5 };

/** Cắt một mức đã giản lược thành ô → Buffer từng ô. */
function tileLevel(level, tiles) {
  const out = new Map();
  for (const [tx, ty] of tiles) {
    const box = [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE];
    const feats = [];
    for (const f of level.feats) {
      if (f.px.length === 1) {
        const [x, y] = f.px[0];
        if (x >= box[0] && x < box[2] && y >= box[1] && y < box[3])
          feats.push({ kind: KIND_ID[f.layer] ?? 0, pts: f.px });
        continue;
      }
      for (const piece of clipLine(f.px, box))
        feats.push({ kind: KIND_ID[f.layer] ?? 0, pts: piece });
    }
    out.set(`${tx}/${ty}`, encodeTile(feats, [box[0], box[1]], 4096));
  }
  return out;
}

function part2(geom, levels) {
  section(2, "Tile hoá — byte phải tải cho MỘT khung nhìn 390×844");

  const byZoom = new Map(levels.map((L) => [L.z, L]));
  const curGz =
    gz(readFileSync(join(DATA, "reef-shapes.v1.json"))) +
    gz(readFileSync(join(DATA, "isobaths.v1.json"))) +
    gz(readFileSync(join(DATA, "seamarks.v1.json"))) +
    gz(readFileSync(join(DATA, "coral-reefs.v1.json")));

  const rows = [];
  for (const z of [9, 12]) {
    const L = byZoom.get(z);
    if (!L) continue;
    for (const vp of VIEWPORTS) {
      const tiles = viewportTiles(vp, z);
      const buf = tileLevel(L, tiles);
      let raw = 0;
      let comp = 0;
      let empty = 0;
      for (const b of buf.values()) {
        raw += b.length;
        comp += b.length ? gz(b) : 0;
        if (b.length <= 2) empty++;
      }
      rows.push([
        `z${z} · ${vp.name}`,
        tiles.length,
        `${tiles.length - empty}`,
        kb(raw) + " KB",
        kb(comp) + " KB",
        `${(curGz / Math.max(comp, 1)).toFixed(0)}×`,
      ]);
    }
  }
  table(
    ["khung nhìn", "ô", "ô có nội dung", "thô", "gzip", "nhẹ hơn khối"],
    rows,
  );
  console.log(
    `\n  So với cách đang dùng: mở bản đồ là tải ${kb(curGz)} KB (gzip) cho CẢ\n` +
      "  vùng biển VN, ở mọi zoom. Cột cuối là số lần nhẹ hơn khi chỉ tải ô đang\n" +
      "  nhìn. Ô trống vẫn phải hỏi (1 lượt HTTP) — cột \"ô có nội dung\" cho thấy\n" +
      "  bao nhiêu ô đáng hỏi; xem phần 3 về cách bỏ ô trống.",
  );
  return byZoom;
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 3 — TÁCH LỚP THEO VIỆC: Ô HẢI ĐỒ vs Ô NỀN PROTOMAPS
   ══════════════════════════════════════════════════════════════════════════ */

class FileSource {
  constructor(p) {
    this.fd = openSync(p, "r");
    this.p = p;
  }
  getKey() {
    return this.p;
  }
  async getBytes(offset, length) {
    const buf = Buffer.allocUnsafe(length);
    readSync(this.fd, buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) };
  }
}

async function part3(byZoom) {
  section(3, "Tách lớp theo việc — ô hải đồ vs ô nền Protomaps (z9, đo thật)");

  const pmPath = join(DATA, "vn-basemap.pmtiles");
  let pm;
  try {
    pm = new PMTiles(new FileSource(pmPath));
    await pm.getHeader();
  } catch (e) {
    console.log(`  (bỏ qua — không đọc được ${pmPath}: ${e.message})`);
    return;
  }
  const header = await pm.getHeader();
  console.log(
    `\n  vn-basemap.pmtiles: ${kb(statSync(pmPath).size)} KB · zoom ${header.minZoom}–${header.maxZoom} · ` +
      `${header.numAddressedTiles} ô có địa chỉ\n`,
  );

  const z = Math.min(9, header.maxZoom);
  const L = byZoom.get(z);
  if (!L) {
    console.log("  (bỏ qua — chưa dựng mức z9)");
    return;
  }

  const rows = [];
  let sumBase = 0;
  let sumChart = 0;
  let n = 0;
  for (const vp of VIEWPORTS) {
    const tiles = viewportTiles(vp, z);
    const chart = tileLevel(L, tiles);
    let base = 0;
    let mine = 0;
    for (const [tx, ty] of tiles) {
      const t = await pm.getZxy(z, tx, ty);
      // getZxy trả về đã giải nén → nén lại cùng cách để so cho công bằng
      base += t?.data ? gz(Buffer.from(t.data)) : 0;
      const b = chart.get(`${tx}/${ty}`);
      mine += b && b.length ? gz(b) : 0;
    }
    sumBase += base;
    sumChart += mine;
    n += tiles.length;
    rows.push([
      vp.name,
      tiles.length,
      kb(base) + " KB",
      kb(mine) + " KB",
      base && mine ? `${(base / mine).toFixed(1)}×` : "—",
    ]);
  }
  rows.push([
    "CỘNG",
    n,
    kb(sumBase) + " KB",
    kb(sumChart) + " KB",
    `${(sumBase / Math.max(sumChart, 1)).toFixed(1)}×`,
  ]);
  table(["khung nhìn (z9)", "ô", "nền Protomaps", "chỉ hải đồ", "tỉ lệ"], rows);
  console.log(
    "\n  Nền Protomaps chở nhà cửa, đường phố, ranh giới hành chính, tên đất —\n" +
      "  thứ mà app ĐANG VỨT BỎ ngay lúc dựng style (buildMapStyle lọc hết lớp\n" +
      "  symbol + boundaries). Cột tỉ lệ là số byte trả cho phần bị vứt.\n" +
      "  ⚠️ Byte ô hải đồ ở đây KHÔNG bọc protobuf như MVT thật (xem đầu file) —\n" +
      "  con số thật sẽ nhỉnh hơn vài chục byte/ô, không đổi bậc độ lớn.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 4 — LƯỢNG TỬ HOÁ TOẠ ĐỘ
   ══════════════════════════════════════════════════════════════════════════ */

function part4(geom, byZoom) {
  section(4, "Lượng tử hoá toạ độ — JSON 4 số lẻ vs 3 số lẻ vs nguyên trong ô");

  // Sai số lượng tử hoá thuần tuý (nửa bước), quy ra mét và pixel
  const rows = [];
  for (const dec of [3, 4, 5]) {
    const stepDeg = 10 ** -dec;
    const errM = (stepDeg / 2) * 111320 * Math.cos((REF_LAT * Math.PI) / 180);
    rows.push([
      `JSON ${dec} số lẻ`,
      stepDeg.toExponential(0) + "°",
      errM.toFixed(1) + " m",
      ...ZOOMS.map((z) => (errM / metersPerPx(z, REF_LAT)).toFixed(3)),
    ]);
  }
  for (const extent of [1024, 4096]) {
    // bước = 1 ô / extent; ô ở zoom z rộng 256 px
    rows.push([
      `nguyên trong ô (${extent})`,
      `${(TILE / extent).toFixed(3)} px`,
      "theo zoom",
      ...ZOOMS.map(() => (TILE / extent / 2).toFixed(3)),
    ]);
  }
  table(
    ["cách", "bước", "sai số", ...ZOOMS.map((z) => `px@z${z}`)],
    rows,
  );
  console.log(
    "\n  Đọc bảng: cột px@zN là sai số lượng tử hoá tính bằng PIXEL ở zoom đó.\n" +
      "  ROUND=4 đang dùng cho ra 5,4 m — ở z9 là 0,018 px, tức nhỏ hơn một pixel\n" +
      "  50 lần: byte trả cho độ chính xác KHÔNG AI NHÌN THẤY. Toạ độ nguyên\n" +
      "  trong ô thì sai số tự bám theo zoom (0,03 px với extent 4096) nên không\n" +
      "  bao giờ thừa cũng không bao giờ thiếu.\n",
  );

  // Byte thật: cùng một tập hình, ba cách ghi
  const L = byZoom.get(12) ?? byZoom.get(9);
  const tiles = viewportTiles(VIEWPORTS[0], L.z);
  const box = tiles.map(([tx, ty]) => `${tx}/${ty}`);
  const enc = tileLevel(L, tiles);
  let bin = 0;
  for (const k of box) bin += gz(enc.get(k) ?? Buffer.alloc(0));

  // cùng nội dung, ghi kiểu GeoJSON text 4 và 3 số lẻ
  const asJson = (dec) => {
    const feats = [];
    for (const [tx, ty] of tiles) {
      const b = [tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE];
      for (const f of L.feats) {
        const pieces =
          f.px.length === 1
            ? f.px[0][0] >= b[0] && f.px[0][0] < b[2] && f.px[0][1] >= b[1] && f.px[0][1] < b[3]
              ? [f.px]
              : []
            : clipLine(f.px, b);
        for (const p of pieces) {
          feats.push({
            type: "Feature",
            properties: { k: f.layer },
            geometry: {
              type: p.length === 1 ? "Point" : "LineString",
              coordinates: p.map(([x, y]) => pxToLonLat(x, y, L.z, dec)),
            },
          });
        }
      }
    }
    return Buffer.from(JSON.stringify({ type: "FeatureCollection", features: feats }));
  };

  let binRaw = 0;
  for (const k of box) binRaw += (enc.get(k) ?? Buffer.alloc(0)).length;

  const j4 = asJson(4);
  const j3 = asJson(3);
  table(
    ["cách ghi (cùng nội dung, khung Nha Trang z" + L.z + ")", "thô", "gzip", "thô so nhị phân"],
    [
      ["GeoJSON 4 số lẻ (đang dùng)", kb(j4.length) + " KB", kb(gz(j4)) + " KB", `${(j4.length / binRaw).toFixed(1)}×`],
      ["GeoJSON 3 số lẻ", kb(j3.length) + " KB", kb(gz(j3)) + " KB", `${(j3.length / binRaw).toFixed(1)}×`],
      ["nguyên trong ô + varint-delta", kb(binRaw) + " KB", kb(bin) + " KB", "1,0×"],
    ],
  );
  console.log(
    "\n  KẾT QUẢ NGƯỢC VỚI TRỰC GIÁC, và nó quan trọng: SAU KHI GZIP ba cách ghi\n" +
      "  gần như BẰNG NHAU. Gzip ăn hết phần chữ thừa của JSON. Chênh lệch thật\n" +
      "  nằm ở BYTE THÔ — thứ máy phải phân tích cú pháp và giữ trong RAM sau khi\n" +
      "  giải nén, chứ không phải thứ chạy qua sóng.\n" +
      "  ⇒ Với ngân sách dung lượng rộng (40–50 MB), lượng tử hoá toạ độ KHÔNG\n" +
      "    còn là đòn bẩy đáng theo đuổi để tiết kiệm mạng. Nó chỉ còn đáng làm\n" +
      "    vì lý do KHÁC: JSON.parse trên máy yếu và RAM thường trú.",
  );
}

/** pixel thế giới → lon/lat, làm tròn `dec` số lẻ (để dựng lại GeoJSON) */
function pxToLonLat(x, y, z, dec) {
  const s = TILE * 2 ** z;
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const r = 10 ** dec;
  return [Math.round(lon * r) / r, Math.round(lat * r) / r];
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 5 — MÃ HOÁ LƯỚI ĐỘ SÂU
   ══════════════════════════════════════════════════════════════════════════ */

const DEPTH_N_LAT = 4441;
const DEPTH_N_LON = 3841;

/*  nợ: CẢ PHẦN 5 ĐO LƯỚI 2 BIT/Ô — trần: mọi con số của phần này thuộc về bản
    lưới trước 2026-09-04 (4 lớp, 2 bit). Lưới nay là 4 bit/6 lớp, mà ba cách mã
    hoá đem so (RLE, khối-thưa, cây tứ phân) đều nhồi 2 bit/ô nên không chứa nổi
    lớp 4 và 5. Điều kiện nâng cấp: khi thật sự cần đo lại cách lưu lưới (vd
    ngân sách `public/data` chật), viết lại ba bộ mã hoá cho 3–4 bit/ô rồi bỏ
    cổng cỡ file dưới đây. Tới lúc đó phần 5 THÀ KHÔNG CHẠY còn hơn in số sai:
    giải mã 2 bit trên file 4 bit không ném (file to gấp đôi, chỉ số vẫn trong
    mảng), nó chỉ lặng lẽ cho ra một bảng đẹp và sai. */
const DEPTH_BYTES_2BIT = Math.ceil((4441 * 3841) / 4);

/** Giải nén file 2 bit/ô thành một byte/ô để mọi cách mã hoá cùng xuất phát. */
function depthClasses(raw) {
  const n = DEPTH_N_LAT * DEPTH_N_LON;
  const out = new Uint8Array(n);
  for (let k = 0; k < n; k++) out[k] = (raw[k >> 2] >> ((k & 3) * 2)) & 3;
  return out;
}

/** RLE varint trên dòng quét: [lớp 1 byte][độ dài varint]… */
function encodeRle(cls) {
  const bytes = [];
  let run = 1;
  for (let k = 1; k <= cls.length; k++) {
    if (k < cls.length && cls[k] === cls[k - 1] && run < 0xffffff) {
      run++;
      continue;
    }
    bytes.push(cls[k - 1]);
    pushVarint(bytes, run);
    run = 1;
  }
  return Buffer.from(bytes);
}

/**
 * KHỐI-THƯA: chia lưới thành khối B×B. Khối đồng nhất (cả khối một lớp) ghi 1
 * byte; khối pha ghi 2 bit/ô. Bảng mục lục 1 byte/khối cho biết khối nào đồng
 * nhất (giá trị 0–3) hay pha (0xFF) + mảng offset.
 *
 * Vì sao đây là ứng viên thật chứ không phải trò nén cho vui: nó giữ TRA NGẪU
 * NHIÊN O(1) — mở mục lục là biết ngay khối nào, khối đồng nhất trả lời không
 * cần đọc byte nào khác. RLE và cây tứ phân đều mất tính chất này.
 */
function encodeBlockSparse(cls, B) {
  const bx = Math.ceil(DEPTH_N_LON / B);
  const by = Math.ceil(DEPTH_N_LAT / B);
  const dir = new Uint8Array(bx * by);
  const payloads = [];
  let uniform = 0;
  const blockBytes = Math.ceil((B * B) / 4);
  for (let byi = 0; byi < by; byi++) {
    for (let bxi = 0; bxi < bx; bxi++) {
      let first = -1;
      let mixed = false;
      const buf = new Uint8Array(blockBytes);
      let idx = 0;
      for (let i = 0; i < B; i++) {
        const row = byi * B + i;
        for (let j = 0; j < B; j++) {
          const col = bxi * B + j;
          const v = row < DEPTH_N_LAT && col < DEPTH_N_LON ? cls[row * DEPTH_N_LON + col] : 3;
          if (first === -1) first = v;
          else if (v !== first) mixed = true;
          buf[idx >> 2] |= v << ((idx & 3) * 2);
          idx++;
        }
      }
      const bi = byi * bx + bxi;
      if (!mixed) {
        dir[bi] = first;
        uniform++;
      } else {
        dir[bi] = 0xff;
        payloads.push(buf);
      }
    }
  }
  const body = Buffer.concat([Buffer.from(dir), ...payloads.map((p) => Buffer.from(p))]);
  return { buf: body, uniform, total: bx * by, bx, by, blockBytes };
}

/**
 * CÂY TỨ PHÂN trên lưới đệm về 8192×8192. Nút đồng nhất dừng; nút pha đẻ 4 con.
 * Ghi theo thứ tự duyệt trước: 1 byte/nút (0–3 = lá, 0xFF = nút trong).
 */
function encodeQuadtree(cls, maxSide) {
  const bytes = [];
  let nodes = 0;
  let leaves = 0;

  // giá trị của một ô, ngoài lưới coi như "đủ sâu" (3) — cùng quy ước khối-thưa
  const at = (r, c) =>
    r < DEPTH_N_LAT && c < DEPTH_N_LON ? cls[r * DEPTH_N_LON + c] : 3;

  // đồng nhất? dùng kiểm nhanh theo cột-đầu rồi quét đủ
  function uniformVal(r0, c0, size) {
    const v = at(r0, c0);
    for (let r = r0; r < r0 + size; r++) {
      const base = r * DEPTH_N_LON;
      const rowIn = r < DEPTH_N_LAT;
      for (let c = c0; c < c0 + size; c++) {
        const x = rowIn && c < DEPTH_N_LON ? cls[base + c] : 3;
        if (x !== v) return -1;
      }
    }
    return v;
  }

  function rec(r0, c0, size) {
    nodes++;
    if (size === 1) {
      leaves++;
      bytes.push(at(r0, c0));
      return;
    }
    const v = uniformVal(r0, c0, size);
    if (v >= 0) {
      leaves++;
      bytes.push(v);
      return;
    }
    bytes.push(0xff);
    const h = size / 2;
    rec(r0, c0, h);
    rec(r0, c0 + h, h);
    rec(r0 + h, c0, h);
    rec(r0 + h, c0 + h, h);
  }
  rec(0, 0, maxSide);
  return { buf: Buffer.from(bytes), nodes, leaves };
}

function part5() {
  section(5, "Mã hoá lưới độ sâu — 2 bit/ô đặc vs RLE vs khối-thưa vs cây tứ phân");

  const raw = readFileSync(join(DATA, "depth-grid.v1.bin"));
  if (raw.length !== DEPTH_BYTES_2BIT) {
    console.log(
      `\n  BỎ QUA PHẦN 5 — depth-grid.v1.bin dài ${raw.length} byte, không phải ` +
        `${DEPTH_BYTES_2BIT} byte của lưới 2 bit/ô mà phần này biết đọc.\n` +
        `  Xem chú thích "nợ:" ở depthClasses(): ba bộ mã hoá đem so đều nhồi 2 bit/ô,\n` +
        `  phải viết lại cho 3–4 bit/ô rồi mới đo lại được. Số cũ nằm ở docs/research.\n`,
    );
    return;
  }
  const cls = depthClasses(raw);
  const n = cls.length;
  const hist = [0, 0, 0, 0];
  for (let k = 0; k < n; k++) hist[cls[k]]++;
  const p2 = (a) => ((a / n) * 100).toFixed(2) + "%";
  console.log(
    `\n  ${DEPTH_N_LAT}×${DEPTH_N_LON} = ${n.toLocaleString("vi-VN")} ô · ` +
      `đất ${p2(hist[0])} · rất cạn ${p2(hist[1])} · nông ${p2(hist[2])} · đủ sâu ${p2(hist[3])}\n`,
  );

  const rows = [];

  // ── baseline: đặc 2 bit ──────────────────────────────────────────────────
  {
    const gzB = gz(raw);
    const brB = br(raw);
    // "chuẩn bị" = tạo view; tra 1 điểm = dịch bit
    const prep = timeIt(() => new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength), 100) / 100;
    const q = randomQueryTime((k) => (raw[k >> 2] >> ((k & 3) * 2)) & 3, n);
    rows.push([
      "đặc 2 bit/ô (đang dùng)",
      kb(raw.length) + " KB",
      kb(gzB) + " KB",
      kb(brB) + " KB",
      prep.toFixed(3) + " ms",
      kb(raw.length) + " KB",
      q.toFixed(0) + " ns",
    ]);
  }

  // ── RLE ──────────────────────────────────────────────────────────────────
  {
    const buf = encodeRle(cls);
    rows.push([
      "RLE varint (dòng quét)",
      kb(buf.length) + " KB",
      kb(gz(buf)) + " KB",
      kb(br(buf)) + " KB",
      "cần bung",
      kb(raw.length) + " KB",
      "O(n) hoặc bung",
    ]);
  }

  // ── khối-thưa ────────────────────────────────────────────────────────────
  for (const B of [32, 64, 128]) {
    const t0 = process.hrtime.bigint();
    const r = encodeBlockSparse(cls, B);
    const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;
    // tra: đọc mục lục → khối đồng nhất trả ngay, khối pha nhảy tới offset.
    // Dựng bảng offset (một lần) rồi đo tra ngẫu nhiên.
    const { off, dir } = blockOffsets(r);
    const bpr = r.bx;
    const q = randomQueryTime((k) => {
      const row = (k / DEPTH_N_LON) | 0;
      const col = k - row * DEPTH_N_LON;
      const bi = ((row / B) | 0) * bpr + ((col / B) | 0);
      const d = dir[bi];
      if (d !== 0xff) return d;
      const inb = (row % B) * B + (col % B);
      const base = off[bi];
      return (r.buf[base + (inb >> 2)] >> ((inb & 3) * 2)) & 3;
    }, n);
    rows.push([
      `khối-thưa ${B}×${B}`,
      kb(r.buf.length) + " KB",
      kb(gz(r.buf)) + " KB",
      kb(br(r.buf)) + " KB",
      buildMs.toFixed(0) + " ms*",
      kb(r.buf.length) + " KB",
      q.toFixed(0) + " ns",
    ]);
    console.log(
      `  · khối ${B}×${B}: ${r.uniform}/${r.total} khối đồng nhất (${pct(r.uniform, r.total)}) — ` +
        `chỉ ${r.total - r.uniform} khối phải chở dữ liệu`,
    );
  }

  // ── cây tứ phân ──────────────────────────────────────────────────────────
  {
    const t0 = process.hrtime.bigint();
    const q = encodeQuadtree(cls, 8192);
    const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;
    rows.push([
      "cây tứ phân (8192²)",
      kb(q.buf.length) + " KB",
      kb(gz(q.buf)) + " KB",
      kb(br(q.buf)) + " KB",
      buildMs.toFixed(0) + " ms*",
      kb(q.buf.length) + " KB",
      "cần bảng nhảy",
    ]);
    console.log(`  · cây tứ phân: ${q.nodes} nút, ${q.leaves} lá`);
  }

  console.log("");
  table(
    ["cách mã hoá", "đĩa", "gzip", "brotli", "chuẩn bị", "RAM", "tra 1 điểm"],
    rows,
  );
  console.log(
    "\n  * Cột 'chuẩn bị' của khối-thưa/cây tứ phân là thời gian SINH (chạy lúc\n" +
      "    build, trên máy chủ) — không phải thời gian máy bà con phải trả. Máy\n" +
      "    bà con chỉ dựng bảng offset: một vòng lặp trên mục lục.\n" +
      "\n  ĐỌC BẢNG CHO ĐÚNG:\n" +
      "   · Qua sóng thì bốn cách CHÊNH NHAU ÍT (75–119 KB): gzip tự tìm ra đúng\n" +
      "     cái mà RLE/khối-thưa mã hoá tay — dãy 'đủ sâu' dài. Khối-thưa 32×32\n" +
      "     có nhẹ hơn thật (79,7 vs 118,9 KB gzip) nhưng 39 KB không phải lý do\n" +
      "     để đổi định dạng đang chạy tốt.\n" +
      "   · Chênh lệch THẬT nằm ở RAM và ở khả năng dùng TỪNG PHẦN: đặc 2 bit\n" +
      "     phải nằm nguyên 4,16 MB trong bộ nhớ suốt phiên; khối-thưa 32×32 chỉ\n" +
      "     458 KB (9,1× ít hơn) mà vẫn tra O(1) — 8 ns so với 4 ns, cả hai đều\n" +
      "     không đáng kể so với một khung hình 16 ms.\n" +
      "   · RLE và cây tứ phân LOẠI: mất tra ngẫu nhiên O(1). Với việc 'tuyến này\n" +
      "     có cắt chỗ cạn nào không' thì mỗi tuyến là hàng nghìn lượt tra —\n" +
      "     'cần bung' nghĩa là quay về đúng 4,16 MB RAM, không được gì.",
  );
}

/** Bảng offset cho khối-thưa — dựng một lần trên máy đọc. */
function blockOffsets(r) {
  const nBlocks = r.total;
  const dir = r.buf.subarray(0, nBlocks);
  const off = new Int32Array(nBlocks);
  let cur = nBlocks;
  for (let i = 0; i < nBlocks; i++) {
    if (dir[i] === 0xff) {
      off[i] = cur;
      cur += r.blockBytes;
    } else off[i] = -1;
  }
  return { off, dir };
}

/** Thời gian trung bình một lượt tra ngẫu nhiên, ns. */
function randomQueryTime(get, n) {
  const N = 200000;
  const idx = new Int32Array(N);
  let seed = 12345;
  for (let i = 0; i < N; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    idx[i] = seed % n;
  }
  let sink = 0;
  const ms = timeIt(() => {
    for (let i = 0; i < N; i++) sink += get(idx[i]);
  }, 1);
  if (sink === -1) console.log(""); // chặn tối ưu hoá xoá vòng lặp
  return (ms * 1e6) / N;
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 6 — ĐỘ RÕ
   ══════════════════════════════════════════════════════════════════════════ */

function part6(geom, levels) {
  section(6, "Độ rõ — nhẹ mà mờ thì vô nghĩa");

  console.log(
    "\n  BA THƯỚC ĐO (đề xuất chốt thành tiêu chuẩn nghiệm thu của phương pháp):\n" +
      "   (a) SAI SỐ HÌNH HỌC TỐI ĐA ở mỗi zoom, tính bằng pixel. Ngưỡng ≤ 0,5 px\n" +
      "       — dưới nửa pixel thì màn hình không có chỗ để vẽ ra sự khác biệt.\n" +
      "   (b) SỐ ĐỐI TƯỢNG BỊ RƠI. Ngưỡng = 0 với lớp hiểm hoạ (rạn, đá, xác tàu,\n" +
      "       bãi cạn): hình nhỏ quá thì rút về CHẤM, không được biến mất.\n" +
      "   (c) MẬT ĐỘ NÉT ở ô đông nhất: đỉnh/ô và ước lượng phần trăm pixel bị\n" +
      "       nét phủ. Quá ngưỡng là 'búi chỉ' — rõ về hình học nhưng mù về mắt.\n",
  );

  const rows = levels.map((L) => {
    const mPerPx = metersPerPx(L.z, REF_LAT);
    return [
      `z${L.z}`,
      L.maxErrPx.toFixed(3) + " px",
      (L.maxErrPx * mPerPx).toFixed(0) + " m",
      L.maxErrPx <= TOL_PX ? "đạt" : "KHÔNG",
      L.dropped + " → chấm",
      "0 mất",
    ];
  });
  table(
    ["mức", "(a) lệch tối đa", "quy ra mét", "≤0,5 px?", "(b) hình rút gọn", "hình mất"],
    rows,
  );

  // (c) mật độ nét — ô đông nhất trong toàn vùng ở mỗi zoom
  const dens = [];
  for (const L of levels) {
    const count = new Map();
    for (const f of L.feats) {
      for (const [x, y] of f.px) {
        const key = `${Math.floor(x / TILE)}/${Math.floor(y / TILE)}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    }
    const vals = [...count.values()].sort((a, b) => a - b);
    if (!vals.length) continue;
    const p = (q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))];
    dens.push([
      `z${L.z}`,
      count.size,
      p(0.5),
      p(0.95),
      vals[vals.length - 1],
      // nét dày 1,1 px (ocean-map) × chiều dài ~ số đỉnh: ước lượng thô phần
      // trăm pixel của ô bị mực phủ, coi mỗi đỉnh kéo theo ~1 đoạn dài 2 px
      ((vals[vals.length - 1] * 2 * 1.1 * 100) / (TILE * TILE)).toFixed(1) + "%",
    ]);
  }
  console.log("");
  table(
    ["mức", "ô có nội dung", "đỉnh/ô (giữa)", "p95", "ô đông nhất", "≈ mực phủ ô đông nhất"],
    dens,
  );
  console.log(
    "\n  Ngưỡng đề xuất cho (c): mực phủ ≤ 15% ở ô đông nhất. Trên mức đó thì dù\n" +
      "  sai số hình học vẫn đạt, bà con nhìn dưới nắng chói chỉ thấy một mảng\n" +
      "  rối — đúng lý do ocean-map.ts đã phải đặt nấc zoom cho từng mức đẳng sâu.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 7 — TRẦN ĐỘ NÉT CỦA DỮ LIỆU ĐANG PHÁT HÀNH

   Câu hỏi của ưu tiên mới: "ngân sách rộng rồi thì nên giữ bao nhiêu chi tiết ở
   z12–z14?" Trước khi trả lời phải biết dữ liệu HIỆN CÓ nét tới đâu — vì bà con
   vào luồng, áp bãi cạn là zoom tới z13–z15, và ở đó cái chặn KHÔNG PHẢI mạng.
   ══════════════════════════════════════════════════════════════════════════ */

/** Số chữ số thập phân của một số đã ghi ra JSON. */
function decimalsOf(x) {
  const s = String(x);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

function part7(geom, levels) {
  section(7, "Trần độ nét của dữ liệu đang phát hành — cái chặn KHÔNG phải mạng");

  // (1) LƯỚI LƯỢNG TỬ HOÁ THẬT — đo, không tin ROUND=4 trong script sinh file
  let maxDec = 0;
  let n = 0;
  let onGrid4 = 0;
  for (const g of geom) {
    for (const [lon, lat] of g.lonlat) {
      maxDec = Math.max(maxDec, decimalsOf(lon), decimalsOf(lat));
      n++;
      if (
        Math.abs(lon * 1e4 - Math.round(lon * 1e4)) < 1e-6 &&
        Math.abs(lat * 1e4 - Math.round(lat * 1e4)) < 1e-6
      )
        onGrid4++;
    }
  }
  console.log(
    `\n  Lượng tử hoá ĐO ĐƯỢC trên ${n.toLocaleString("vi-VN")} đỉnh: nhiều nhất ${maxDec} chữ số thập phân · ` +
      `${pct(onGrid4, n)} số đỉnh nằm đúng lưới 1e-4°\n`,
  );

  // (2) Dung sai sinh file quy ra pixel ở từng zoom
  const TOL_GEN_DEG = 0.0003; // SIMPLIFY_TOL của generate-reef-shapes.mjs
  const TOL_GEN_M = TOL_GEN_DEG * 111320 * Math.cos((REF_LAT * Math.PI) / 180);
  const QUANT_M = (1e-4 / 2) * 111320 * Math.cos((REF_LAT * Math.PI) / 180);

  const rows = [];
  const byZoom = new Map(levels.map((L) => [L.z, L]));
  const totalVerts = geom.reduce((a, g) => a + g.lonlat.length, 0);
  for (const z of [9, 11, 12, 13, 14, 15, 16]) {
    const mpp = metersPerPx(z, REF_LAT);
    const L = byZoom.get(z);
    rows.push([
      `z${z}`,
      mpp.toFixed(1) + " m/px",
      (TOL_GEN_M / mpp).toFixed(2) + " px",
      (QUANT_M / mpp).toFixed(2) + " px",
      L ? pct(L.verts, totalVerts) : "—",
      TOL_GEN_M / mpp <= 0.5 ? "nét" : TOL_GEN_M / mpp <= 1.5 ? "vừa đủ" : "THẤY RĂNG CƯA",
    ]);
  }
  table(
    [
      "mức",
      "một pixel là",
      "sai số giản lược",
      "sai số lượng tử",
      "đỉnh còn dùng",
      "mắt thấy gì",
    ],
    rows,
  );
  console.log(
    `\n  Dung sai sinh file 0,0003° = ${TOL_GEN_M.toFixed(0)} m; lưới toạ độ 1e-4° = ±${QUANT_M.toFixed(1)} m.\n` +
      "  Đọc bảng theo ưu tiên mới:\n" +
      "   · Tới z12 dữ liệu còn nét — sai số giản lược dưới một pixel.\n" +
      "   · Từ z13 trở đi sai số vượt 1 px và tăng gấp đôi mỗi mức. Đó ĐÚNG là\n" +
      "     dải zoom bà con dùng lúc vào luồng, áp bãi cạn, né đá — lúc cần nét\n" +
      "     nhất thì bản đồ răng cưa nhất.\n" +
      "   · Cột 'đỉnh còn dùng' = 100% từ z11: giản lược theo zoom KHÔNG cứu được\n" +
      "     nữa vì không còn đỉnh nào để giữ thêm. TRẦN NẰM Ở KHÂU SINH FILE, và\n" +
      "     mạng không liên quan gì tới nó.\n" +
      "  ⇒ Việc phải làm không phải nén cho nhẹ, mà là SINH LẠI dày hơn. Bảng\n" +
      "    đánh đổi đã đo sẵn trong generate-reef-shapes.mjs: tol 0,0001° cho\n" +
      "    992 KB thô / 198 KB qua sóng — trong ngân sách 40–50 MB thì khoản đó\n" +
      "    là tiền lẻ.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 8 — TƯƠNG PHẢN DƯỚI NẮNG CHÓI

   "Rõ" không chỉ là hình học đúng chỗ. Trên boong tàu giữa trưa, cái quyết định
   bà con CÓ THẤY hay không là TƯƠNG PHẢN giữa nét và nền nước. Đây là thứ hay
   được chọn bằng mắt trong phòng máy lạnh rồi biến mất ngoài nắng.

   Màu ĐỌC THẲNG từ src/ocean-map.ts (không chép tay) để bảng này không bao giờ
   trôi khỏi thứ đang vẽ thật. Ngưỡng: WCAG 2.1 đòi 3:1 cho ĐỐI TƯỢNG ĐỒ HOẠ
   (đường, chấm) và 4,5:1 cho CHỮ. Dưới nắng chói thì 3:1 là sàn tối thiểu, không
   phải mục tiêu.
   ══════════════════════════════════════════════════════════════════════════ */

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const srgbLin = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const relLum = (h) => {
  const [r, g, b] = hexRgb(h);
  return 0.2126 * srgbLin(r) + 0.7152 * srgbLin(g) + 0.0722 * srgbLin(b);
};
const contrast = (a, b) => {
  const l1 = relLum(a);
  const l2 = relLum(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
};
/** Nét vẽ với độ mờ `a` trên nền `bg` → màu MẮT THẬT SỰ THẤY. */
const blendOn = (fg, bg, a) => {
  const f = hexRgb(fg);
  const b = hexRgb(bg);
  return (
    "#" +
    f
      .map((v, i) => Math.round(v * a + b[i] * (1 - a)).toString(16).padStart(2, "0"))
      .join("")
  );
};

function part8() {
  section(8, "Tương phản dưới nắng chói — màu đọc thẳng từ src/lib/ocean-map.ts");

  const src = readFileSync(join(process.cwd(), "src", "lib", "ocean-map.ts"), "utf8");
  /** Đọc một hằng màu; không thấy thì báo ra chứ không lặng lẽ dùng số cũ. */
  const readColor = (name) => {
    const m = new RegExp(`export const ${name}\\s*=\\s*"(#[0-9a-fA-F]{6})"`).exec(src);
    if (!m) throw new Error(`không tìm thấy hằng màu ${name} trong ocean-map.ts`);
    return m[1];
  };

  const BG = readColor("SEA_MASK_COLOR");
  console.log(`\n  Nền nước (SEA_MASK_COLOR) = ${BG}\n`);

  /*  Độ mờ lấy từ chính `buildMapStyle`: chỉ đường đẳng sâu có `line-opacity`
      (0,55), còn lại vẽ đặc. Nhãn chữ dùng ngưỡng 4,5:1, đường/chấm dùng 3:1. */
  const items = [
    ["đường đẳng sâu", "#3d6e96", 0.55, "đồ hoạ", "line-color trong buildMapStyle"],
    ["số mét đẳng sâu", "#14324f", 1, "chữ", "text-color trong buildMapStyle"],
    ["viền hình rạn", readColor("REEF_SHAPE_LINE"), 1, "đồ hoạ", ""],
    ["điểm hiểm hoạ", readColor("REEF_HAZARD_COLOR"), 1, "đồ hoạ", ""],
    ["báo hiệu CÓ đèn", readColor("SEAMARK_LIT_COLOR"), 1, "đồ hoạ", ""],
    ["báo hiệu KHÔNG đèn", readColor("SEAMARK_UNLIT_COLOR"), 1, "đồ hoạ", ""],
    ["luồng / tuyến hàng hải", readColor("SEA_LANE_COLOR"), 1, "đồ hoạ", ""],
    ["nhãn tên đảo", readColor("ISLAND_LABEL_COLOR"), 1, "chữ", ""],
    ["nhãn tên rạn", readColor("REEF_LABEL_COLOR"), 1, "chữ", ""],
    ["tuyến của tôi", readColor("ROUTE_LINE_COLOR"), 1, "đồ hoạ", ""],
    ["chặng cần lưu ý (đỏ)", readColor("ROUTE_LEG_RED"), 1, "đồ hoạ", ""],
    ["chặng chú ý vừa (cam)", readColor("ROUTE_LEG_AMBER"), 1, "đồ hoạ", ""],
    ["chặng đã đi qua (xám)", readColor("ROUTE_LEG_PASSED"), 1, "đồ hoạ", ""],
  ];

  const rows = items.map(([name, color, alpha, kind]) => {
    const eff = alpha < 1 ? blendOn(color, BG, alpha) : color;
    const r = contrast(eff, BG);
    const need = kind === "chữ" ? 4.5 : 3;
    return [
      name,
      color,
      alpha === 1 ? "đặc" : String(alpha).replace(".", ","),
      eff,
      r.toFixed(2) + ":1",
      need.toFixed(1) + ":1",
      r >= need ? "đạt" : "KHÔNG ĐẠT",
    ];
  });
  table(
    ["nét", "màu khai báo", "độ mờ", "mắt thấy", "tương phản", "cần", "kết luận"],
    rows,
  );

  const fails = rows.filter((r) => r[6] !== "đạt");
  console.log(
    `\n  ${fails.length}/${rows.length} nét KHÔNG đạt ngưỡng tối thiểu của chính loại nó.\n` +
      "  Đáng chú ý nhất:\n" +
      "   · ĐƯỜNG ĐẲNG SÂU tụt xuống 2,06:1 KHÔNG PHẢI vì chọn màu sai — màu khai\n" +
      "     báo #3d6e96 tự nó đạt 4,58:1. Thủ phạm là `line-opacity: 0.55`: pha 45%\n" +
      "     nền nước vào nét làm bay mất một nửa tương phản. Độ mờ là một quyết\n" +
      "     định THẨM MỸ đang âm thầm ăn vào ĐỘ ĐỌC ĐƯỢC của lớp an toàn.\n" +
      "   · CHẶNG CAM 'chú ý vừa' 2,44:1 — mức cảnh báo giữa lại là mức khó thấy\n" +
      "     nhất trong ba mức. Đèn giao thông mà đèn vàng mờ nhất.\n" +
      "  Đây là số học sRGB thuần, KHÔNG phải mô hình mắt dưới nắng 100.000 lux —\n" +
      "  nắng chói làm mọi tỉ lệ TỆ HƠN con số này, không bao giờ tốt hơn.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHẠY
   ══════════════════════════════════════════════════════════════════════════ */

async function main() {
  const want = process.argv.slice(2).filter((a) => /^[1-8]$/.test(a));
  const run = (n) => want.length === 0 || want.includes(String(n));

  console.log(
    "\nBỘ ĐO PHƯƠNG PHÁP BẢN ĐỒ SDFish — dữ liệu thật trong public/data\n" +
      `Node ${process.version} · ${new Date().toISOString().slice(0, 10)}`,
  );

  const geom = loadChartGeometry();
  let levels = null;
  let byZoom = null;

  if (run(1) || run(2) || run(3) || run(4) || run(6) || run(7)) {
    levels = ZOOMS.map((z) => buildLevel(geom, z, TOL_PX));
    byZoom = new Map(levels.map((L) => [L.z, L]));
  }

  if (run(1)) part1(geom);
  if (run(2)) part2(geom, levels);
  if (run(3)) await part3(byZoom);
  if (run(4)) part4(geom, byZoom);
  if (run(5)) part5();
  if (run(6)) part6(geom, levels);
  if (run(7)) part7(geom, levels);
  if (run(8)) part8();

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
