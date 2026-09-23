// HÌNH RẠN → VECTOR TILE (PMTiles v3):
//
//   node --max-old-space-size=8192 scripts/reef-to-pmtiles.mjs
//
// Đọc : public/data/reef-shapes-aca.v1.bin      (delta+zigzag+varint, src/lib/reef-bin.mjs)
// Ghi : public/data/reef-shapes-aca.v1.pmtiles  (MVT, gzip từng ô, z3–z13)
//
// ═══ VÌ SAO ════════════════════════════════════════════════════════════════
// Đường đang đi: tải cả file .bin → giải mã ra MỘT FeatureCollection 4.030.270
// đỉnh → đưa cho MapLibre làm `type: "geojson"`. MapLibre KHÔNG vẽ thẳng từ
// GeoJSON: nó chuyển toàn bộ đống đó sang worker (một bản sao nữa), dựng chỉ
// mục geojson-vt, rồi tự cắt ô ở mọi mức zoom. Đo thật trên máy để bàn
// (docs/research/ran-vector-tile-2026-08.md): 323 MB cho riêng object GeoJSON,
// +1,4 s dựng chỉ mục, RSS đỉnh 1,26 GB. Điện thoại phổ thông 2–3 GB RAM thì
// tab trình duyệt bị hệ điều hành giết trước khi thấy cái rạn đầu tiên.
//
// Vector tile đảo ngược việc đó: CẮT SẴN LÚC BUILD, lúc chạy máy chỉ tải và giải
// đúng vài ô đang nhìn (mỗi ô vài KB). Đây đúng khuôn nền bản đồ app đã dùng
// (`public/data/vn-basemap.pmtiles` + `src/lib/pmtiles-protocol.ts`), nên không
// thêm một cơ chế mới nào vào app — chỉ thêm một nguồn cùng loại.
//
// ═══ KHÔNG THÊM DEPENDENCY ═════════════════════════════════════════════════
// Cả ba việc nặng đều làm bằng thứ ĐÃ CÀI (đi kèm maplibre-gl, xem package-lock):
//   · @maplibre/geojson-vt  — cắt ô + giản lược Douglas–Peucker THEO TỪNG ZOOM
//   · @maplibre/vt-pbf      — ô geojson-vt → protobuf MVT
//   · node:zlib             — gzip từng ô
// Riêng phần ĐÓNG GÓI PMTiles v3 viết tay ở dưới (~120 dòng): gói `pmtiles`
// trong repo là bộ ĐỌC ("PMTiles archive decoder for browsers"), không có bộ
// ghi; bản chất file chỉ là header 127 byte + hai bảng mục lục varint + đống ô
// nối đuôi. Thêm một dep chỉ để ghi 127 byte header là đúng thứ nguyên tắc 15
// bậc 5 cấm. Bộ ĐỌC thì dùng lại nguyên (`zxyToTileId`) để hai bên không lệch
// cách đánh số ô — chỗ duy nhất sai một li là hỏng cả file.
//
// ═══ GIẢN LƯỢC THEO ZOOM ═══════════════════════════════════════════════════
// geojson-vt giản lược với ngưỡng TỈ LỆ NGHỊCH với zoom: z6 chỉ giữ đỉnh nào
// còn nhìn thấy được ở z6, z13 giữ NGUYÊN VẸN (ở đúng mức maxZoom nó không
// giản lược một đỉnh nào). Đo thật: z6 hết 0,02 MB / 5.536 đỉnh, z13 hết
// 6,59 MB / 4.339.471 đỉnh — cùng một lớp, chênh nhau 300 lần. Bản GeoJSON một
// mức không làm được điều đó: nó chỉ có MỘT độ nét cho mọi zoom.
//
// ═══ CỔNG TỰ KIỂM (chạy trên thứ SẮP GHI, không phải trên nguồn) ═══════════
// (a) mọi mảnh đa giác nguồn phải có mặt ở mức nét đầy đủ — đếm bằng `pid`,
//     thiếu một mảnh là mất một vật cản ngoài biển
// (b) toạ độ ô ở mức nét đầy đủ phải khớp nguồn trong sai số lưới MVT
// (c) trần 20 MB/file (cùng con số hook pre-commit chặn)
// (d) đọc lại file vừa ghi bằng chính bộ đọc `pmtiles` → header + mục lục hợp lệ

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { decodeReefShapes } from "../src/lib/reef-bin.mjs";
import { GeoJSONVT } from "@maplibre/geojson-vt";
import { fromGeojsonVt } from "@maplibre/vt-pbf";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { PMTiles, zxyToTileId } from "pmtiles";

const SRC = "public/data/reef-shapes-aca.v1.bin";
const OUT = "public/data/reef-shapes-aca.v1.pmtiles";

/** Tên lớp bên trong ô — style bên app trỏ vào bằng `source-layer`. */
export const REEF_TILE_LAYER = "reef";
/** Dưới z3 lớp rạn không đọc được gì (cả Biển Đông gói trong vài pixel). */
export const REEF_TILE_MINZOOM = 3;
/**
 * z13 = mức nét đầy đủ (ở đúng maxZoom geojson-vt KHÔNG giản lược đỉnh nào);
 * MapLibre tự phóng to ô z13 cho z14+.
 *
 * VÌ SAO 13 CHỨ KHÔNG 14 — đo, không đoán. Thêm mức z14 tốn 7,9 MB nữa
 * (11,99 MB → 19,9 MB, sát trần 20 MB) mà KHÔNG thêm một thông tin nào: ô z13
 * đã giữ đủ 100% đỉnh nguồn, còn phần z14 mua thêm chỉ là lưới toạ độ mịn hơn.
 * Mà lưới z13 (4096 đơn vị trên một ô 0,0439° → 1,07e-5°/đơn vị ≈ 1,19 m) đã
 * mịn NGANG bước lưới của chính bộ nguồn (1e-5° ≈ 1,11 m). Trả 7,9 MB cho số
 * thập phân không có thật là đúng thứ nguyên tắc 15 bậc 1 bảo bỏ.
 */
export const REEF_TILE_MAXZOOM = 13;
/** Lưới toạ độ trong ô. 4096 ở z13 ≈ 1,2 m/đơn vị — ngang lưới nguồn (1,1 m). */
const EXTENT = 4096;
/**
 * Ngưỡng giản lược cho các mức DƯỚI maxZoom, tính bằng đơn vị ô. Một pixel màn
 * hình = EXTENT/512 = 8 đơn vị, nên `8` nghĩa là "bỏ đỉnh nào lệch dưới một
 * pixel". Đo thật: hạ từ mặc định 3 (0,375 px, mặc định của MapLibre cho nguồn
 * geojson) xuống 8 cắt 17,58 MB → 11,99 MB mà không đụng gì tới z13.
 */
const TOLERANCE = 8;
/** Trần một file trong public/data — cùng con số hook đang chặn. */
const FILE_MAX = 20 * 1024 * 1024;
/**
 * Trần độ lệch toạ độ ở mức nét đầy đủ. 2 m = một đơn vị lưới ô z13 (1,19 m)
 * cộng chỗ hở cho phép làm tròn — tức "không thô hơn chính bộ nguồn". Không
 * phải con số cho đẹp: vượt nó là bản đồ nói sai chỗ vật cản.
 */
const MAX_DEV_M = 2;
/** Bộ đọc pmtiles lấy 16 KB đầu file và mong mục lục gốc nằm gọn trong đó. */
const ROOT_MAX = 16384 - 127;

// Chạy thẳng thì sinh file; `import` từ test thì chỉ lấy hàm (Windows: so bằng
// URL chứ không ghép chuỗi — đường dẫn `C:\...` không tự thành `file://` hợp lệ).
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

// ── PMTiles v3: ghi mục lục ────────────────────────────────────────────────

/**
 * Varint LEB128. `% 128` chứ không `& 0x7f` — toán tử bit của JS ép về int32 nên
 * `&` sai âm thầm với offset ≥ 2^31, mà file này có thể vượt qua mốc đó.
 * @param {number[]} out
 * @param {number} v
 */
function putVarint(out, v) {
  let n = v;
  while (n >= 128) {
    out.push((n % 128) + 128);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

/**
 * Mục lục PMTiles v3: bốn cột song song (id lệch dần · độ dài chuỗi · độ dài ô ·
 * vị trí), mỗi cột varint. Vị trí ghi 0 nghĩa là "nối ngay sau ô trước" — đó là
 * lý do file phải xếp theo thứ tự Hilbert, không phải theo z/x/y.
 * @param {{tileId:number,offset:number,length:number,runLength:number}[]} entries
 * @returns {Uint8Array} đã gzip
 */
function serializeDirectory(entries) {
  /** @type {number[]} */
  const out = [];
  putVarint(out, entries.length);
  let last = 0;
  for (const e of entries) {
    putVarint(out, e.tileId - last);
    last = e.tileId;
  }
  for (const e of entries) putVarint(out, e.runLength);
  for (const e of entries) putVarint(out, e.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prev = entries[i - 1];
    if (i > 0 && e.offset === prev.offset + prev.length) putVarint(out, 0);
    else putVarint(out, e.offset + 1);
  }
  return gzipSync(Uint8Array.from(out));
}

/**
 * Chia mục lục thành gốc + lá cho tới khi gốc lọt 16 KB. Bắt đầu từ "một lá",
 * nhân đôi cỡ lá mỗi vòng — đơn giản và hội tụ sau vài vòng với vài chục nghìn ô.
 * @param {{tileId:number,offset:number,length:number,runLength:number}[]} entries
 * @returns {{ root: Uint8Array, leaves: Uint8Array, numLeaves: number }}
 */
function buildDirectories(entries) {
  const whole = serializeDirectory(entries);
  if (whole.length <= ROOT_MAX) {
    return { root: whole, leaves: new Uint8Array(0), numLeaves: 0 };
  }
  for (let leafSize = 4096; leafSize <= 1 << 22; leafSize *= 2) {
    /** @type {Uint8Array[]} */
    const leafBlobs = [];
    /** @type {{tileId:number,offset:number,length:number,runLength:number}[]} */
    const rootEntries = [];
    let at = 0;
    for (let i = 0; i < entries.length; i += leafSize) {
      const chunk = entries.slice(i, i + leafSize);
      const blob = serializeDirectory(chunk);
      leafBlobs.push(blob);
      // runLength 0 = "mục này trỏ sang một mục lục lá", không phải một ô
      rootEntries.push({ tileId: chunk[0].tileId, offset: at, length: blob.length, runLength: 0 });
      at += blob.length;
    }
    const root = serializeDirectory(rootEntries);
    if (root.length > ROOT_MAX) continue;
    const leaves = new Uint8Array(at);
    let p = 0;
    for (const b of leafBlobs) {
      leaves.set(b, p);
      p += b.length;
    }
    return { root, leaves, numLeaves: leafBlobs.length };
  }
  throw new Error("pmtiles: không chia nổi mục lục gốc xuống dưới 16 KB");
}

/**
 * Ghép file PMTiles v3 hoàn chỉnh.
 * @param {{ tiles: {z:number,x:number,y:number,data:Uint8Array}[],
 *           metadata: unknown, minZoom:number, maxZoom:number,
 *           bbox:[number,number,number,number], centerZoom:number }} spec
 */
function buildPmtiles(spec) {
  // Xếp theo id Hilbert — bộ đọc tra mục lục bằng tìm nhị phân trên id này.
  const sorted = spec.tiles
    .map((t) => ({ ...t, tileId: zxyToTileId(t.z, t.x, t.y) }))
    .sort((a, b) => a.tileId - b.tileId);

  /** @type {{tileId:number,offset:number,length:number,runLength:number}[]} */
  const entries = [];
  /** @type {Uint8Array[]} */
  const blobs = [];
  /** @type {Map<string, {offset:number,length:number}>} */
  const seen = new Map();
  let dataLen = 0;
  for (const t of sorted) {
    // Ô trùng byte (hay gặp ở zoom thấp, nhiều ô rỗng-như-nhau) chỉ lưu một bản.
    const key = Buffer.from(t.data).toString("base64");
    const hit = seen.get(key);
    if (hit) {
      entries.push({ tileId: t.tileId, offset: hit.offset, length: hit.length, runLength: 1 });
      continue;
    }
    const offset = dataLen;
    blobs.push(t.data);
    dataLen += t.data.length;
    seen.set(key, { offset, length: t.data.length });
    entries.push({ tileId: t.tileId, offset, length: t.data.length, runLength: 1 });
  }

  const { root, leaves, numLeaves } = buildDirectories(entries);
  const meta = gzipSync(Buffer.from(JSON.stringify(spec.metadata), "utf8"));

  const rootOff = 127;
  const metaOff = rootOff + root.length;
  const leafOff = metaOff + meta.length;
  const dataOff = leafOff + leaves.length;

  const header = new Uint8Array(127);
  const v = new DataView(header.buffer);
  header.set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73], 0); // "PMTiles"
  v.setUint8(7, 3);
  const u64 = (o, n) => v.setBigUint64(o, BigInt(n), true);
  u64(8, rootOff);
  u64(16, root.length);
  u64(24, metaOff);
  u64(32, meta.length);
  u64(40, leafOff);
  u64(48, leaves.length);
  u64(56, dataOff);
  u64(64, dataLen);
  u64(72, entries.length); // ô có địa chỉ
  u64(80, entries.length); // mục trong mục lục
  u64(88, blobs.length); // nội dung khác nhau
  v.setUint8(96, 1); // clustered — đã xếp Hilbert
  v.setUint8(97, 2); // mục lục nén gzip
  v.setUint8(98, 2); // ô nén gzip
  v.setUint8(99, 1); // kiểu ô = MVT
  v.setUint8(100, spec.minZoom);
  v.setUint8(101, spec.maxZoom);
  const e7 = (o, deg) => v.setInt32(o, Math.round(deg * 1e7), true);
  e7(102, spec.bbox[0]);
  e7(106, spec.bbox[1]);
  e7(110, spec.bbox[2]);
  e7(114, spec.bbox[3]);
  v.setUint8(118, spec.centerZoom);
  e7(119, (spec.bbox[0] + spec.bbox[2]) / 2);
  e7(123, (spec.bbox[1] + spec.bbox[3]) / 2);

  const file = new Uint8Array(dataOff + dataLen);
  file.set(header, 0);
  file.set(root, rootOff);
  file.set(meta, metaOff);
  file.set(leaves, leafOff);
  let p = dataOff;
  for (const b of blobs) {
    file.set(b, p);
    p += b.length;
  }
  return { file, entries: entries.length, contents: blobs.length, numLeaves, dataLen };
}

// ── Nguồn → ô ──────────────────────────────────────────────────────────────

/**
 * Tách MultiPolygon thành từng MẢNH một feature.
 *
 * Không phải để cho gọn: geojson-vt cắt ô theo khung bao của feature, mà một cụm
 * rạn Trường Sa gộp lại có khung bao trải cả trăm hải lý — mọi ô trong khung đó
 * phải xén qua 2 triệu đỉnh dù chỉ chứa một mảnh nhỏ. Tách ra thì mỗi mảnh có
 * khung bao đúng bằng chính nó, ô nào không chạm là loại ngay bằng một phép so.
 *
 * `pid` (số thứ tự mảnh, chạy suốt bộ) là tay cầm của cổng bất biến: đếm pid ở
 * mức nét đầy đủ mà thiếu một số là mất một mảnh. Nó tốn 1,33 MB trong 11,99 MB
 * — trả tiền để bất biến "không mất mảnh nào" kiểm được trên CHÍNH FILE PHÁT
 * HÀNH, không phải trên một bản dựng lại trong bộ nhớ.
 *
 * KHÔNG kèm chỉ số feature nguồn: nó suy ra được từ `pid` bằng bảng
 * `partStartOfFeature` (1.534 số) nằm trong metadata của file. Nhét thêm một số
 * vào TỪNG feature của TỪNG ô để khỏi tra một bảng là trả tiền hai lần.
 *
 * @param {{features: {properties: Record<string, unknown>, geometry: {coordinates: number[][][][]}}[]}} fc
 */
export function explodeParts(fc) {
  /** @type {{type:"Feature",properties:Record<string,unknown>,geometry:{type:"Polygon",coordinates:number[][][]}}[]} */
  const out = [];
  /** @type {number[]} */
  const partStartOfFeature = [];
  let pid = 0;
  for (let i = 0; i < fc.features.length; i++) {
    const f = fc.features[i];
    partStartOfFeature.push(pid);
    for (const poly of f.geometry.coordinates) {
      out.push({
        type: "Feature",
        properties: { kind: String(f.properties.kind ?? "reef"), pid },
        geometry: { type: "Polygon", coordinates: poly },
      });
      pid++;
    }
  }
  return { features: out, partStartOfFeature, parts: pid };
}

/**
 * Đi từ z0 xuống, CHỈ chui vào ô CÓ DỮ LIỆU NGUỒN.
 *
 * Ô cha không có dữ liệu thì mọi ô con cũng không (hình nằm trong ô con thì
 * đương nhiên nằm trong ô cha), nên phép cắt tỉa này không bỏ sót gì — mà nó cắt
 * từ ~700.000 ô z14 trong khung VN xuống còn vài chục nghìn ô thật sự có rạn.
 *
 * PHÂN BIỆT HAI THỨ KHÁC NHAU, đã dính thật lúc dựng: `getTile` trả về `null`
 * nghĩa là "không có dữ liệu ở đây" (được phép cắt nhánh), còn trả về một ô có
 * `features.length === 0` nghĩa là "có dữ liệu nhưng ở mức zoom này giản lược
 * hết" — ô z0 của bộ này đúng là ca đó. Lẫn hai cái là cắt nhánh ngay từ z0 và
 * ra một file rỗng mà mọi cổng đếm vẫn xanh.
 *
 * @param {InstanceType<typeof GeoJSONVT>} idx
 * @param {number} minZoom
 * @param {number} maxZoom
 * @param {(z:number,x:number,y:number,tile:{features:unknown[]})=>void} emit
 */
export function walkTiles(idx, minZoom, maxZoom, emit) {
  /** @param {number} z @param {number} x @param {number} y */
  function go(z, x, y) {
    const t = idx.getTile(z, x, y);
    if (!t) return;
    if (z >= minZoom && t.features.length > 0) emit(z, x, y, t);
    if (z >= maxZoom) return;
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) go(z + 1, 2 * x + dx, 2 * y + dy);
  }
  go(0, 0, 0);
}

/**
 * Nguồn byte cho `PMTiles` đọc từ một Buffer trong bộ nhớ.
 *
 * Gói `pmtiles` chỉ kèm sẵn nguồn HTTP và nguồn `File` của trình duyệt — cả hai
 * không dùng được ở đây. Giao diện chỉ có hai hàm, nên tự cấp còn rẻ hơn đi tìm
 * một adapter (nguyên tắc 15 bậc 7).
 *
 * @param {Buffer} buf
 * @param {string} key
 */
export function bufferSource(buf, key) {
  return {
    getKey: () => key,
    getBytes: async (offset, length) => ({
      data: new Uint8Array(buf.subarray(offset, offset + length)).buffer,
    }),
  };
}

// ── Soi lại ô đã mã hoá ────────────────────────────────────────────────────

/** Khung ô (độ) theo Web Mercator. */
function tileBoundsDeg(z, x, y) {
  const n = 2 ** z;
  const lat = (t) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  return { w: (x / n) * 360 - 180, e: ((x + 1) / n) * 360 - 180, n: lat(y), s: lat(y + 1) };
}

/** Mảnh nguồn có nằm gọn trong khung ô không (chạm biên là coi như bị cắt). */
function insideTile(rings, tb) {
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x <= tb.w || x >= tb.e || y <= tb.s || y >= tb.n) return false;
    }
  }
  return true;
}

/** Vòng kín → danh sách đỉnh, bỏ đỉnh đóng vòng (trùng đỉnh đầu). */
function openRing(ring) {
  const n = ring.length;
  const closed = n >= 2 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
  return closed ? ring.slice(0, n - 1) : ring;
}

/** Một độ vĩ ≈ 111,32 km; một độ kinh co lại theo cos(vĩ độ). */
function degToM(dLon, dLat, lat) {
  const mx = dLon * 111_320 * Math.cos((lat * Math.PI) / 180);
  const my = dLat * 110_540;
  return Math.hypot(mx, my);
}

/**
 * Độ lệch lớn nhất giữa hai vòng CÙNG SỐ ĐỈNH, sau khi gỡ phép xoay + đảo chiều.
 * @returns {number} mét
 */
export function ringDeviationM(srcRing, gotRing) {
  const a = openRing(srcRing);
  const b = openRing(gotRing);
  const n = a.length;
  if (n === 0 || b.length !== n) return Infinity;
  let m = 0;
  let best = Infinity;
  for (let k = 0; k < n; k++) {
    const d = degToM(a[0][0] - b[k][0], a[0][1] - b[k][1], a[0][1]);
    if (d < best) {
      best = d;
      m = k;
    }
  }
  let fwd = 0;
  let rev = 0;
  for (let k = 0; k < n; k++) {
    const p = b[(m + k) % n];
    const q = b[(m - k + n) % n];
    fwd = Math.max(fwd, degToM(a[k][0] - p[0], a[k][1] - p[1], a[k][1]));
    rev = Math.max(rev, degToM(a[k][0] - q[0], a[k][1] - q[1], a[k][1]));
  }
  return Math.min(fwd, rev);
}

/**
 * Giải nén + giải mã lại các ô ở mức nét đầy đủ, đối chiếu với hình nguồn.
 *
 * Chỉ so toạ độ những mảnh NẰM GỌN TRONG LÒNG Ô (khung bao của mảnh nguồn không
 * chạm biên ô) — mảnh bị cắt thì có đỉnh mới sinh ra trên đường biên, so từng
 * đỉnh với nguồn là so hai thứ khác nhau. Số mảnh so được ĐƯỢC BÁO RA để người
 * đọc biết cổng này phủ tới đâu, không phải một dấu tick.
 *
 * ĐIỀU KIỆN "NẰM GỌN" PHẢI LÀ HÌNH HỌC, KHÔNG ĐƯỢC LÀ ĐẾM SỐ. Bản đầu tiên
 * nhận diện "chưa bị cắt" bằng "cùng số vòng và cùng số đỉnh" — sai, vì một
 * vòng 1.175 đỉnh cắt qua biên ô vẫn có thể ra đúng 1.175 đỉnh (mất mấy đỉnh
 * ngoài ô, thêm mấy đỉnh trên biên). Cổng khi đó báo lệch 1.547 m ở đúng những
 * mảnh nó không có quyền so.
 *
 * GHÉP ĐỈNH PHẢI TÍNH TỚI XOAY VÀ ĐẢO CHIỀU. Đo thật: vòng ra khỏi bước cắt ô
 * vừa bị đảo chiều vừa bị đổi đỉnh bắt đầu (mảnh 88.596: y hệt 8 đỉnh, nhưng
 * got[k] = src[(9−k) mod 8]). So thẳng theo chỉ số thì cổng báo lệch 537 m
 * trong khi hình không xê dịch một li. Ghép theo tập đỉnh ĐÃ SẮP XẾP cũng không
 * xong: hai đỉnh gần bằng nhau về kinh độ có thể đổi chỗ sau khi làm tròn, và
 * cổng lại báo 660 m ở mảnh 88.839. Nên ở đây dò ĐÚNG phép xoay: tìm đỉnh của
 * `got` gần `src[0]` nhất rồi so xuôi/ngược từ đó. Một cổng báo động giả sẽ bị
 * người ta tắt đi, nên nó phải đo đúng thứ nó nói là đang đo.
 *
 * @param {{z:number,x:number,y:number,data:Uint8Array}[]} tiles
 * @param {{properties:Record<string,unknown>,geometry:{coordinates:number[][][]}}[]} parts mảnh nguồn, tra theo `pid`
 * @param {number} maxZoom
 */
export function auditMaxZoomTiles(tiles, parts, maxZoom) {
  /** @type {Set<number>} */
  const pids = new Set();
  let compared = 0;
  let maxDevM = 0;
  for (const t of tiles) {
    if (t.z !== maxZoom) continue;
    const layer = new VectorTile(new Pbf(gunzipSync(t.data))).layers[REEF_TILE_LAYER];
    if (!layer) continue;
    const tb = tileBoundsDeg(t.z, t.x, t.y);
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i);
      const pid = Number(feat.properties.pid);
      pids.add(pid);
      const src = parts[pid]?.geometry.coordinates;
      if (!src) continue;
      if (!insideTile(src, tb)) continue; // bị cắt biên → không có quyền so đỉnh
      const gj = feat.toGeoJSON(t.x, t.y, t.z);
      const got = gj.geometry.type === "Polygon" ? gj.geometry.coordinates : null;
      if (!got || got.length !== src.length) continue;
      if (src.some((ring, r) => ring.length !== got[r].length)) continue;
      compared++;
      for (let r = 0; r < src.length; r++) {
        maxDevM = Math.max(maxDevM, ringDeviationM(src[r], got[r]));
      }
    }
  }
  return { pids, compared, maxDevM };
}

// ── Chạy ───────────────────────────────────────────────────────────────────

if (isMain) {
  if (!existsSync(SRC)) {
    throw new Error(`Thiếu ${SRC} — chạy scripts/encode-reef-shapes.mjs trước.`);
  }
  const t0 = Date.now();
  const fc = decodeReefShapes(readFileSync(SRC));
  const { features, partStartOfFeature, parts } = explodeParts(fc);
  console.log(
    `Nguồn ${SRC}: ${fc.features.length.toLocaleString("vi-VN")} cụm → ` +
      `${parts.toLocaleString("vi-VN")} mảnh đa giác`,
  );

  const idx = new GeoJSONVT(
    { type: "FeatureCollection", features },
    {
      maxZoom: REEF_TILE_MAXZOOM,
      indexMaxZoom: 5,
      indexMaxPoints: 100000,
      tolerance: TOLERANCE,
      extent: EXTENT,
      buffer: 64,
    },
  );
  console.log(`Chỉ mục cắt ô: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  /** @type {{z:number,x:number,y:number,data:Uint8Array}[]} */
  const tiles = [];
  /** @type {Record<number,{tiles:number,bytes:number,verts:number}>} */
  const perZoom = {};
  walkTiles(idx, REEF_TILE_MINZOOM, REEF_TILE_MAXZOOM, (z, x, y, tile) => {
    const data = gzipSync(fromGeojsonVt({ [REEF_TILE_LAYER]: tile }, { extent: EXTENT }));
    tiles.push({ z, x, y, data });
    const s = (perZoom[z] ??= { tiles: 0, bytes: 0, verts: 0 });
    s.tiles++;
    s.bytes += data.length;
    s.verts += tile.numSimplified ?? 0;
  });
  console.log(`Cắt xong: ${tiles.length.toLocaleString("vi-VN")} ô · ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // ── (a) + (b): SOI TRÊN BYTE SẮP GHI, KHÔNG SOI TRÊN OBJECT TRUNG GIAN ────
  /*  Giải nén và giải mã lại chính những ô sắp nằm trong file. Soi object
      geojson-vt thì bỏ lọt đúng khoảng nguy hiểm nhất: bước mã hoá MVT (làm
      tròn về lưới ô, đảo chiều vòng, gộp mảnh). Đó là bước duy nhất giữa "đã
      đo đúng" và "bà con nhìn thấy".  */
  const audit = auditMaxZoomTiles(tiles, features, REEF_TILE_MAXZOOM);
  if (audit.pids.size !== parts) {
    const missing = [];
    for (let i = 0; i < parts && missing.length < 10; i++) if (!audit.pids.has(i)) missing.push(i);
    throw new Error(
      `CHẶN (a): z${REEF_TILE_MAXZOOM} chỉ có ${audit.pids.size}/${parts} mảnh. ` +
        `Thiếu (10 cái đầu): ${missing.join(", ")}. Mất một mảnh là mất một vật cản.`,
    );
  }
  if (audit.maxDevM > MAX_DEV_M) {
    throw new Error(
      `CHẶN (b): mảnh nguyên vẹn lệch tới ${audit.maxDevM.toFixed(2)} m so với nguồn ` +
        `(trần ${MAX_DEV_M} m). Lưới ô đang thô hơn lưới nguồn — hạ EXTENT/MAXZOOM là sai hướng.`,
    );
  }
  console.log(
    `Soi lại ô z${REEF_TILE_MAXZOOM}: ${audit.pids.size.toLocaleString("vi-VN")}/${parts.toLocaleString("vi-VN")} mảnh · ` +
      `so khớp toạ độ ${audit.compared.toLocaleString("vi-VN")} mảnh nguyên vẹn · lệch tối đa ${audit.maxDevM.toFixed(2)} m`,
  );

  const built = buildPmtiles({
    tiles,
    metadata: {
      name: "SDFish · hình rạn & bãi cạn (Allen Coral Atlas)",
      description:
        "Rạn san hô và bãi cạn vùng biển Việt Nam, cắt sẵn thành vector tile. " +
        "Sinh bằng scripts/reef-to-pmtiles.mjs từ public/data/reef-shapes-aca.v1.bin.",
      attribution: fc.properties?.attribution ?? "Allen Coral Atlas",
      version: "1",
      vector_layers: [
        {
          id: REEF_TILE_LAYER,
          description: "Mảnh đa giác rạn/bãi cạn",
          fields: { kind: "String", pid: "Number", f: "Number" },
          minzoom: REEF_TILE_MINZOOM,
          maxzoom: REEF_TILE_MAXZOOM,
        },
      ],
      // Số đo của chính bộ này — để test đối chiếu với file .bin nguồn, và để
      // người đọc file sau này biết nó được sinh từ đâu mà không phải đoán.
      sdfish: {
        source: SRC,
        sourceFeatures: fc.features.length,
        parts,
        partStartOfFeature,
        extent: EXTENT,
      },
    },
    minZoom: REEF_TILE_MINZOOM,
    maxZoom: REEF_TILE_MAXZOOM,
    bbox: fc.properties.bbox,
    centerZoom: 7,
  });

  // Bảng số đo IN TRƯỚC cổng dung lượng: cổng (c) bảo "báo Lead kèm số đo", mà
  // số đo phải có sẵn trên màn hình lúc nó chặn, không phải chạy lại mới thấy.
  console.log(
    `\n${OUT}\n` +
      `  ${(built.file.length / 1e6).toFixed(2)} MB · ${built.entries.toLocaleString("vi-VN")} ô · ` +
      `${built.contents.toLocaleString("vi-VN")} ô khác nhau · ${built.numLeaves} mục lục lá\n` +
      `  z${REEF_TILE_MINZOOM}–z${REEF_TILE_MAXZOOM} · lớp "${REEF_TILE_LAYER}" · ` +
      `${audit.pids.size.toLocaleString("vi-VN")}/${parts.toLocaleString("vi-VN")} mảnh có mặt ở z${REEF_TILE_MAXZOOM}\n` +
      `  ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  console.log("\n  zoom │    ô │   dung lượng │ đỉnh vẽ (tổng)");
  for (const z of Object.keys(perZoom).map(Number).sort((a, b) => a - b)) {
    const s = perZoom[z];
    console.log(
      `  z${String(z).padStart(2)}  │ ${String(s.tiles).padStart(5)} │ ` +
        `${(s.bytes / 1e6).toFixed(2).padStart(8)} MB │ ${s.verts.toLocaleString("vi-VN").padStart(11)}`,
    );
  }

  // ── (c) TRẦN 20 MB/FILE ──────────────────────────────────────────────────
  if (built.file.length > FILE_MAX) {
    throw new Error(
      `CHẶN (c): ${(built.file.length / 1e6).toFixed(1)} MB vượt trần 20 MB/file.\n` +
        `KHÔNG tự hạ độ nét và KHÔNG tự nới trần — báo Lead kèm số đo này.`,
    );
  }

  writeFileSync(OUT, built.file);

  // ── (d) ĐỌC LẠI BẰNG CHÍNH BỘ ĐỌC APP SẼ DÙNG ────────────────────────────
  /*  Bộ đóng gói ở trên là code tự viết; nếu nó lệch spec một byte thì mọi cổng
      trên vẫn xanh (chúng soi các ô TRƯỚC khi đóng gói) mà app ngoài biển chỉ
      thấy bản đồ trống. Nên cổng cuối phải đi qua đúng gói `pmtiles` mà
      `src/lib/pmtiles-protocol.ts` đăng ký cho MapLibre.  */
  const back = new PMTiles(bufferSource(readFileSync(OUT), OUT));
  const backHeader = await back.getHeader();
  if (backHeader.minZoom !== REEF_TILE_MINZOOM || backHeader.maxZoom !== REEF_TILE_MAXZOOM) {
    throw new Error(`CHẶN (d): đọc lại ra zoom ${backHeader.minZoom}–${backHeader.maxZoom}`);
  }
  const probe = tiles.find((t) => t.z === REEF_TILE_MAXZOOM);
  const got = await back.getZxy(probe.z, probe.x, probe.y);
  if (!got) throw new Error(`CHẶN (d): đọc lại không thấy ô z${probe.z}/${probe.x}/${probe.y}`);
  const backLayer = new VectorTile(new Pbf(new Uint8Array(got.data))).layers[REEF_TILE_LAYER];
  if (!backLayer?.length) throw new Error(`CHẶN (d): ô đọc lại không có lớp "${REEF_TILE_LAYER}"`);

  console.log(
    `\nĐã ghi ${OUT}. Đọc lại bằng gói pmtiles: z${backHeader.minZoom}–z${backHeader.maxZoom}, ` +
      `ô mẫu z${probe.z}/${probe.x}/${probe.y} có ${backLayer.length} feature.`,
  );
}
