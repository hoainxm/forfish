// scripts/audit-style.mjs — KIỂM KÊ CHI PHÍ VẼ CỦA STYLE BẢN ĐỒ (Trục 1)
//
// Chạy:  node scripts/audit-style.mjs            (bảng gọn)
//        node scripts/audit-style.mjs --full     (in đủ mọi lớp nền Protomaps)
//        node scripts/audit-style.mjs --json     (máy đọc)
//
// VÌ SAO CÓ: bà con dùng điện thoại phổ thông rẻ tiền, nhìn dưới nắng chói trên
// tàu lắc. Mỗi lớp thừa trong style là một lần lọc/1 lần vẽ cho MỖI Ô BẢN ĐỒ,
// MỖI KHUNG HÌNH. Trước khi cắt cái gì phải BIẾT nó tốn bao nhiêu — file này đo,
// không đoán.
//
// ĐO ĐƯỢC Ở NODE (mọi số dưới đây là số thật, đọc từ file trong repo):
//   · danh sách lớp cuối cùng của `buildMapStyle` (id/kiểu/nguồn/zoom/bộ lọc)
//   · lớp nào KHÔNG BAO GIỜ có dữ liệu để vẽ (đối chiếu source-layer + nấc zoom
//     thật trong vn-basemap.pmtiles, quét TOÀN BỘ ô của file)
//   · số đối tượng + số đỉnh hình học mỗi source-layer (quét thật từng ô MVT)
//   · số feature + số đỉnh của từng asset GeoJSON app tự vẽ
//   · độ phức tạp biểu thức trong filter/paint/layout (đếm nút, cờ per-feature)
//
// KHÔNG ĐO ĐƯỢC Ở NODE (đừng bịa — phải mở trình duyệt thật, xem mục cuối bảng):
//   · thời gian vẽ một khung hình (ms/frame), số khung rớt khi kéo bản đồ
//   · số lệnh vẽ GPU (draw call), thời gian shader, dung lượng VRAM
//   · thời gian worker parse ô MVT trên máy yếu
//   · thời gian bố trí nhãn (symbol layout) — thứ đắt nhất của MapLibre

import { readFileSync, statSync, openSync, readSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FULL = process.argv.includes("--full");
const AS_JSON = process.argv.includes("--json");

/* ------------------------------------------------------------------ tiện ích */
const R = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
const L = (s, n) => String(s ?? "").padStart(n);
const out = [];
const say = (s = "") => out.push(s);
const warns = [];
const warn = (tag, msg) => warns.push({ tag, msg });

/* ------------------------------------------------- 1. nạp buildMapStyle (TS) */
// `ocean-map.ts` là TypeScript + dùng alias `@/`. Không thêm dependency mới cho
// việc này (nguyên tắc 15 bậc 5): rolldown đã nằm sẵn trong node_modules vì
// vitest/vite kéo về. Bundle vào bộ nhớ rồi import — không sinh file rác.
async function loadOceanMap() {
  let rolldown;
  try {
    ({ rolldown } = await import("rolldown"));
  } catch {
    console.error(
      "Thiếu `rolldown` (thường có sẵn theo vite/vitest). Chạy `npm install` rồi thử lại.",
    );
    process.exit(1);
  }
  const b = await rolldown({
    input: path.join(ROOT, "src/lib/ocean-map.ts"),
    platform: "node",
    resolve: { alias: { "@": path.join(ROOT, "src") } },
    logLevel: "silent",
  });
  const { output } = await b.generate({ format: "esm" });
  const url =
    "data:text/javascript;base64," +
    Buffer.from(output[0].code).toString("base64");
  return import(url);
}

/* ------------------------------------------ 2. đọc PMTiles + quét ô MVT thật */
function pmtilesReader(file) {
  const fh = openSync(file, "r");
  return {
    getKey: () => file,
    getBytes: async (offset, length) => {
      const buf = Buffer.alloc(length);
      readSync(fh, buf, 0, length, offset);
      return {
        data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length),
      };
    },
  };
}

/* Bộ đọc protobuf tối thiểu cho Mapbox Vector Tile — chỉ những trường cần để
   ĐẾM: tên layer, số feature, tên thuộc tính, số đỉnh hình học. Viết tay ~70
   dòng thay vì thêm dependency @mapbox/vector-tile cho một script audit. */
function readVarint(buf, s) {
  let val = 0,
    shift = 0,
    i = s.i;
  for (;;) {
    const b = buf[i++];
    val += (b & 0x7f) * Math.pow(2, shift);
    if (b < 0x80) break;
    shift += 7;
  }
  s.i = i;
  return val;
}
function skipField(buf, s, wire) {
  if (wire === 0) readVarint(buf, s);
  else if (wire === 1) s.i += 8;
  else if (wire === 2) {
    // KHÔNG viết `s.i += readVarint(...)`: JS đọc vế trái TRƯỚC khi tính vế
    // phải, mà readVarint lại tự dời s.i ⇒ lệch đúng 1 byte, đủ để cả lần quét
    // ra số rác (đã dính lúc dựng file này).
    const n = readVarint(buf, s);
    s.i += n;
  } else if (wire === 5) s.i += 4;
  else throw new Error("wire " + wire);
}
/** Đếm đỉnh từ mảng lệnh hình học MVT (MoveTo/LineTo mang toạ độ). */
function countVertices(buf, start, end) {
  const s = { i: start };
  let v = 0;
  while (s.i < end) {
    const cmd = readVarint(buf, s);
    const id = cmd & 7,
      n = cmd >> 3;
    if (id === 7) continue; // ClosePath — không có tham số
    for (let k = 0; k < n * 2; k++) readVarint(buf, s);
    v += n;
  }
  return v;
}
/** Quét 1 ô MVT → { layerName: { features, vertices, keys:Set, perZoom, max } } */
function scanTile(buf, acc, z) {
  const s = { i: 0 };
  while (s.i < buf.length) {
    const tag = readVarint(buf, s);
    const f = tag >> 3,
      wire = tag & 7;
    if (f !== 3 || wire !== 2) {
      skipField(buf, s, wire);
      continue;
    }
    const len = readVarint(buf, s);
    const end = s.i + len;
    let name = null;
    const keys = [];
    const vals = [];
    let feats = 0,
      verts = 0;
    const types = new Set();
    const ls = { i: s.i };
    while (ls.i < end) {
      const ltag = readVarint(buf, ls);
      const lf = ltag >> 3,
        lw = ltag & 7;
      if (lf === 1 && lw === 2) {
        const n = readVarint(buf, ls);
        name = buf.toString("utf8", ls.i, ls.i + n);
        ls.i += n;
      } else if (lf === 3 && lw === 2) {
        const n = readVarint(buf, ls);
        keys.push(buf.toString("utf8", ls.i, ls.i + n));
        ls.i += n;
      } else if (lf === 4 && lw === 2) {
        // Value — chỉ lấy string_value (field 1). Cần để trả lời câu hỏi thật:
        // "lớp lọc kind=zoo có bao giờ trúng cái gì không?"
        const n = readVarint(buf, ls);
        const vend = ls.i + n;
        const vs = { i: ls.i };
        while (vs.i < vend) {
          const vt = readVarint(buf, vs);
          if ((vt >> 3) === 1 && (vt & 7) === 2) {
            const sn = readVarint(buf, vs);
            vals.push(buf.toString("utf8", vs.i, vs.i + sn));
            vs.i += sn;
          } else skipField(buf, vs, vt & 7);
        }
        ls.i = vend;
      } else if (lf === 2 && lw === 2) {
        feats++;
        const n = readVarint(buf, ls);
        const fend = ls.i + n;
        const fs = { i: ls.i };
        while (fs.i < fend) {
          const ftag = readVarint(buf, fs);
          const ff = ftag >> 3,
            fw = ftag & 7;
          if (ff === 3 && fw === 0) types.add(readVarint(buf, fs));
          else if (ff === 4 && fw === 2) {
            const gn = readVarint(buf, fs);
            verts += countVertices(buf, fs.i, fs.i + gn);
            fs.i += gn;
          } else skipField(buf, fs, fw);
        }
        ls.i = fend;
      } else skipField(buf, ls, lw);
    }
    if (name) {
      const a = (acc[name] ??= {
        features: 0,
        vertices: 0,
        bytes: 0,
        keys: new Set(),
        vals: new Set(),
        types: new Set(),
        tiles: 0,
        maxFeatures: 0,
        maxVertices: 0,
        perZoom: {},
      });
      a.features += feats;
      a.vertices += verts;
      a.bytes += len; // byte GIẢI NÉN của riêng layer này, cộng qua mọi ô
      a.tiles++;
      a.maxFeatures = Math.max(a.maxFeatures, feats);
      a.maxVertices = Math.max(a.maxVertices, verts);
      const pz = (a.perZoom[z] ??= { tiles: 0, features: 0, vertices: 0 });
      pz.tiles++;
      pz.features += feats;
      pz.vertices += verts;
      for (const k of keys) a.keys.add(k);
      for (const v of vals) a.vals.add(v);
      for (const t of types) a.types.add(t);
    }
    s.i = end;
  }
}

async function scanPmtiles(file) {
  const { PMTiles } = await import("pmtiles");
  const { gunzipSync } = await import("node:zlib");
  const p = new PMTiles(pmtilesReader(file));
  const header = await p.getHeader();
  const meta = await p.getMetadata();
  const byLayer = {};
  const byZoom = {}; // z → { tiles, bytes }
  const badTiles = [];
  // Quét TOÀN BỘ ô của file (tileset nhỏ — 982 ô), không lấy mẫu ⇒ số thật.
  for (let z = header.minZoom; z <= header.maxZoom; z++) {
    const n = 1 << z;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        let t;
        try {
          t = await p.getZxy(z, x, y);
        } catch {
          continue;
        }
        if (!t) continue;
        const raw = Buffer.from(t.data);
        const zz = (byZoom[z] ??= { tiles: 0, bytes: 0 });
        zz.tiles++;
        zz.bytes += raw.length;
        let buf = raw;
        if (raw[0] === 0x1f && raw[1] === 0x8b) buf = gunzipSync(raw);
        try {
          scanTile(buf, byLayer, z);
        } catch (e) {
          badTiles.push(`${z}/${x}/${y}: ${e.message}`);
        }
      }
    }
  }
  return { header, meta, byLayer, byZoom, badTiles, bytes: statSync(file).size };
}

/* --------------------------------- 3. chấm điểm biểu thức trong filter/paint */
const PER_FEATURE_OPS = new Set([
  "get",
  "has",
  "properties",
  "feature-state",
  "geometry-type",
  "id",
  "in",
  "!has",
  "!in",
]);
/** Đếm nút + phát hiện biểu thức chạy theo TỪNG ĐỐI TƯỢNG / theo ZOOM. */
function exprStat(e, st = { nodes: 0, perFeature: 0, zoom: 0, ops: {} }) {
  if (Array.isArray(e)) {
    st.nodes++;
    const op = typeof e[0] === "string" ? e[0] : null;
    if (op) {
      st.ops[op] = (st.ops[op] ?? 0) + 1;
      if (PER_FEATURE_OPS.has(op)) st.perFeature++;
      if (op === "zoom") st.zoom++;
    }
    for (const c of e) exprStat(c, st);
  } else if (e && typeof e === "object") {
    for (const k of Object.keys(e)) exprStat(e[k], st);
  }
  return st;
}
/*  LỚP CHẾT — chứng minh bằng DỮ LIỆU THẬT, không suy đoán.
    Một điều kiện BẮT BUỘC (nằm trực tiếp trong `all` hoặc là cả bộ lọc) mà
    tham chiếu thuộc tính / giá trị KHÔNG HỀ TỒN TẠI trong source-layer đó ⇒ bộ
    lọc không bao giờ đúng ⇒ lớp không bao giờ vẽ ra gì.
    Chỉ xét cú pháp filter cũ của Protomaps: ["has",K] · ["==",K,V] · ["in",K,…] */
function deadByFilter(filter, layerStat) {
  if (!filter || !layerStat) return "";
  const conj = filter[0] === "all" ? filter.slice(1) : [filter];
  for (const c of conj) {
    if (!Array.isArray(c) || typeof c[1] !== "string" || c[1].startsWith("$"))
      continue;
    const [op, key, ...vs] = c;
    if (op === "has" && !layerStat.keys.has(key))
      return `bộ lọc đòi thuộc tính "${key}" — nền KHÔNG có thuộc tính này ở bất kỳ ô nào`;
    if (!layerStat.keys.has(key) && (op === "==" || op === "in"))
      return `bộ lọc đòi thuộc tính "${key}" — nền KHÔNG có thuộc tính này`;
    if (
      (op === "==" || op === "in") &&
      vs.length &&
      vs.every((v) => typeof v === "string" && !layerStat.vals.has(v))
    )
      return `giá trị ${vs.map((v) => `"${v}"`).join("/")} của "${key}" KHÔNG xuất hiện ở đâu trong nền`;
  }
  return "";
}

/** Bề rộng nhánh lớn nhất của `match` (mảng dài = so sánh tuyến tính lúc chạy) */
function widestMatch(e, best = 0) {
  if (!Array.isArray(e)) return best;
  if (e[0] === "match") {
    for (let i = 2; i < e.length - 1; i += 2)
      if (Array.isArray(e[i])) best = Math.max(best, e[i].length);
  }
  for (const c of e) if (Array.isArray(c)) best = widestMatch(c, best);
  return best;
}

/* -------------------------------- 4. quét lớp khai bằng JSX trong component */
/** Đọc `<Layer …/>` trong file .tsx — đo lớp app KHÔNG nằm trong buildMapStyle. */
function scanJsxLayers(file) {
  const src = readFileSync(file, "utf8");
  const res = [];
  let i = 0;
  while ((i = src.indexOf("<Layer", i)) !== -1) {
    // đọc tới `/>` ở độ sâu ngoặc nhọn = 0 (bỏ qua `/>` nằm trong biểu thức)
    let d = 0,
      j = i + 6,
      end = -1;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "{") d++;
      else if (c === "}") d--;
      else if (c === "/" && src[j + 1] === ">" && d === 0) {
        end = j;
        break;
      }
    }
    if (end === -1) break;
    const body = src.slice(i, end);
    const id = /\bid=(?:"([^"]+)"|\{`([^`]+)`\}|\{([^}]+)\})/.exec(body);
    const type = /\btype="([^"]+)"/.exec(body);
    res.push({
      id: (() => {
        if (!id) return "(không đọc được)";
        const raw = (id[1] ?? id[2] ?? id[3]).trim();
        if (id[1] || id[2]) return raw.replace(/\$\{sid\}/, "vms-<zone>");
        // `id={id}` = lớp sinh trong .map(...) — một <Layer> bung thành N lớp
        // lúc chạy. Không đoán N, chỉ nói rõ là động.
        return `(động: ${raw})`;
      })(),
      type: type ? type[1] : "?",
      hasFilter: /\bfilter=/.test(body),
      minzoom: /\bminzoom=\{([\d.]+)\}/.exec(body)?.[1] ?? null,
      // tô trong suốt = chồng lớp (overdraw): pixel bị vẽ nhiều lần
      translucentFill:
        /"fill-opacity":\s*(0(\.\d+)?)/.test(body) ||
        /"fill-color":\s*\["get"/.test(body),
      exprCount: (body.match(/\["(get|match|case|step|interpolate)"/g) ?? [])
        .length,
      file: path.basename(file),
    });
    i = end;
  }
  return res;
}

/* --------------------------------------- 5. đọc asset GeoJSON app tự vẽ */
function geojsonStat(rel) {
  const file = path.join(ROOT, "public", rel.replace(/^\//, ""));
  let j;
  try {
    j = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  let feats = 0,
    verts = 0;
  const types = {};
  const walkCoords = (c) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number") verts++;
    else for (const x of c) walkCoords(x);
  };
  const one = (f) => {
    feats++;
    const t = f.geometry?.type ?? "?";
    types[t] = (types[t] ?? 0) + 1;
    walkCoords(f.geometry?.coordinates);
  };
  if (j.type === "FeatureCollection") j.features.forEach(one);
  else if (j.type === "Feature") one(j);
  else return { file, bytes: statSync(file).size, raw: true };
  return { file, bytes: statSync(file).size, feats, verts, types };
}

/* =========================================================== CHẠY */
const om = await loadOceanMap();
const NOW = new Date("2026-08-30T00:00:00Z");

/* --- 5.1 số lớp theo từng tổ hợp lớp bản đồ ------------------------------- */
const combos = [
  ["hải đồ + báo hiệu (MẶC ĐỊNH mở app)", "bathymetry", true],
  ["hải đồ, tắt báo hiệu", "bathymetry", false],
  ["nước nóng lạnh (sst)", "sst", true],
  ["vùng nhiều mồi (chl)", "chlorophyll", true],
  ["chỉ nền (layerId=null)", null, true],
];
const styles = combos.map(([label, id, sm]) => ({
  label,
  id,
  style: om.buildMapStyle(id, NOW, { seamarks: sm }),
}));
const main = styles[0].style;

const APP_IDS = new Set([
  "sea-bg",
  "sea-mask",
  "base-top",
  "ocean-data",
  "isobath-lines",
  "isobath-labels",
  "seamarks",
]);
const baseLayers = main.layers.filter((l) => !APP_IDS.has(l.id));
const appLayers = main.layers.filter((l) => APP_IDS.has(l.id));

/* --- 5.2 quét nền PMTiles ------------------------------------------------- */
const PM = path.join(ROOT, "public/data/vn-basemap.pmtiles");
let pm = null;
try {
  pm = await scanPmtiles(PM);
} catch (e) {
  warn("PMTILES", `Không đọc được ${PM}: ${e.message}`);
}

/* --- 5.3 quét lớp JSX ----------------------------------------------------- */
const jsx = [
  ...scanJsxLayers(path.join(ROOT, "src/components/fishing-map-view.tsx")),
  ...scanJsxLayers(path.join(ROOT, "src/components/route-planner.tsx")),
];

/* --- 5.4 asset GeoJSON ---------------------------------------------------- */
const ASSETS = [
  ["/data/isobaths.v1.json", "đẳng sâu (isobath-lines + isobath-labels)"],
  ["/data/seamarks.v1.json", "báo hiệu (seamark-far/mid/near)"],
  ["/data/vn-islands.v1.json", "đảo (island-dot + island-label)"],
  ["/data/coral-reefs.v1.json", "tên rạn (reef-dot + reef-label)"],
  ["/data/reef-shapes.v1.json", "hình rạn (reef-fill/outline/hazard)"],
  ["/data/vn-sea-lanes.v1.json", "tuyến/luồng (6 lớp sea-lane-*)"],
  ["/data/vn-coast.v1.json", "bờ offline / overlay-coast"],
];
const assetStats = ASSETS.map(([u, note]) => ({
  url: u,
  note,
  ...(geojsonStat(u) ?? {}),
}));

/* =========================================================== IN BẢNG */
say("╔══════════════════════════════════════════════════════════════════════════╗");
say("║  KIỂM KÊ CHI PHÍ VẼ — style bản đồ Ra khơi (SDFish)                       ║");
say("╚══════════════════════════════════════════════════════════════════════════╝");
say(`nguồn: src/lib/ocean-map.ts · ngày dựng style: ${NOW.toISOString().slice(0, 10)}`);
say("");

say("── A. SỐ LỚP THEO TỔ HỢP ───────────────────────────────────────────────────");
say(
  `${R("tổ hợp", 38)}${L("tổng", 6)}${L("nền", 6)}${L("app", 6)}${L("symbol", 8)}${L("fill", 6)}${L("line", 6)}`,
);
for (const s of styles) {
  const t = {};
  for (const l of s.style.layers) t[l.type] = (t[l.type] ?? 0) + 1;
  const napp = s.style.layers.filter((l) => APP_IDS.has(l.id)).length;
  say(
    `${R(s.label, 38)}${L(s.style.layers.length, 6)}${L(s.style.layers.length - napp, 6)}${L(napp, 6)}${L(t.symbol ?? 0, 8)}${L(t.fill ?? 0, 6)}${L(t.line ?? 0, 6)}`,
  );
}
say("");

/* --- nền PMTiles: có gì thật trong file ----------------------------------- */
if (pm) {
  say("── B. NỀN vn-basemap.pmtiles — CÓ GÌ THẬT TRONG FILE ───────────────────────");
  say(
    `file ${(pm.bytes / 1048576).toFixed(1)} MB · zoom ${pm.header.minZoom}–${pm.header.maxZoom} · ${Object.values(pm.byZoom).reduce((a, b) => a + b.tiles, 0)} ô`,
  );
  say(
    `${R("source-layer", 13)}${L("khai(z)", 9)}${L("feature", 9)}${L("đỉnh", 9)}${L("KB(giải nén)", 14)}${L("f/ô z9", 8)}${L("ô đông nhất", 13)}`,
  );
  const declared = Object.fromEntries(
    (pm.meta.vector_layers ?? []).map((v) => [
      v.id,
      `${v.minzoom ?? "?"}-${v.maxzoom ?? "?"}`,
    ]),
  );
  const allSl = new Set([...Object.keys(declared), ...Object.keys(pm.byLayer)]);
  const avg = (a, z) =>
    a?.perZoom?.[z] ? (a.perZoom[z].features / a.perZoom[z].tiles).toFixed(1) : "0";
  for (const sl of [...allSl].sort()) {
    const a = pm.byLayer[sl];
    say(
      `${R(sl, 13)}${L(declared[sl] ?? "-", 9)}${L(a?.features ?? 0, 9)}${L(a?.vertices ?? 0, 9)}${L(((a?.bytes ?? 0) / 1024).toFixed(0), 14)}${L(avg(a, 9), 8)}${L(a?.maxFeatures ?? 0, 13)}` +
        (a ? "" : "   ⚠ KHÔNG CÓ Ô NÀO"),
    );
  }
  for (const sl of [...allSl].sort()) {
    const a = pm.byLayer[sl];
    if (a) {
      say(`   ${R(sl, 12)} thuộc tính: ${[...a.keys].sort().join(", ")}`);
      const v = [...a.vals].sort();
      if (v.length && v.length <= 60)
        say(`   ${R("", 12)} giá trị chữ: ${v.join(", ")}`);
      else if (v.length) say(`   ${R("", 12)} giá trị chữ: ${v.length} giá trị`);
    }
  }
  if (pm.badTiles.length)
    say(`   ⚠ ${pm.badTiles.length} ô không đọc được: ${pm.badTiles.slice(0, 3).join(" · ")}`);
  say("");

  /*  B2 — CHI PHÍ LỌC MỖI Ô. MapLibre dựng bucket riêng cho MỖI lớp style;
      mỗi lớp phải chạy filter của nó trên MỌI đối tượng của source-layer đó
      trong ô. Số dưới = (số lớp style dùng source-layer) × (số đối tượng
      trung bình / ô). Đây là số phép lọc mỗi lần nạp một ô — không phải mỗi
      khung hình (parse chỉ chạy 1 lần/ô), nhưng nó là thứ làm nghẽn worker
      lúc bà con kéo bản đồ. */
  say("── B2. CHI PHÍ LỌC KHI NẠP MỘT Ô (số lớp × số đối tượng) ──────────────────");
  say(
    `${R("source-layer", 13)}${L("số lớp", 8)}${L("đtượng/ô z9", 13)}${L("phép lọc/ô", 12)}${L("ô tệ nhất", 11)}`,
  );
  const perSl = {};
  for (const l of main.layers)
    if (l["source-layer"]) perSl[l["source-layer"]] = (perSl[l["source-layer"]] ?? 0) + 1;
  const b2 = Object.entries(perSl)
    .map(([sl, n]) => {
      const a = pm.byLayer[sl];
      const f = a?.perZoom?.[9] ? a.perZoom[9].features / a.perZoom[9].tiles : 0;
      return { sl, n, f, worst: (a?.maxFeatures ?? 0) * n, cost: f * n };
    })
    .sort((a, b) => b.cost - a.cost);
  for (const r of b2)
    say(
      `${R(r.sl, 13)}${L(r.n, 8)}${L(r.f.toFixed(1), 13)}${L(Math.round(r.cost), 12)}${L(r.worst, 11)}`,
    );
  say(
    `TỔNG: ${Math.round(b2.reduce((a, r) => a + r.cost, 0))} phép lọc cho một ô z9 điển hình · ${b2.reduce((a, r) => a + r.worst, 0)} cho ô đông nhất`,
  );
  say("");
}

/* --- bảng lớp chi tiết ----------------------------------------------------- */
const slPresent = pm ? new Set(Object.keys(pm.byLayer)) : null;
const rows = [];
for (const l of main.layers) {
  const st = exprStat([l.filter, l.paint, l.layout]);
  const sl = l["source-layer"] ?? null;
  const feats = sl && pm?.byLayer[sl] ? pm.byLayer[sl].features : null;
  const dead =
    sl && slPresent && !slPresent.has(sl)
      ? "source-layer KHÔNG CÓ Ô NÀO trong nền"
      : sl && pm?.byLayer[sl]
        ? deadByFilter(l.filter, pm.byLayer[sl])
        : "";
  rows.push({
    id: l.id,
    type: l.type,
    source: l.source ?? "(style)",
    sl,
    zoom: `${l.minzoom ?? 0}-${l.maxzoom ?? 24}`,
    filter: l.filter ? JSON.stringify(l.filter) : "",
    nodes: st.nodes,
    perFeature: st.perFeature,
    zoomExpr: st.zoom,
    zoomInFilter: exprStat(l.filter).zoom,
    match: widestMatch([l.filter, l.paint, l.layout]),
    feats,
    dead,
    app: APP_IDS.has(l.id),
  });
}

say("── C. TỪNG LỚP TRONG STYLE (tổ hợp mặc định) ───────────────────────────────");
say(
  `${R("#", 3)}${R("id", 30)}${R("kiểu", 11)}${R("source-layer", 12)}${R("zoom", 8)}${L("nút-bt", 7)}${L("/đtượng", 8)}  ghi chú`,
);
let hidden = 0;
rows.forEach((r, i) => {
  const boring =
    !r.app && !r.dead && r.type === "line" && r.id.startsWith("roads_");
  if (boring && !FULL) {
    hidden++;
    return;
  }
  const note = [
    r.dead ? "⚠ " + r.dead : "",
    r.type === "symbol" ? "SYMBOL (bố trí nhãn — đắt nhất)" : "",
    r.perFeature ? `${r.perFeature} phép/đối-tượng` : "",
    // ["match"] KHÔNG đắt theo bề rộng: MapLibre dựng bảng băm `cases` rồi tra
    // O(1) (đọc thẳng trong maplibre-gl-dev.js class Match.evaluate). Ghi ra
    // cho biết, KHÔNG coi là cảnh báo — kẻo đi "tối ưu" nhầm chỗ.
    r.match ? `match ${r.match} nhánh (tra O(1), không đắt)` : "",
    r.zoomInFilter ? `["zoom"] TRONG filter` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  say(
    `${R(i, 3)}${R(r.id, 30)}${R(r.type, 11)}${R(r.sl ?? "-", 12)}${R(r.zoom, 8)}${L(r.nodes, 7)}${L(r.perFeature, 8)}  ${note}`,
  );
});
if (hidden)
  say(`   … ẩn ${hidden} lớp roads_* của nền (chạy với --full để xem đủ)`);
say("");

/* --- lớp app khai bằng JSX ------------------------------------------------- */
say("── D. LỚP APP KHAI BẰNG JSX (ngoài buildMapStyle) ──────────────────────────");
say(
  `${R("id", 26)}${R("kiểu", 9)}${R("file", 24)}${L("minz", 6)}${L("lọc", 5)}${L("bt", 4)}  ghi chú`,
);
for (const j of jsx) {
  const note = [
    j.type === "symbol" ? "SYMBOL (bố trí nhãn)" : "",
    j.translucentFill ? "tô trong suốt → chồng lớp" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  say(
    `${R(j.id, 26)}${R(j.type, 9)}${R(j.file, 24)}${L(j.minzoom ?? "-", 6)}${L(j.hasFilter ? "có" : "-", 5)}${L(j.exprCount, 4)}  ${note}`,
  );
}
const jsxTypes = {};
for (const j of jsx) jsxTypes[j.type] = (jsxTypes[j.type] ?? 0) + 1;
say(
  `tổng ${jsx.length} lớp JSX — ${Object.entries(jsxTypes)
    .map(([k, v]) => `${k}:${v}`)
    .join(" · ")}`,
);
const dyn = jsx.filter((j) => j.id.startsWith("(động"));
if (dyn.length)
  say(
    `⚠ ${dyn.length} khai báo động (id={…}) — MỘT <Layer> bung thành NHIỀU lớp lúc chạy ` +
      `(vd seamark-far/mid/near, và mỗi vùng VMS admin bật là thêm 1–2 lớp) ⇒ con số dưới là SÀN, không phải trần.`,
  );
say(
  `⇒ SÀN thực tế khi bật hết: ${main.layers.length} (style) + ${jsx.length} (JSX) = ${main.layers.length + jsx.length} lớp`,
);
say("");

/* --- asset GeoJSON --------------------------------------------------------- */
say("── E. ASSET GEOJSON APP TỰ VẼ ──────────────────────────────────────────────");
say(
  `${R("file", 30)}${L("KB", 8)}${L("feature", 9)}${L("đỉnh", 9)}  hình học / dùng cho`,
);
for (const a of assetStats) {
  if (!a.bytes) {
    say(`${R(a.url, 30)}   (không đọc được)`);
    continue;
  }
  const t = a.types
    ? Object.entries(a.types)
        .map(([k, v]) => `${k}×${v}`)
        .join(",")
    : "(không phải FeatureCollection)";
  say(
    `${R(a.url, 30)}${L((a.bytes / 1024).toFixed(0), 8)}${L(a.feats ?? "-", 9)}${L(a.verts ?? "-", 9)}  ${t} — ${a.note}`,
  );
}
say("");

/*  E2 — BÁO HIỆU: 3 lớp circle chia theo nấc zoom bằng ["match"] trên `t`.
    Đo THẬT xem mỗi nấc gánh bao nhiêu điểm, để biết lớp nào là lớp nặng. */
try {
  const sm = JSON.parse(
    readFileSync(path.join(ROOT, "public/data/seamarks.v1.json"), "utf8"),
  );
  const src = readFileSync(
    path.join(ROOT, "src/components/fishing-map-view.tsx"),
    "utf8",
  );
  const arr = (name) => {
    const m = new RegExp(`const ${name} = \\[([^\\]]*)\\]`, "s").exec(src);
    return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
  };
  const FAR = new Set(arr("SEAMARK_FAR"));
  const MID = new Set(arr("SEAMARK_MID"));
  const cnt = { far: 0, mid: 0, near: 0 };
  for (const m of sm.marks) {
    const t = sm.types[m[2]];
    cnt[FAR.has(t) ? "far" : MID.has(t) ? "mid" : "near"]++;
  }
  say("── E2. BÁO HIỆU HÀNG HẢI — CHIA THEO NẤC ZOOM (đo thật) ────────────────────");
  say(`tổng ${sm.marks.length} điểm · ${sm.types.length} loại`);
  say(
    `  seamark-far  (z≥9 , ${FAR.size} loại): ${L(cnt.far, 5)} điểm — ${((cnt.far / sm.marks.length) * 100).toFixed(1)}%`,
  );
  say(
    `  seamark-mid  (z≥11, ${MID.size} loại): ${L(cnt.mid, 5)} điểm — ${((cnt.mid / sm.marks.length) * 100).toFixed(1)}%`,
  );
  say(
    `  seamark-near (z≥13, còn lại)        : ${L(cnt.near, 5)} điểm — ${((cnt.near / sm.marks.length) * 100).toFixed(1)}%`,
  );
  say(
    `  ⇒ ba lớp đọc CHUNG một nguồn ⇒ mỗi ô bị lọc BA LẦN trên đúng tập điểm của nó;`,
  );
  say(
    `    cộng dồn cả vùng là ${sm.marks.length * 3} lượt lọc, trong khi ở z9 chỉ ${cnt.far} điểm (${((cnt.far / sm.marks.length) * 100).toFixed(0)}%) được vẽ ra.`,
  );
  say("");
} catch {
  say("(E2: không đọc được seamarks.v1.json)");
}

/* =========================================================== CẢNH BÁO */
for (const r of rows)
  if (r.dead) warn("LỚP CHẾT", `${r.id} (${r.sl}) — ${r.dead}`);

// source-layer khai trong metadata mà KHÔNG lớp style nào dùng = byte thừa
if (pm) {
  const used = new Set(main.layers.map((l) => l["source-layer"]).filter(Boolean));
  for (const v of pm.meta.vector_layers ?? [])
    if (!used.has(v.id))
      warn(
        "BYTE THỪA",
        `source-layer "${v.id}" có trong nền nhưng KHÔNG lớp style nào dùng — ${pm.byLayer[v.id]?.features ?? 0} feature nằm trong file để tải rồi vứt`,
      );
}

// biểu thức đắt
for (const r of [...rows, ...jsx.map((j) => ({ ...j, nodes: j.exprCount }))]) {
  if (r.zoomInFilter)
    warn(
      "BIỂU THỨC",
      `${r.id} — ["zoom"] nằm TRONG filter ⇒ bộ lọc phải chạy lại cho MỌI đối tượng mỗi khi ô được dựng ở một mức zoom nguyên khác (maplibre-gl-dev.js: populate() gọi filter với new EvaluationParameters(this.zoom)). Nguồn GeoJSON như isobaths bị cắt ô lại ở từng mức ⇒ tính lại từ đầu mỗi nấc.`,
    );
}

// symbol
const nSym =
  main.layers.filter((l) => l.type === "symbol").length +
  jsx.filter((j) => j.type === "symbol").length;
warn(
  "SYMBOL",
  `${nSym} lớp symbol khi bật hết — mỗi lớp là một lượt bố trí nhãn + tránh chồng chữ, thứ đắt nhất của MapLibre`,
);

// chồng lớp tô trong suốt
const nTrans = jsx.filter((j) => j.translucentFill).length;
warn(
  "CHỒNG LỚP",
  `${nTrans} lớp fill tô trong suốt (overdraw) — pixel biển bị vẽ lại nhiều lần khi bật nhiều lớp cùng lúc`,
);

const deadRows = rows.filter((r) => r.dead);
const deadCost = deadRows.reduce(
  (a, r) => a + (pm?.byLayer[r.sl]?.perZoom?.[9]
    ? pm.byLayer[r.sl].perZoom[9].features / pm.byLayer[r.sl].perZoom[9].tiles
    : 0),
  0,
);
say("── F. TÓM TẮT ──────────────────────────────────────────────────────────────");
say(
  `LỚP KHÔNG BAO GIỜ VẼ RA GÌ: ${deadRows.length}/${main.layers.length} lớp trong style ` +
    `(${((deadRows.length / main.layers.length) * 100).toFixed(0)}%) — ` +
    `bỏ đi tiết kiệm ~${Math.round(deadCost)} phép lọc mỗi ô z9, 0 thay đổi hình ảnh`,
);
say(
  `LỚP CÒN SỐNG của nền: ${54 - deadRows.filter((r) => !r.app).length} · lớp app trong style: ${appLayers.length} · lớp app khai JSX: ${jsx.length}`,
);
say("");
say("── CẢNH BÁO ────────────────────────────────────────────────────────────────");
for (const w of warns) say(`[${R(w.tag, 10)}] ${w.msg}`);
say("");

say("── G. KHÔNG ĐO ĐƯỢC Ở NODE (phải mở trình duyệt thật) ──────────────────────");
say("  · ms/khung hình khi kéo–zoom bản đồ (Performance panel, CPU throttle 4–6×)");
say("  · số lệnh vẽ GPU mỗi khung (WebGL Insights / spector.js)");
say("  · thời gian worker parse ô MVT trên máy yếu (Performance → Worker track)");
say("  · thời gian bố trí nhãn symbol (chỉ hiện trong trace, không suy ra được)");
say("  · dung lượng VRAM / texture của lớp raster");
say("  ⇒ Số ở trên là ĐẦU VÀO của chi phí (bao nhiêu lớp, bao nhiêu đối tượng,");
say("     bao nhiêu phép tính mỗi đối tượng), KHÔNG phải thời gian vẽ.");

if (AS_JSON)
  console.log(
    JSON.stringify(
      {
        combos: styles.map((s) => ({ label: s.label, layers: s.style.layers.length })),
        layers: rows,
        jsxLayers: jsx,
        assets: assetStats,
        pmtiles: pm && {
          bytes: pm.bytes,
          minZoom: pm.header.minZoom,
          maxZoom: pm.header.maxZoom,
          byLayer: Object.fromEntries(
            Object.entries(pm.byLayer).map(([k, v]) => [
              k,
              {
                tiles: v.tiles,
                features: v.features,
                vertices: v.vertices,
                keys: [...v.keys],
              },
            ]),
          ),
        },
        warnings: warns,
      },
      null,
      2,
    ),
  );
else console.log(out.join("\n"));
