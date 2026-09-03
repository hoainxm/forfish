// DỰNG LẠI NỀN BẢN ĐỒ — bỏ SẠCH mọi nhãn tên và mọi ranh giới khỏi
// `public/data/vn-basemap.pmtiles`, GIỮ NGUYÊN hình học.
//
//   node scripts/rebuild-basemap.mjs            # ghi đè file nền
//   node scripts/rebuild-basemap.mjs --out x    # ghi ra file khác (để so)
//   node scripts/rebuild-basemap.mjs --dry-run  # chỉ đo, không ghi
//
// ── VÌ SAO CÓ FILE NÀY ─────────────────────────────────────────────────────
// `vn-basemap.pmtiles` tải sẵn từ Protomaps (OSM), KHÔNG do repo sinh ra, nên
// chưa từng qua cổng chủ quyền nào. Đo bằng `scripts/audit-names.mjs`
// (2026-08-29): 12.755 đối tượng mang chữ Hán, gồm `三沙市` — "thành phố Tam
// Sa" Trung Quốc bịa ra để "quản" Hoàng Sa + Trường Sa — nằm ngay trên đảo Phú
// Lâm. Trường `name:vi` cũng bẩn ("Tam Sa", "Đảo Chử Bích"): chữ Latin có dấu
// nên cổng CJK không bắt.
//
// Màn hình hôm nay sạch CHỈ NHỜ `buildMapStyle` lọc lớp `symbol` + `boundaries`
// lúc dựng style. Đó là hàng rào MỀM: một PR "bật nhãn nền cho dễ nhìn" là đủ
// để 三沙市 hiện lên hải đồ phát cho bà con. Bỏ tên khỏi CHÍNH DỮ LIỆU thì
// không PR nào bật lại được.
//
// ── VÌ SAO LỌC HẬU KỲ, KHÔNG DỰNG LẠI BẰNG PLANETILER ──────────────────────
// Planetiler + hồ sơ Protomaps là đường "sạch từ gốc", nhưng nó cần Java (máy
// dựng hiện KHÔNG có: `java -version` → command not found) và một lượt tải
// extract OSM vài GB. Lọc hậu kỳ chỉ đụng BẢNG THUỘC TÍNH của mỗi ô tile —
// hình học không bị đọc lại, không bị vẽ lại, nên không có rủi ro "đường bờ đổi
// hình". Rủi ro thật của đường này là sinh tile hỏng; nghiệm thu ở cuối file
// (đọc lại bằng chính thư viện `pmtiles` + đếm lớp hình học còn lại) canh đúng
// chỗ đó.
//
// ── BỎ GÌ ─────────────────────────────────────────────────────────────────
//   · MỌI khoá thuộc tính có chữ "name" (name, name:vi, name:zh-Hant, name2,
//     pgf:name:hi…) và mọi khoá `ref` / `ref:*`.
//   · TRỌN lớp `boundaries` — Protomaps kẻ 13 đoạn `region` + 5 đoạn `county
//     disputed=true` + 4 đoạn `country` xuyên giữa Trường Sa.
// GIỮ: hình học (earth/water/roads/landuse/landcover/buildings/places…) và các
// khoá phân loại (kind, sort_rank, min_zoom…) — app không lấy một nhãn nào từ
// nền nên không mất chức năng.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { gzipSync, gunzipSync, brotliDecompressSync, brotliCompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/data/vn-basemap.pmtiles");

/**
 * Khoá thuộc tính bị gỡ khỏi MỌI lớp:
 *   · chứa "name"  → name, name:vi, name:zh-Hant, name2, pgf:name:hi…
 *   · ref / ref:*  → số hiệu tuyến
 *   · shield_text* / network*  → CHỮ IN TRONG BIỂN SỐ TUYẾN ĐƯỜNG. Không tên
 *     "name" nào cả, nhưng đo lượt lọc đầu (2026-08-29) vẫn còn 桂高速 (cao tốc
 *     Quế) và 中山快线 sót lại đúng ở đây — biển số tuyến LÀ nhãn, chỉ mang tên
 *     khác. Protomaps đánh số hậu tố _1.._3 cho tuyến chồng nhau nên phải khớp
 *     cả hậu tố.
 */
const DROP_KEY = (k) =>
  /name/i.test(k) || /^ref(:|$)/i.test(k) || /^(shield_text|network)(_\d+)?$/i.test(k);
/** Lớp bị gỡ trọn. */
const DROP_LAYER = (name) => name === "boundaries";

/**
 * LƯỚI AN TOÀN CUỐI: bỏ luôn mọi GIÁ TRỊ chuỗi có chữ Hán/CJK, dù khoá của nó
 * tên là gì. Danh sách khoá ở trên là do ĐO trên đúng bản dữ liệu này; bản OSM
 * sau có thể lòi ra một khoá mang nhãn mà ta chưa từng thấy (operator, brand,
 * destination…). Cổng chủ quyền thật vẫn là `scripts/audit-names.mjs` — lưới
 * này chỉ để lượt dựng lại lần sau KHÔNG âm thầm tuồn chữ Hán vào file phát cho
 * bà con rồi chờ người khác phát hiện. Dải ký tự lấy đúng theo bản ở cổng đó.
 */
const CJK =
  /[⺀-⿿　-〿぀-ヿ㄀-ㄯㆠ-ㆿ㈀-㏿㐀-䶿一-鿿豈-﫿︰-﹏＀-｠￠-￦]/;

/** Giá trị chuỗi của một Value{1: string}; null nếu là số/bool (không mang tên). */
function valueString(buf) {
  const r = new Reader(buf);
  while (r.p < r.end) {
    const tag = r.varint();
    if (tag >> 3 === 1 && (tag & 7) === 2) {
      const [s, e] = r.span();
      return buf.toString("utf8", s, e);
    }
    r.skip(tag & 7);
  }
  return null;
}

// ── PROTOBUF: ĐỌC ─────────────────────────────────────────────────────────
// Chỉ ~70 dòng, cố ý KHÔNG mượn @mapbox/vector-tile + pbf: hai gói đó là
// dependency BẮC CẦU của maplibre-gl (không khai báo trực tiếp), maplibre nâng
// phiên bản là script dựng dữ liệu gãy. `scripts/audit-names.mjs` đã tự đọc MVT
// vì đúng lý do này; ở đây cần thêm phần GHI NGƯỢC nên không dùng lại được bộ
// đọc bên đó (nó cố ý bỏ qua hình học — thứ ta bắt buộc phải giữ y nguyên).
class Reader {
  constructor(buf, pos = 0, end = buf.length) {
    this.b = buf;
    this.p = pos;
    this.end = end;
  }
  varint() {
    let r = 0;
    let s = 0;
    for (;;) {
      const b = this.b[this.p++];
      r += (b & 0x7f) * 2 ** s;
      if (b < 0x80) return r;
      s += 7;
      if (s > 56) return r;
    }
  }
  /** Trả về [đầu, cuối] của một trường wire-type 2, con trỏ nhảy qua nó. */
  span() {
    const len = this.varint(); // đọc TRƯỚC rồi mới cộng — varint() đã dịch this.p
    const s = this.p;
    this.p = s + len;
    return [s, this.p];
  }
  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.p += 8;
    else if (wire === 2) this.span();
    else if (wire === 5) this.p += 4;
    else throw new Error(`wire type lạ ${wire}`);
  }
}

// ── PROTOBUF: GHI ─────────────────────────────────────────────────────────
class Writer {
  constructor() {
    this.parts = [];
  }
  varint(n) {
    const out = [];
    let v = n;
    while (v >= 0x80) {
      out.push((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    out.push(v);
    return this.raw(Buffer.from(out));
  }
  tag(field, wire) {
    return this.varint(field * 8 + wire);
  }
  /** Trường varint. */
  num(field, n) {
    return this.tag(field, 0).varint(n);
  }
  /** Trường độ-dài-đứng-trước (chuỗi / message / packed). */
  bytes(field, buf) {
    this.tag(field, 2).varint(buf.length);
    return this.raw(buf);
  }
  str(field, s) {
    return this.bytes(field, Buffer.from(s, "utf8"));
  }
  /** Chép NGUYÊN byte (đã gồm cả tag) — dùng để giữ hình học không đụng tới. */
  raw(buf) {
    this.parts.push(buf);
    return this;
  }
  done() {
    return Buffer.concat(this.parts);
  }
}

/** Gói `body` thành một trường message field=`field` của message cha. */
function embed(field, body) {
  return new Writer().bytes(field, body).done();
}

// ── LỌC MỘT Ô TILE ────────────────────────────────────────────────────────
// Lược đồ MVT:  Tile{3: Layer}
//   Layer{1: name, 2: Feature, 3: keys(string), 4: Value, 5: extent, 15: version}
//   Feature{1: id, 2: tags(packed uint32), 3: type, 4: geometry(packed uint32)}

/**
 * Lọc một lớp. Trả về Buffer thân Layer mới, hoặc null nếu lớp bị bỏ.
 * Hình học (Feature field 4) và id/type được chép NGUYÊN BYTE — không giải mã,
 * không làm tròn, nên không có cách nào méo đường bờ.
 */
function filterLayer(buf, start, end, stat) {
  const r = new Reader(buf, start, end);
  let name = "";
  let version = 2;
  let extent = null;
  const keys = [];
  const values = []; // Buffer thân Value, giữ nguyên
  const features = []; // [{ raw: [Buffer…], tags: number[] }]

  while (r.p < r.end) {
    const tag = r.varint();
    const field = tag >> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) {
      const [s, e] = r.span();
      name = buf.toString("utf8", s, e);
    } else if (field === 15 && wire === 0) version = r.varint();
    else if (field === 5 && wire === 0) extent = r.varint();
    else if (field === 3 && wire === 2) {
      const [s, e] = r.span();
      keys.push(buf.toString("utf8", s, e));
    } else if (field === 4 && wire === 2) {
      const [s, e] = r.span();
      values.push(buf.subarray(s, e));
    } else if (field === 2 && wire === 2) {
      const [s, e] = r.span();
      features.push(readFeature(buf, s, e));
    } else r.skip(wire);
  }

  if (DROP_LAYER(name)) {
    stat.layersDropped++;
    stat.featuresDropped += features.length;
    return null;
  }

  const keepKey = keys.map((k) => !DROP_KEY(k));
  stat.keysDropped += keepKey.filter((k) => !k).length;

  // Một giá trị được vài chục feature dùng chung — soi một lần rồi nhớ.
  const dirtyCache = new Map();
  const dirtyValue = (v) => {
    let d = dirtyCache.get(v);
    if (d === undefined) {
      const s = valueString(v);
      d = s !== null && CJK.test(s);
      dirtyCache.set(v, d);
    }
    return d;
  };

  // Bảng khoá/giá trị mới chỉ chứa thứ CÒN ĐƯỢC DÙNG: sau khi gỡ `name:*`, phần
  // lớn bảng chuỗi thành rác — đây là chỗ file nhẹ đi.
  const keyIdx = new Map();
  const valIdx = new Map();
  const newKeys = [];
  const newValues = [];
  const remapKey = (i) => {
    if (keyIdx.has(i)) return keyIdx.get(i);
    const n = newKeys.length;
    newKeys.push(keys[i]);
    keyIdx.set(i, n);
    return n;
  };
  const remapVal = (i) => {
    if (valIdx.has(i)) return valIdx.get(i);
    const n = newValues.length;
    newValues.push(values[i]);
    valIdx.set(i, n);
    return n;
  };

  const featureBodies = [];
  for (const f of features) {
    const tags = [];
    for (let i = 0; i + 1 < f.tags.length; i += 2) {
      const ki = f.tags[i];
      const vi = f.tags[i + 1];
      if (keys[ki] === undefined || values[vi] === undefined) continue;
      if (!keepKey[ki]) continue;
      if (dirtyValue(values[vi])) {
        stat.valuesDropped++;
        continue;
      }
      tags.push(remapKey(ki), remapVal(vi));
    }
    const w = new Writer();
    for (const b of f.head) w.raw(b); // id (field 1) giữ nguyên
    if (tags.length) {
      const packed = new Writer();
      for (const t of tags) packed.varint(t);
      w.bytes(2, packed.done());
    }
    for (const b of f.tail) w.raw(b); // type + HÌNH HỌC giữ nguyên
    featureBodies.push(w.done());
  }

  const out = new Writer();
  out.str(1, name);
  for (const b of featureBodies) out.bytes(2, b);
  for (const k of newKeys) out.str(3, k);
  for (const v of newValues) out.bytes(4, v);
  if (extent !== null) out.num(5, extent);
  out.num(15, version);
  return out.done();
}

/**
 * Đọc một Feature → { head, tags, tail }. `head` = byte thô của field 1 (id),
 * `tail` = byte thô của field 3 (type) + field 4 (geometry) + mọi field lạ.
 * Chỉ field 2 (tags) được dựng lại; phần còn lại chép nguyên.
 */
function readFeature(buf, start, end) {
  const r = new Reader(buf, start, end);
  const head = [];
  const tail = [];
  const tags = [];
  while (r.p < r.end) {
    const at = r.p;
    const tag = r.varint();
    const field = tag >> 3;
    const wire = tag & 7;
    if (field === 2 && wire === 2) {
      const [s, e] = r.span();
      const p = new Reader(buf, s, e);
      while (p.p < p.end) tags.push(p.varint());
      continue;
    }
    r.skip(wire);
    (field === 1 ? head : tail).push(buf.subarray(at, r.p));
  }
  return { head, tags, tail };
}

/** Lọc trọn một ô tile. Trả Buffer mới (có thể rỗng nếu tile chỉ có boundaries). */
function filterTile(buf, stat) {
  const r = new Reader(buf);
  const layers = [];
  while (r.p < r.end) {
    const tag = r.varint();
    if (tag >> 3 !== 3 || (tag & 7) !== 2) {
      r.skip(tag & 7);
      continue;
    }
    const [s, e] = r.span();
    const body = filterLayer(buf, s, e, stat);
    if (body) layers.push(embed(3, body));
  }
  return Buffer.concat(layers);
}

// ── PMTILES v3: ĐỌC / GHI ─────────────────────────────────────────────────
function u64(dv, off) {
  return dv.getUint32(off + 4, true) * 2 ** 32 + dv.getUint32(off, true);
}

function readHeader(buf) {
  if (buf.toString("utf8", 0, 7) !== "PMTiles") throw new Error("không phải PMTiles");
  const dv = new DataView(buf.buffer, buf.byteOffset, 127);
  if (dv.getUint8(7) !== 3) throw new Error("chỉ hỗ trợ PMTiles spec v3");
  return {
    rootOffset: u64(dv, 8),
    rootLength: u64(dv, 16),
    metaOffset: u64(dv, 24),
    metaLength: u64(dv, 32),
    leafOffset: u64(dv, 40),
    leafLength: u64(dv, 48),
    dataOffset: u64(dv, 56),
    dataLength: u64(dv, 64),
    addressed: u64(dv, 72),
    entries: u64(dv, 80),
    contents: u64(dv, 88),
    clustered: dv.getUint8(96) === 1,
    internalCompression: dv.getUint8(97),
    tileCompression: dv.getUint8(98),
    tileType: dv.getUint8(99),
    minZoom: dv.getUint8(100),
    maxZoom: dv.getUint8(101),
    minLon: dv.getInt32(102, true),
    minLat: dv.getInt32(106, true),
    maxLon: dv.getInt32(110, true),
    maxLat: dv.getInt32(114, true),
    centerZoom: dv.getUint8(118),
    centerLon: dv.getInt32(119, true),
    centerLat: dv.getInt32(123, true),
  };
}

function writeHeader(h) {
  const b = Buffer.alloc(127);
  b.write("PMTiles", 0, "utf8");
  const dv = new DataView(b.buffer, b.byteOffset, 127);
  dv.setUint8(7, 3);
  const put = (off, v) => {
    dv.setUint32(off, v >>> 0, true);
    dv.setUint32(off + 4, Math.floor(v / 2 ** 32), true);
  };
  put(8, h.rootOffset);
  put(16, h.rootLength);
  put(24, h.metaOffset);
  put(32, h.metaLength);
  put(40, h.leafOffset);
  put(48, h.leafLength);
  put(56, h.dataOffset);
  put(64, h.dataLength);
  put(72, h.addressed);
  put(80, h.entries);
  put(88, h.contents);
  dv.setUint8(96, h.clustered ? 1 : 0);
  dv.setUint8(97, h.internalCompression);
  dv.setUint8(98, h.tileCompression);
  dv.setUint8(99, h.tileType);
  dv.setUint8(100, h.minZoom);
  dv.setUint8(101, h.maxZoom);
  dv.setInt32(102, h.minLon, true);
  dv.setInt32(106, h.minLat, true);
  dv.setInt32(110, h.maxLon, true);
  dv.setInt32(114, h.maxLat, true);
  dv.setUint8(118, h.centerZoom);
  dv.setInt32(119, h.centerLon, true);
  dv.setInt32(123, h.centerLat, true);
  return b;
}

function decompress(buf, kind) {
  if (kind === 0 || kind === 1) return buf;
  if (kind === 2) return gunzipSync(buf);
  if (kind === 3) return brotliDecompressSync(buf);
  throw new Error(`kiểu nén ${kind} chưa hỗ trợ`);
}

function compress(buf, kind) {
  if (kind === 0 || kind === 1) return buf;
  if (kind === 2) return gzipSync(buf, { level: 9 });
  if (kind === 3) return brotliCompressSync(buf);
  throw new Error(`kiểu nén ${kind} chưa hỗ trợ`);
}

/** Thư mục PMTiles v3 → [{ tileId, offset, length, runLength }]. */
function readDirectory(buf) {
  const r = new Reader(buf);
  const n = r.varint();
  const out = [];
  let id = 0;
  for (let i = 0; i < n; i++) {
    id += r.varint();
    out.push({ tileId: id, offset: 0, length: 0, runLength: 1 });
  }
  for (let i = 0; i < n; i++) out[i].runLength = r.varint();
  for (let i = 0; i < n; i++) out[i].length = r.varint();
  for (let i = 0; i < n; i++) {
    const v = r.varint();
    out[i].offset = v === 0 && i > 0 ? out[i - 1].offset + out[i - 1].length : v - 1;
  }
  return out;
}

function writeDirectory(entries) {
  const w = new Writer();
  w.varint(entries.length);
  let prev = 0;
  for (const e of entries) {
    w.varint(e.tileId - prev);
    prev = e.tileId;
  }
  for (const e of entries) w.varint(e.runLength);
  for (const e of entries) w.varint(e.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const p = entries[i - 1];
    // 0 = "nối ngay sau ô trước" — đúng quy ước đọc ở `readDirectory`
    w.varint(i > 0 && e.offset === p.offset + p.length ? 0 : e.offset + 1);
  }
  return w.done();
}

// ── METADATA ──────────────────────────────────────────────────────────────
/** Gỡ lớp `boundaries` và mọi trường tên/ref khỏi TileJSON kèm archive. */
function cleanMetadata(meta) {
  if (!Array.isArray(meta.vector_layers)) return meta;
  return {
    ...meta,
    vector_layers: meta.vector_layers
      .filter((l) => !DROP_LAYER(l.id))
      .map((l) => ({
        ...l,
        fields: Object.fromEntries(
          Object.entries(l.fields || {}).filter(([k]) => !DROP_KEY(k)),
        ),
      })),
  };
}

// ── DỰNG LẠI ──────────────────────────────────────────────────────────────
function rebuild(src) {
  const h = readHeader(src);
  const root = readDirectory(decompress(src.subarray(h.rootOffset, h.rootOffset + h.rootLength), h.internalCompression));

  // Gom mọi entry lá (runLength > 0). Archive hiện tại không có thư mục lá
  // (leafLength = 0) nhưng vẫn đi theo lá cho đúng đặc tả — nếu sau này Protomaps
  // xuất file lớn hơn có lá thì script không âm thầm bỏ sót ô tile.
  const leaves = [];
  for (const e of root) {
    if (e.runLength > 0) {
      leaves.push(e);
      continue;
    }
    const dir = readDirectory(
      decompress(src.subarray(h.leafOffset + e.offset, h.leafOffset + e.offset + e.length), h.internalCompression),
    );
    for (const le of dir) leaves.push(le);
  }
  leaves.sort((a, b) => a.tileId - b.tileId);

  const stat = { layersDropped: 0, featuresDropped: 0, keysDropped: 0, valuesDropped: 0, tilesEmptied: 0 };
  const filteredBySrc = new Map(); // "offset:length" → Buffer đã nén lại (hoặc null)
  const byHash = new Map(); // hash → { offset, length }
  const chunks = [];
  const outEntries = [];
  let cursor = 0;
  let addressed = 0;

  for (const e of leaves) {
    const key = `${e.offset}:${e.length}`;
    let blob = filteredBySrc.get(key);
    if (blob === undefined) {
      const raw = src.subarray(h.dataOffset + e.offset, h.dataOffset + e.offset + e.length);
      const plain = decompress(raw, h.tileCompression);
      const filtered = filterTile(plain, stat);
      blob = filtered.length ? compress(filtered, h.tileCompression) : null;
      filteredBySrc.set(key, blob);
    }
    if (!blob) {
      // Ô chỉ chứa ranh giới → sau khi lọc không còn gì. Bỏ hẳn entry: pmtiles
      // trả "không có ô này", MapLibre coi như vùng trống — đúng thứ ta muốn.
      stat.tilesEmptied++;
      continue;
    }
    const hash = createHash("sha256").update(blob).digest("hex");
    let at = byHash.get(hash);
    if (!at) {
      at = { offset: cursor, length: blob.length };
      byHash.set(hash, at);
      chunks.push(blob);
      cursor += blob.length;
    }
    outEntries.push({ tileId: e.tileId, offset: at.offset, length: at.length, runLength: e.runLength });
    addressed += e.runLength;
  }

  const meta = JSON.parse(
    decompress(src.subarray(h.metaOffset, h.metaOffset + h.metaLength), h.internalCompression).toString("utf8"),
  );
  const metaBuf = compress(Buffer.from(JSON.stringify(cleanMetadata(meta)), "utf8"), h.internalCompression);
  const dirBuf = compress(writeDirectory(outEntries), h.internalCompression);

  // Thư mục gốc PHẢI nằm trọn trong 16.384 byte đầu file — thư viện `pmtiles`
  // chỉ đọc đúng chừng đó byte cho lượt mở đầu tiên. 842 entry nén lại ~2,4 KB,
  // còn rất xa trần; nếu một ngày nào đó vượt thì DỪNG chứ đừng ghi file mà
  // trình duyệt không mở nổi (lỗi sẽ hiện ngoài biển, không hiện ở đây).
  if (127 + dirBuf.length + metaBuf.length > 16384)
    throw new Error("thư mục gốc + metadata vượt 16 KB — cần tách thư mục lá, chưa cài");

  const header = writeHeader({
    ...h,
    rootOffset: 127,
    rootLength: dirBuf.length,
    metaOffset: 127 + dirBuf.length,
    metaLength: metaBuf.length,
    leafOffset: 127 + dirBuf.length + metaBuf.length,
    leafLength: 0,
    dataOffset: 127 + dirBuf.length + metaBuf.length,
    dataLength: cursor,
    addressed,
    entries: outEntries.length,
    contents: byHash.size,
    clustered: true,
  });

  return { buf: Buffer.concat([header, dirBuf, metaBuf, ...chunks]), stat, outEntries };
}

// ── CLI ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const outArg = argv.indexOf("--out");
const OUT = outArg >= 0 && argv[outArg + 1] ? path.resolve(argv[outArg + 1]) : SRC;

const src = readFileSync(SRC);
const before = statSync(SRC).size;
const t0 = Date.now();
const { buf, stat, outEntries } = rebuild(src);
const ms = Date.now() - t0;

console.log(
  `Lọc xong trong ${ms} ms:\n` +
    `  ô tile giữ lại : ${outEntries.length}\n` +
    `  ô tile bỏ hẳn  : ${stat.tilesEmptied} (chỉ chứa ranh giới)\n` +
    `  lớp boundaries : ${stat.layersDropped} lớp / ${stat.featuresDropped} đối tượng\n` +
    `  khoá nhãn      : ${stat.keysDropped} lượt gỡ (name*/ref*/shield_text*/network*)\n` +
    `  giá trị CJK sót: ${stat.valuesDropped} lượt gỡ (lưới an toàn)\n` +
    `  cỡ file        : ${(before / 1e6).toFixed(2)} MB → ${(buf.length / 1e6).toFixed(2)} MB ` +
    `(nhẹ đi ${(100 - (buf.length / before) * 100).toFixed(1)}%)`,
);

if (dry) console.log("--dry-run: KHÔNG ghi file.");
else {
  writeFileSync(OUT, buf);
  console.log(`Đã ghi ${path.relative(ROOT, OUT).replace(/\\/g, "/")}`);
  console.log("Nhớ: Lead phải BUMP `SDFISH_BASEMAP_V` trong public/sw.js — máy bà con đang giữ bản cũ trong kho.");
}
