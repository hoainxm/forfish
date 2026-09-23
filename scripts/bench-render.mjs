/*
  ĐO TỐC ĐỘ HIỂN THỊ BẢN ĐỒ — chạy trên dữ liệu THẬT trong public/data và trên
  MÃ THẬT trong src/lib.

    node scripts/bench-render.mjs           # đủ 7 phần
    node scripts/bench-render.mjs 1 4       # chỉ phần 1 và 4

  ── VÌ SAO CÓ FILE NÀY ───────────────────────────────────────────────────────
  Chủ dự án muốn bản đồ hiện nhanh hơn. Trước khi tối ưu bất cứ thứ gì, phải
  biết THỜI GIAN ĐANG ĐI ĐÂU. Không có bộ đo thì mọi lời "cái này chắc chậm" chỉ
  là đoán, và tối ưu theo lời đoán thì hay sửa đúng chỗ không tốn.

  File này KHÔNG sửa gì, KHÔNG sinh asset, KHÔNG ghi vào public/. Nó chỉ đọc dữ
  liệu đang phát hành + mã đang chạy rồi in bảng số.

  ── KHÁC GÌ scripts/bench-map-method.mjs ─────────────────────────────────────
  `bench-map-method.mjs` đo BYTE và ĐỘ RÕ — "gửi bao nhiêu qua sóng, nhìn có rõ
  không". File này đo THỜI GIAN CPU và RAM — "máy phải làm bao lâu sau khi byte
  đã về tới nơi". Hai câu hỏi khác nhau, hai bộ đo khác nhau. Phần đọc PMTiles
  ở đây mượn lại `FileSource` cùng khuôn với bench-map-method (cùng thư viện
  `pmtiles` app đang dùng) — cố ý giống để hai bộ số so được với nhau.

  ── TRUNG THỰC: ĐO ĐƯỢC GÌ Ở NODE, KHÔNG ĐO ĐƯỢC GÌ ─────────────────────────
  ĐO ĐƯỢC (mã y hệt cái chạy trên máy bà con):
   · giải mã reef-bin (src/lib/reef-bin.mjs — CÙNG file app import)
   · JSON.parse của các asset GeoJSON
   · dựng chỉ mục ô của MapLibre: `@maplibre/geojson-vt` với ĐÚNG tham số
     MapLibre truyền (đọc ra từ node_modules/maplibre-gl, xem GEOJSONVT_OPTS)
   · structured-clone qua ranh giới luồng (worker_threads) — cùng thuật toán
     structured-clone mà `postMessage` của trình duyệt dùng
   · đọc header + ô của vn-basemap.pmtiles bằng chính thư viện `pmtiles`
   · `buildMapStyle` từ src/lib/ocean-map.ts (dịch TS tại chỗ, KHÔNG chép tay)

  KHÔNG ĐO ĐƯỢC Ở NODE — cần trình duyệt thật, đừng bịa số:
   · thời gian WebGL: nạp shader, dựng texture, vẽ khung hình đầu tiên
   · dựng bucket/atlas ký tự của MapLibre (cần canvas + WebGL context)
   · thời gian bố trí nhãn (symbol layout) — dính đo chữ trên canvas
   · chi phí THẬT của `postMessage` trình duyệt (Node dùng structured-clone
     cùng thuật toán nhưng khác cài đặt; số ở đây là bậc độ lớn, không phải
     con số của Chrome trên máy bà con)
   · service worker: `caches.match` + `Response.arrayBuffer()` trên 13,8 MB
   · giải nén gzip của ô PMTiles khi trình duyệt tự làm (`DecompressionStream`)
   · thời gian phân tích + biên dịch JS của chính bundle maplibre-gl

  ── TRUNG THỰC: MÁY DEV ≠ MÁY BÀ CON ────────────────────────────────────────
  Mọi con số ms ở đây đo trên máy dev. Phần 6 quy đổi sang điện thoại phổ thông
  bằng hệ số có nguồn — nhưng đó là ƯỚC LƯỢNG, không phải phép đo. Đọc phần 6
  trước khi trích bất kỳ con số nào ra ngoài.
*/

import { readFileSync, statSync, openSync, readSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { PMTiles } from "pmtiles";
import { decodeReefShapes } from "../src/lib/reef-bin.mjs";

const ROOT = process.cwd();
const DATA = join(ROOT, "public", "data");
const MB = 1024 * 1024;

/* ══════════════════════════════════════════════════════════════════════════
   TỰ CHẠY LẠI VỚI CỜ CẦN THIẾT

   `--expose-gc` để đo RAM cho đúng: không ép dọn rác thì con số heap là "rác
   chưa dọn + dữ liệu thật" trộn lẫn, đọc ra kết luận sai.
   `--max-old-space-size` vì bộ rạn 4 triệu đỉnh + chỉ mục ô của nó vượt xa
   heap mặc định — hết bộ nhớ giữa chừng thì bảng số cụt, không phải bảng số.
   ══════════════════════════════════════════════════════════════════════════ */

if (typeof globalThis.gc !== "function") {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    process.execPath,
    ["--expose-gc", "--max-old-space-size=8192", ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}

/* ══════════════════════════════════════════════════════════════════════════
   TIỆN ÍCH
   ══════════════════════════════════════════════════════════════════════════ */

const ms = (n) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));
const mb = (n) => (n / MB).toFixed(2);
const num = (n) => n.toLocaleString("vi-VN");

/** Chạy `fn` `rounds` lần, trả về ms của lần NHANH NHẤT (nhiễu chỉ làm chậm). */
function timeIt(fn, rounds = 3) {
  let best = Infinity;
  let out;
  for (let i = 0; i < rounds; i++) {
    const t0 = process.hrtime.bigint();
    out = fn();
    const t = Number(process.hrtime.bigint() - t0) / 1e6;
    if (t < best) best = t;
  }
  return { ms: best, out };
}

/** Ép dọn rác rồi trả về heapUsed — dùng để đo RAM THƯỜNG TRÚ của một kết quả. */
function heapAfterGc() {
  globalThis.gc();
  globalThis.gc();
  return process.memoryUsage().heapUsed;
}

/**
 * Đo một bước: thời gian + RAM.
 *  · `msBest`  — lần chạy nhanh nhất (rounds lần)
 *  · `heldMB`  — heap TĂNG THÊM và Ở LẠI khi vẫn giữ kết quả (RAM thường trú)
 *  · `peakMB`  — RSS đỉnh điểm TĂNG THÊM trong lúc chạy (đỉnh nhất thời)
 * `maxRSS` của Node là mốc CAO NHẤT từ đầu tiến trình (đơn điệu tăng), nên hiệu
 * hai lần đọc = phần đỉnh MỚI mà bước này tạo ra. Bước sau nhỏ hơn đỉnh cũ thì
 * ra 0 — đúng, chứ không phải đo hỏng.
 */
function measure(label, fn, rounds = 1) {
  const before = heapAfterGc();
  const rssBefore = process.resourceUsage().maxRSS * 1024;
  const { ms: t, out } = timeIt(fn, rounds);
  const rssAfter = process.resourceUsage().maxRSS * 1024;
  const after = heapAfterGc(); // `out` còn sống ⇒ phần giữ lại vẫn nằm trong heap
  return {
    label,
    ms: t,
    heldMB: Math.max(0, after - before) / MB,
    peakMB: Math.max(0, rssAfter - rssBefore) / MB,
    out,
  };
}

function table(head, rows) {
  const all = [head, ...rows].map((r) => r.map((c) => String(c)));
  const w = head.map((_, i) => Math.max(...all.map((r) => (r[i] ?? "").length)));
  const line = (r) => r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join("  ");
  console.log("  " + line(all[0]));
  console.log("  " + w.map((n) => "─".repeat(n)).join("  "));
  for (const r of all.slice(1)) console.log("  " + line(r));
}

function section(n, title) {
  console.log("\n" + "═".repeat(78));
  console.log(`PHẦN ${n} — ${title}`);
  console.log("═".repeat(78));
}

const fileSize = (f) => statSync(join(DATA, f)).size;
const readBin = (f) => readFileSync(join(DATA, f));
const readText = (f) => readFileSync(join(DATA, f), "utf8");

/** Mọi mốc đo được gom vào đây để phần 7 xếp hạng — KHÔNG chép tay lại số. */
const MARKS = [];
/**
 * `live` = mốc này CÓ nằm trong đường chạy của app hôm nay hay không. Cần cột
 * này vì bộ rạn ACA (8 MB) đang có trong public/data nhưng CHƯA nối vào bản đồ:
 * trộn nó vào bảng xếp hạng mà không đánh dấu là chỉ ra "chỗ tốn nhất" của một
 * app không tồn tại.
 * @param {{ name: string, ms: number, note?: string, group: string, live?: boolean }} m
 */
const mark = (m) => {
  MARKS.push({ live: true, ...m });
  return m;
};

/* ══════════════════════════════════════════════════════════════════════════
   THAM SỐ CHỈ MỤC Ô — ĐỌC RA TỪ MAPLIBRE, KHÔNG ĐOÁN

   MapLibre dựng chỉ mục ô cho mỗi `type: "geojson"` source bằng
   `@maplibre/geojson-vt`. Tham số nằm ở `GeoJSONSource.workerOptions`
   (node_modules/maplibre-gl/dist/maplibre-gl-dev.js):

     buffer    = _pixelsToTileUnits(128)   = 128 × (EXTENT/tileSize)
     tolerance = _pixelsToTileUnits(0.375) = 0.375 × (EXTENT/tileSize)
     extent    = EXTENT = 8192
     maxZoom   = source.maxzoom = 18
     updateable: true            (createGeoJSONIndex thêm vào)

  với EXTENT = 8192 và tileSize = 512 ⇒ hệ số 16.

  Đây là phần việc NẶNG NHẤT mà một geojson source bắt worker làm, và nó xảy ra
  MỘT LẦN cho toàn bộ dữ liệu ngay khi source được thêm vào — không phải chia
  đều theo ô đang nhìn. Đo thiếu nó là đo thiếu phần lớn thời gian.
   ══════════════════════════════════════════════════════════════════════════ */

const ML_EXTENT = 8192;
const ML_TILE_SIZE = 512;
const px2tu = (px) => px * (ML_EXTENT / ML_TILE_SIZE);
const GEOJSONVT_OPTS = {
  buffer: px2tu(128),
  tolerance: px2tu(0.375),
  extent: ML_EXTENT,
  maxZoom: 18,
  lineMetrics: false,
  generateId: false,
  cluster: false,
  updateable: true,
};

/* ══════════════════════════════════════════════════════════════════════════
   NẠP MÃ TYPESCRIPT THẬT (ocean-map.ts, seamarks.ts…)

   `buildMapStyle` sống trong .ts và kéo theo `@protomaps/basemaps`. Chép tay
   sang .mjs là mở đường cho hai bản lệch nhau — mà bản đo lệch bản chạy thì bộ
   đo thành thứ tệ hơn không đo. Nên: dịch TS TẠI CHỖ bằng chính `typescript`
   trong node_modules, ghi ra node_modules/.cache (không đụng src/, không đụng
   public/), rồi import.

   Ghi vào node_modules/.cache CHỨ KHÔNG os.tmpdir(): file dịch ra vẫn `import`
   `@protomaps/basemaps`, mà Node dò node_modules theo cây thư mục — nằm ngoài
   repo là không tìm ra gói.
   ══════════════════════════════════════════════════════════════════════════ */

const CACHE_DIR = join(ROOT, "node_modules", ".cache", "sdfish-bench-render");

async function loadTsChain(entry) {
  const ts = (await import("typescript")).default;
  mkdirSync(CACHE_DIR, { recursive: true });
  const dir = mkdtempSync(join(CACHE_DIR, "m-"));
  const done = new Set();

  const emit = (name) => {
    if (done.has(name)) return;
    done.add(name);
    const src = readFileSync(join(ROOT, "src", "lib", `${name}.ts`), "utf8");
    const js = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
      },
    }).outputText;
    const deps = [];
    const rewritten = js.replace(/(["'])@\/lib\/([\w-]+)\1/g, (_, q, dep) => {
      deps.push(dep);
      return `${q}./${dep}.mjs${q}`;
    });
    writeFileSync(join(dir, `${name}.mjs`), rewritten);
    for (const d of deps) emit(d);
  };

  emit(entry);
  return import(pathToFileURL(join(dir, `${entry}.mjs`)).href);
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 1 — GIẢI MÃ: BYTE → CẤU TRÚC TRONG BỘ NHỚ
   ══════════════════════════════════════════════════════════════════════════ */

/** Đếm đỉnh của một FeatureCollection bất kỳ (mọi kiểu hình học). */
function countVerts(fc) {
  let n = 0;
  const walk = (c, depth) => {
    if (depth === 0) {
      n++;
      return;
    }
    for (const x of c) walk(x, depth - 1);
  };
  const DEPTH = {
    Point: 0,
    MultiPoint: 1,
    LineString: 1,
    MultiLineString: 2,
    Polygon: 2,
    MultiPolygon: 3,
  };
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    if (!g || !(g.type in DEPTH)) continue;
    walk(g.coordinates, DEPTH[g.type]);
  }
  return n;
}

/** Kích thước lưới độ sâu — khớp DEPTH_META trong src/lib/depth-grid.ts. */
const DEPTH_N_LAT = 4441;
const DEPTH_N_LON = 3841;

const decoded = {};

/**
 * FeatureCollection báo hiệu — CÙNG hình dạng `seamarkGeo` trong
 * fishing-map-view.tsx (chỉ ba thuộc tính, cố ý không nhét cả object đèn vào).
 * Tách hàm để phần 2 và phần 3 dùng chung một cách dựng, chạy phần nào riêng
 * cũng ra cùng một thứ.
 */
function buildSeamarkGeo() {
  const raw = decoded.seamarksRaw;
  return {
    type: "FeatureCollection",
    features: (raw?.marks ?? []).map((r, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r[0], r[1]] },
      properties: { i, t: r[2], lit: r[3] != null ? 1 : 0 },
    })),
  };
}

function part1() {
  section(1, "Giải mã — từ byte trong máy tới cấu trúc JS dùng được");
  console.log(
    "\n  Mốc này bắt đầu SAU khi byte đã nằm trong máy (đã tải xong, hoặc service\n" +
      "  worker đã lấy từ kho). Nó là phần mạng KHÔNG cứu được: 4G nhanh cỡ nào\n" +
      "  cũng không rút ngắn được một giây CPU.\n",
  );

  const rows = [];

  // ── reef-shapes-aca.v1.bin — 8 MB nhị phân, bộ giải trong src/lib/reef-bin.mjs
  {
    const raw = readBin("reef-shapes-aca.v1.bin");
    const m = measure("aca-bin", () => decodeReefShapes(raw), 3);
    decoded.reefAca = m.out;
    const v = m.out.features.reduce(
      (a, f) => a + f.geometry.coordinates.reduce((b, p) => b + p.reduce((c, r) => c + r.length, 0), 0),
      0,
    );
    mark({
      group: "giải mã",
      name: "reef-shapes-aca.v1.bin → FeatureCollection (reef-bin.mjs)",
      ms: m.ms,
      live: false, // file đã có trong public/data nhưng CHƯA nối vào bản đồ
      note: `${num(m.out.features.length)} cụm · ${num(v)} đỉnh · giữ ${mb(m.heldMB * MB)} MB`,
    });
    rows.push([
      "reef-shapes-aca.v1.bin",
      mb(raw.length),
      "varint-delta (reef-bin.mjs)",
      ms(m.ms),
      m.heldMB.toFixed(1),
      m.peakMB.toFixed(1),
      num(v),
    ]);
  }

  // ── depth-grid.v1.bin — chỉ bọc Uint8Array (decodeDepthGrid không bung bit)
  {
    const raw = readBin("depth-grid.v1.bin");
    const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const m = measure("depth", () => new Uint8Array(buf), 5);
    decoded.depth = m.out;
    mark({
      group: "giải mã",
      name: "depth-grid.v1.bin → Uint8Array (KHÔNG bung bit)",
      ms: m.ms,
      note: `${num(DEPTH_N_LAT * DEPTH_N_LON)} ô, tra tại chỗ bằng dịch bit`,
    });
    rows.push([
      "depth-grid.v1.bin",
      mb(raw.length),
      "4 bit/ô, tra tại chỗ",
      ms(m.ms),
      "0.0*",
      m.peakMB.toFixed(1),
      num(DEPTH_N_LAT * DEPTH_N_LON) + " ô",
    ]);

    // Nếu ai đó bung ra một byte/ô (cách "cho tiện") thì tốn bao nhiêu — đo để
    // có mốc so, KHÔNG phải app đang làm vậy.
    const m2 = measure(
      "depth-unpack",
      () => {
        const n = DEPTH_N_LAT * DEPTH_N_LON;
        const out = new Uint8Array(n);
        // 4 bit/ô, 2 ô/byte (từ 2026-09-04) — khớp `depthClassAt` của
        // src/lib/depth-grid.ts; bản 2 bit cũ đọc ra lớp sai mà không ném
        for (let k = 0; k < n; k++) out[k] = (m.out[k >> 1] >> ((k & 1) * 4)) & 15;
        return out;
      },
      3,
    );
    rows.push([
      "  ↳ nếu bung 1 byte/ô",
      "—",
      "(app KHÔNG làm — mốc so)",
      ms(m2.ms),
      m2.heldMB.toFixed(1),
      m2.peakMB.toFixed(1),
      num(DEPTH_N_LAT * DEPTH_N_LON) + " ô",
    ]);
  }

  // ── các asset GeoJSON: JSON.parse thuần
  for (const [file, key] of [
    ["isobaths.v1.json", "isobaths"],
    ["reef-shapes.v1.json", "reefOsm"],
    ["seamarks.v1.json", "seamarksRaw"],
    ["vn-sea-lanes.v1.json", "lanes"],
    ["vn-coast.v1.json", "coast"],
    ["vn-islands.v1.json", "islands"],
    ["coral-reefs.v1.json", "reefNames"],
    ["vn-aids.v1.json", "aids"],
  ]) {
    const txt = readText(file);
    const m = measure(file, () => JSON.parse(txt), 5);
    decoded[key] = m.out;
    const v = m.out?.features ? countVerts(m.out) : (m.out?.marks?.length ?? 0);
    mark({
      group: "giải mã",
      name: `${file} → JSON.parse`,
      ms: m.ms,
      note: `${mb(fileSize(file))} MB · ${num(v)} đỉnh/hàng`,
    });
    rows.push([
      file,
      mb(fileSize(file)),
      "JSON.parse",
      ms(m.ms),
      m.heldMB.toFixed(1),
      m.peakMB.toFixed(1),
      num(v),
    ]);
  }

  console.log("");
  table(
    ["nguồn", "MB đĩa", "cách giải", "ms", "RAM giữ MB", "RSS đỉnh +MB", "đỉnh / ô"],
    rows,
  );
  console.log(
    "\n  ⚠️ SAI SỐ ĐÃ BIẾT: bộ rạn ACA giải xong thì GIỮ LẠI 308 MB trong heap để\n" +
      "     phần 2–3 dùng tiếp. Mọi phép đo SAU nó chạy dưới áp lực heap cao hơn nên\n" +
      "     chậm hơn khi chạy riêng (isobaths: ~10 ms chạy riêng vs ~20 ms trong lượt\n" +
      "     chạy đủ). Muốn số sạch cho một dòng thì chạy phần đó riêng\n" +
      "     (`node scripts/bench-render.mjs 1`). Chênh cỡ 2× — đọc theo bậc độ lớn.\n" +
      "\n  * depth-grid giữ 0 MB thêm vì `decodeDepthGrid` chỉ BỌC ArrayBuffer đã\n" +
      "    tải, không sao chép — 4,07 MB đó đã nằm trong máy từ lúc `arrayBuffer()`.\n" +
      "    Dòng ngay dưới cho thấy cái giá nếu ai đó 'bung cho tiện': RAM ×4 và mất\n" +
      "    thêm CPU mà không được gì, vì `depthClassAt` vốn tra thẳng bằng dịch bit.\n" +
      "\n  ĐỌC BẢNG: cột 'RSS đỉnh +MB' là mốc cao nhất MỚI mà bước đó đẩy tiến trình\n" +
      "  lên. Bước chạy sau một bước nặng hơn sẽ ra 0 — đó là tính chất của mốc cao\n" +
      "  nhất, không phải đo hỏng.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 2 — DỰNG GEOJSON + CHỈ MỤC Ô CỦA MAPLIBRE
   ══════════════════════════════════════════════════════════════════════════ */

async function part2() {
  section(2, "Dựng GeoJSON + chỉ mục ô — phần việc MapLibre bắt worker làm");
  console.log(
    "\n  Cho MapLibre một `type: \"geojson\"` source là ĐẶT HÀNG ba việc, không phải\n" +
      "  một: (1) lấy dữ liệu, (2) JSON.parse (phần 1), (3) DỰNG CHỈ MỤC Ô bằng\n" +
      "  @maplibre/geojson-vt — chiếu, giản lược, cắt lát TOÀN BỘ dữ liệu ngay lúc\n" +
      "  thêm source, không chờ tới ô nào được nhìn.\n" +
      `  Tham số đọc thẳng từ maplibre-gl ${JSON.stringify(GEOJSONVT_OPTS)}\n`,
  );

  // `GeoJSONVT` là ĐÚNG lớp MapLibre gọi (`new symbol_layout.GeoJSONVT(data,
  // options)` trong createGeoJSONIndex) — không phải hàm mặc định kiểu
  // mapbox/geojson-vt cũ; gói @maplibre không có export mặc định.
  let GeoJSONVT;
  try {
    ({ GeoJSONVT } = await import("@maplibre/geojson-vt"));
  } catch (e) {
    console.log(`  (bỏ qua — không nạp được @maplibre/geojson-vt: ${e.message})`);
    return;
  }
  const geojsonvt = (fc, opts) => new GeoJSONVT(fc, opts);

  const rows = [];

  /** Dựng chỉ mục cho một FeatureCollection + lấy thử vài ô. */
  const index = (label, fc, verts, live) => {
    let m;
    try {
      m = measure(label, () => geojsonvt(fc, GEOJSONVT_OPTS), 1);
    } catch (e) {
      rows.push([label, num(verts), "NÉM: " + e.message, "—", "—", "—", live]);
      return;
    }
    const idx = m.out;
    // Lấy ô: mô phỏng một khung nhìn điện thoại ở z9 quanh Nha Trang (390×844
    // px ⇒ 2×4 ô 512 px). Ô lấy LẦN ĐẦU phải cắt lát từ ô cha, nên đây là chi
    // phí thật của lượt vẽ đầu tiên, không phải lượt đã có sẵn.
    const z = 9;
    const tx = Math.floor(((109.35 + 180) / 360) * 2 ** z);
    const sin = Math.sin((12.24 * Math.PI) / 180);
    const ty = Math.floor((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 2 ** z);
    let nFeat = 0;
    const tm = timeIt(() => {
      nFeat = 0;
      for (let dx = 0; dx <= 1; dx++)
        for (let dy = 0; dy <= 1; dy++) {
          const t = idx.getTile(z, tx + dx, ty + dy);
          if (t) nFeat += t.features.length;
        }
    }, 1);
    mark({
      group: "chỉ mục ô",
      name: `geojson-vt dựng chỉ mục: ${label}`,
      ms: m.ms,
      live: live === "CÓ",
      note: `${num(verts)} đỉnh · giữ ${m.heldMB.toFixed(1)} MB`,
    });
    mark({
      group: "cắt ô đầu",
      name: `cắt 4 ô z9 lần đầu: ${label}`,
      ms: tm.ms,
      live: live === "CÓ",
      note: `${nFeat} hình lọt vào khung nhìn`,
    });
    rows.push([
      label,
      num(verts),
      ms(m.ms),
      m.heldMB.toFixed(1),
      m.peakMB.toFixed(1),
      ms(tm.ms) + ` (${nFeat} hình)`,
      live,
    ]);
  };

  // Đang chạy thật hôm nay (URL source → worker tự tải + parse + index)
  index("isobaths.v1.json", decoded.isobaths, countVerts(decoded.isobaths), "CÓ");
  index("reef-shapes.v1.json (OSM)", decoded.reefOsm, countVerts(decoded.reefOsm), "CÓ");
  index("vn-sea-lanes.v1.json", decoded.lanes, countVerts(decoded.lanes), "CÓ");
  index("vn-islands.v1.json", decoded.islands, countVerts(decoded.islands), "CÓ");
  index("coral-reefs.v1.json", decoded.reefNames, countVerts(decoded.reefNames), "CÓ");
  index("vn-coast.v1.json", decoded.coast, countVerts(decoded.coast), "CÓ");

  // Lớp báo hiệu: app dựng FeatureCollection TRONG MÁY từ bảng số (seamarks.ts)
  {
    const m = measure("seamark→FC", buildSeamarkGeo, 3);
    decoded.seamarkGeo = m.out;
    mark({
      group: "dựng GeoJSON",
      name: "seamarks: bảng số → FeatureCollection (trong máy)",
      ms: m.ms,
      note: `${num(m.out.features.length)} điểm`,
    });
    rows.push([
      "seamarks → FC (dựng trong máy)",
      num(m.out.features.length),
      ms(m.ms),
      m.heldMB.toFixed(1),
      m.peakMB.toFixed(1),
      "—",
      "CÓ",
    ]);
    index("seamarks (FC vừa dựng)", m.out, m.out.features.length, "CÓ");
  }

  // CHƯA nối vào app — 8 MB rạn ACA. Đo trước để biết cái giá nếu nối vào theo
  // cách thẳng nhất (một geojson source cho cả bộ).
  {
    const fc = decoded.reefAca;
    const v = fc.features.reduce(
      (a, f) => a + f.geometry.coordinates.reduce((b, p) => b + p.reduce((c, r) => c + r.length, 0), 0),
      0,
    );
    index("reef-shapes-aca (CHƯA nối vào app)", fc, v, "chưa");
  }

  console.log("");
  table(
    ["nguồn", "đỉnh", "dựng chỉ mục ms", "RAM giữ MB", "RSS đỉnh +MB", "lấy 4 ô z9", "app đang dùng?"],
    rows,
  );
  console.log(
    "\n  Cột 'dựng chỉ mục' là việc chạy MỘT LẦN cho CẢ BỘ ngay khi source được\n" +
      "  thêm — trước khi bà con nhìn thấy gì. Cột 'lấy 4 ô z9' là phần chia theo\n" +
      "  khung nhìn. Tỉ lệ giữa hai cột cho thấy bao nhiêu công bị trả trước cho\n" +
      "  vùng biển bà con KHÔNG nhìn.\n" +
      "  ⚠️ Ở app thật, dựng chỉ mục chạy trong WORKER nên không khoá tay chạm —\n" +
      "     nhưng nó vẫn là thời gian bản đồ TRỐNG, và trên máy một-hai nhân thì\n" +
      "     worker giành CPU với luồng chính chứ không chạy song song thật.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 3 — CHUỖI HOÁ QUA RANH GIỚI LUỒNG
   ══════════════════════════════════════════════════════════════════════════ */

async function part3() {
  section(3, "Chuỗi hoá — đưa GeoJSON từ luồng chính sang worker");
  console.log(
    "\n  Source kiểu `data={objectTrongMáy}` (app đang làm với lớp báo hiệu và mọi\n" +
      "  lớp dự báo) đi qua `postMessage` ⇒ structured-clone TOÀN BỘ object. Source\n" +
      "  kiểu `data=\"/data/....json\"` thì KHÔNG — worker tự tải, luồng chính không\n" +
      "  bao giờ cầm dữ liệu. Đây là khác biệt kiến trúc thật, đo cho ra số.\n" +
      "  Node dùng cùng THUẬT TOÁN structured-clone với trình duyệt nhưng khác cài\n" +
      "  đặt ⇒ đọc theo BẬC ĐỘ LỚN và theo TỈ LỆ giữa các dòng, không phải ms tuyệt\n" +
      "  đối của Chrome.\n",
  );

  decoded.seamarkGeo ??= buildSeamarkGeo(); // chạy phần 3 riêng thì phần 2 chưa dựng
  const cases = [
    // [nhãn, dữ liệu, app CÓ đi qua đường này hôm nay không]
    ["seamarks (FC dựng trong máy)", decoded.seamarkGeo, true],
    // isobaths + reef OSM hôm nay khai bằng URL ⇒ KHÔNG qua postMessage. Đo để
    // biết cái giá NẾU chuyển sang truyền object, và để có mốc so theo đỉnh.
    ["isobaths.v1.json (hôm nay khai bằng URL)", decoded.isobaths, false],
    ["reef-shapes.v1.json (hôm nay khai bằng URL)", decoded.reefOsm, false],
    ["reef-shapes-aca (chưa nối vào app)", decoded.reefAca, false],
  ];

  const rows = [];
  for (const [label, fc, live] of cases) {
    if (!fc) continue;
    const v = countVerts(fc);

    const clone = measure(`clone ${label}`, () => structuredClone(fc), 1);
    const js = measure(`stringify ${label}`, () => JSON.stringify(fc), 1);
    const jp = measure(`parse ${label}`, () => JSON.parse(js.out), 1);
    const post = await postMessageRoundTrip(fc);

    mark({
      group: "chuỗi hoá",
      name: `structured-clone: ${label}`,
      ms: clone.ms,
      live,
      note: `${num(v)} đỉnh`,
    });
    mark({
      group: "chuỗi hoá",
      name: `postMessage khứ hồi (worker thật): ${label}`,
      ms: post.ms,
      live,
      note: `${num(v)} đỉnh · gửi + nhận lại`,
    });

    rows.push([
      label,
      num(fc.features?.length ?? 0),
      num(v),
      ms(clone.ms),
      ms(post.ms),
      ms(js.ms),
      ms(jp.ms),
      (js.out.length / MB).toFixed(1),
      ((clone.ms / Math.max(v, 1)) * 1e6).toFixed(0),
      ((clone.ms / Math.max(fc.features?.length ?? 1, 1)) * 1e6).toFixed(0),
    ]);
  }

  table(
    [
      "nguồn",
      "feature",
      "đỉnh",
      "structuredClone ms",
      "postMessage khứ hồi ms",
      "stringify ms",
      "parse ms",
      "JSON MB",
      "ns/đỉnh",
      "ns/feature",
    ],
    rows,
  );
  console.log(
    "\n  'postMessage khứ hồi' = gửi sang worker_threads THẬT rồi worker gửi trả\n" +
      "  lại ⇒ hai lượt chuỗi hoá + hai lượt giải + chi phí kênh. MapLibre chỉ tốn\n" +
      "  MỘT chiều cho geojson (worker giữ luôn), nên chia đôi là ước lượng thô của\n" +
      "  chiều đi. Đo khứ hồi vì chỉ có nó đo được không cần đồng hồ chung.\n" +
      "\n  HAI CỘT CUỐI: CẢ HAI ĐỀU KHÔNG PHẢI HẰNG SỐ — và đó chính là kết quả.\n" +
      "  Lớp báo hiệu 5.851 ĐIỂM (mỗi feature đúng 1 đỉnh) tốn ~2.400 ns mỗi đỉnh;\n" +
      "  bộ rạn 4 triệu đỉnh gói trong 1.534 feature tốn cỡ tương đương mỗi đỉnh\n" +
      "  nhưng gấp HÀNG NGHÌN LẦN mỗi feature. Nghĩa là chi phí có HAI VẾ: một vế\n" +
      "  theo số OBJECT phải đi bộ qua (mỗi feature là 4 object rời: feature,\n" +
      "  geometry, properties, mảng toạ độ — mỗi cái một lượt cấp phát ở đầu kia),\n" +
      "  một vế theo số ĐỈNH.\n" +
      "  ⇒ ĐỪNG ngoại suy bằng MỘT hệ số. Bốn điểm dữ liệu này chưa đủ để tách hai\n" +
      "    vế cho ra công thức; muốn ước một lớp mới thì đo thẳng lớp đó — thêm nó\n" +
      "    vào mảng `cases` ở phần này là xong.",
  );
}

/** Gửi một object sang worker_threads và nhận lại — trả về ms khứ hồi. */
function postMessageRoundTrip(payload) {
  return new Promise((resolve, reject) => {
    const w = new Worker(
      `import { parentPort } from "node:worker_threads";
       parentPort.on("message", (m) => parentPort.postMessage(m));`,
      { eval: true, type: "module" },
    );
    w.once("error", (e) => {
      w.terminate();
      reject(e);
    });
    // Vòng khởi động trước (worker vừa dựng còn ấm máy JIT) rồi mới bấm giờ.
    let warmed = false;
    let t0 = 0n;
    w.on("message", () => {
      if (!warmed) {
        warmed = true;
        t0 = process.hrtime.bigint();
        w.postMessage(payload);
        return;
      }
      const t = Number(process.hrtime.bigint() - t0) / 1e6;
      w.terminate();
      resolve({ ms: t });
    });
    w.postMessage({ warmup: 1 });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 4 — PMTILES: HEADER + Ô
   ══════════════════════════════════════════════════════════════════════════ */

/** Nguồn đọc file cho thư viện `pmtiles` — cùng khuôn bench-map-method.mjs. */
class FileSource {
  constructor(p) {
    this.fd = openSync(p, "r");
    this.p = p;
    this.reads = 0;
    this.bytes = 0;
  }
  getKey() {
    return this.p;
  }
  async getBytes(offset, length) {
    this.reads++;
    this.bytes += length;
    const buf = Buffer.allocUnsafe(length);
    readSync(this.fd, buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) };
  }
}

/** lon/lat → toạ độ ô ở zoom z. */
function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const s = Math.sin((lat * Math.PI) / 180);
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  return [x, y];
}

async function part4() {
  section(4, "PMTiles — mở kho nền và lấy ô (thư viện `pmtiles` app đang dùng)");

  const p = join(DATA, "vn-basemap.pmtiles");
  let size;
  try {
    size = statSync(p).size;
  } catch {
    console.log(`  (bỏ qua — không thấy ${p})`);
    return;
  }

  // ── mở nguội: dựng PMTiles + đọc header + thư mục gốc ────────────────────
  const src = new FileSource(p);
  const pm = new PMTiles(src);
  const t0 = process.hrtime.bigint();
  const header = await pm.getHeader();
  const headerMs = Number(process.hrtime.bigint() - t0) / 1e6;
  mark({
    group: "PMTiles",
    name: "mở nguội: dựng + đọc header + thư mục gốc",
    ms: headerMs,
    note: `${src.reads} lượt đọc · ${(src.bytes / 1024).toFixed(1)} KB`,
  });

  // Bảng mã nén trong đặc tả PMTiles v3 (0 chưa biết, 1 không nén, 2 gzip…)
  const COMP = ["chưa biết", "không nén", "gzip", "brotli", "zstd"];
  // Mở LẦN HAI trên một instance mới: cùng công việc, nhưng V8 đã biên dịch
  // xong mã của thư viện và zlib đã khởi động. Hiệu hai con số = phần "khởi
  // động", KHÔNG phải phần đọc file. Không tách ra thì dễ kết luận nhầm rằng
  // đọc header PMTiles là chỗ tốn nhất, trong khi phần lớn là làm nóng máy.
  const src2 = new FileSource(p);
  const pm2 = new PMTiles(src2);
  const t0b = process.hrtime.bigint();
  await pm2.getHeader();
  const headerWarmMs = Number(process.hrtime.bigint() - t0b) / 1e6;
  mark({
    group: "PMTiles",
    name: "mở lại (mã đã nóng): dựng + đọc header + thư mục gốc",
    ms: headerWarmMs,
    note: "hiệu với dòng trên = chi phí làm nóng V8/zlib, không phải đọc file",
  });

  console.log(
    `\n  vn-basemap.pmtiles ${mb(size)} MB · zoom ${header.minZoom}–${header.maxZoom} · ` +
      `${num(header.numAddressedTiles)} ô có địa chỉ · nén ô: ` +
      `${COMP[header.tileCompression] ?? header.tileCompression}\n` +
      `  Mở LẦN ĐẦU (mã còn nguội): ${ms(headerMs)} ms, ${src.reads} lượt đọc, ` +
      `${(src.bytes / 1024).toFixed(1)} KB.\n` +
      `  Mở LẦN HAI (mã đã nóng):   ${ms(headerWarmMs)} ms — chênh ` +
      `${ms(headerMs - headerWarmMs)} ms là tiền LÀM NÓNG V8/zlib, không phải tiền đọc file.\n`,
  );

  // ── lấy ô: nguội (phải trèo thư mục) vs ấm (thư mục đã trong bộ nhớ) ──────
  const VIEWS = [
    ["Ven bờ Nha Trang", 109.35, 12.24],
    ["Cửa Hải Phòng", 106.85, 20.75],
    ["Trường Sa", 114.3, 9.7],
  ];
  const rows = [];
  for (const z of [5, 7, 9]) {
    if (z > header.maxZoom) continue;
    for (const [name, lon, lat] of VIEWS) {
      const [tx, ty] = lonLatToTile(lon, lat, z);
      const r0 = src.reads;
      const b0 = src.bytes;
      const t1 = process.hrtime.bigint();
      const tile = await pm.getZxy(z, tx, ty);
      const first = Number(process.hrtime.bigint() - t1) / 1e6;
      const reads = src.reads - r0;
      const bytes = src.bytes - b0;
      // lượt thứ hai: thư mục đã nằm trong bộ nhớ đệm của thư viện
      const t2 = process.hrtime.bigint();
      await pm.getZxy(z, tx, ty);
      const again = Number(process.hrtime.bigint() - t2) / 1e6;
      rows.push([
        `z${z} · ${name}`,
        `${tx}/${ty}`,
        tile?.data ? (tile.data.byteLength / 1024).toFixed(1) + " KB" : "trống",
        ms(first),
        ms(again),
        reads,
        (bytes / 1024).toFixed(1) + " KB",
      ]);
      if (z === 9 && name === "Ven bờ Nha Trang") {
        mark({
          group: "PMTiles",
          name: "lấy 1 ô nền z9 (lần đầu, phải trèo thư mục + giải nén)",
          ms: first,
          note: `${reads} lượt đọc · ${(bytes / 1024).toFixed(1)} KB đĩa`,
        });
        mark({
          group: "PMTiles",
          name: "lấy 1 ô nền z9 (thư mục đã trong bộ nhớ)",
          ms: again,
          note: "chỉ còn đọc + giải nén",
        });
      }
    }
  }
  table(
    ["ô", "x/y", "cỡ ô (đã bung)", "lần đầu ms", "lần sau ms", "lượt đọc", "byte đọc"],
    rows,
  );

  // ── một khung nhìn điện thoại đầy đủ ở z9 ────────────────────────────────
  // Ô nền vector vẽ ở 512 px (MapLibre `tileSize = 512` cho nguồn vector), nên
  // màn 390×844 chỉ cần ~2×3 ô — KHÔNG phải 15 ô như đếm theo lưới 256 px.
  {
    const z = Math.min(9, header.maxZoom);
    const [cx, cy] = lonLatToTile(109.35, 12.24, z);
    const list = [];
    for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 2; dy++) list.push([cx + dx, cy + dy]);
    const t = process.hrtime.bigint();
    let ok = 0;
    let bytes = 0;
    for (const [x, y] of list) {
      const tile = await pm.getZxy(z, x, y);
      if (tile?.data) {
        ok++;
        bytes += tile.data.byteLength;
      }
    }
    const total = Number(process.hrtime.bigint() - t) / 1e6;
    mark({
      group: "PMTiles",
      name: `lấy ${list.length} ô nền z9 phủ một khung nhìn điện thoại`,
      ms: total,
      note: `${ok} ô có nội dung · ${(bytes / 1024).toFixed(0)} KB đã bung`,
    });
    console.log(
      `\n  Một khung nhìn 390×844 ở z9 (ô 512 px) = ${list.length} ô: ${ms(total)} ms, ` +
        `${ok} ô có nội dung, ${(bytes / 1024).toFixed(0)} KB sau khi bung.\n`,
    );
  }

  console.log(
    "  ⚠️ KHÔNG ĐO ĐƯỢC Ở NODE — cần trình duyệt thật:\n" +
      "   · Trên máy bà con, mỗi lượt đọc này là một `fetch` Range đi qua service\n" +
      "     worker (`basemapFirst`), rồi SW cắt lát từ ArrayBuffer 13,8 MB. Chi phí\n" +
      "     đó gồm `caches.match` + `Response.arrayBuffer()` (một lần cho cả vòng\n" +
      "     đời SW) + `buf.slice()` mỗi ô — Node không mô phỏng được.\n" +
      "   · Ở đây `getZxy` giải nén gzip đồng bộ bằng zlib của Node. Trình duyệt\n" +
      "     dùng `DecompressionStream` bất đồng bộ — khác cả tốc độ lẫn nhịp.\n" +
      "   · Trước khi có ô đầu tiên, SW còn phải tải NGUYÊN 13,8 MB về kho\n" +
      "     (`fillBasemapArchive`) — lần mở app đầu tiên trả toàn bộ khoản đó.",
  );

  // ── cái giá của nhánh service worker: dựng lại 13,8 MB ArrayBuffer ────────
  {
    const whole = readFileSync(p);
    const m = measure(
      "sw-arraybuffer",
      () => whole.buffer.slice(whole.byteOffset, whole.byteOffset + whole.byteLength),
      3,
    );
    const ab = m.out;
    const sl = measure("sw-slice", () => ab.slice(0, 16384), 20);
    mark({
      group: "PMTiles",
      name: "SW: dựng lại ArrayBuffer 13,8 MB (một lần / vòng đời SW)",
      ms: m.ms,
      note: "xấp xỉ `Response.arrayBuffer()` — trình duyệt còn tốn hơn",
    });
    console.log(
      `\n  Xấp xỉ nhánh service worker (chỉ phần sao chép bộ nhớ, KHÔNG có kho\n` +
        `  Cache API thật): dựng ArrayBuffer ${mb(size)} MB mất ${ms(m.ms)} ms; ` +
        `cắt một lát 16 KB mất ${ms(sl.ms)} ms.\n` +
        "  Lát cắt rẻ ⇒ chi phí nằm ở LƯỢT DỰNG ĐẦU, không ở từng ô. Con số thật\n" +
        "  trên trình duyệt cao hơn: `Response.arrayBuffer()` còn phải đọc từ kho\n" +
        "  trên đĩa của Cache API.",
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 5 — DỰNG STYLE
   ══════════════════════════════════════════════════════════════════════════ */

async function part5() {
  section(5, "Dựng style — buildMapStyle từ src/lib/ocean-map.ts (mã thật)");

  let mod;
  try {
    mod = await loadTsChain("ocean-map");
  } catch (e) {
    console.log(`  (bỏ qua — không dịch/nạp được ocean-map.ts: ${e.message})`);
    return;
  }
  const { buildMapStyle } = mod;
  if (typeof buildMapStyle !== "function") {
    console.log("  (bỏ qua — ocean-map.ts không xuất buildMapStyle)");
    return;
  }

  // Phần nặng nhất bên trong: `protomapsLayers()` sinh toàn bộ lớp nền rồi
  // buildMapStyle lọc bỏ symbol/boundaries. Tách ra đo riêng để biết ai tốn.
  let pmLayersMs = null;
  let pmLayersCount = null;
  let pmKeptCount = null;
  try {
    const { layers: protomapsLayers, namedFlavor } = await import("@protomaps/basemaps");
    const m = measure("protomapsLayers", () => protomapsLayers("basemap", namedFlavor("light")), 5);
    pmLayersMs = m.ms;
    pmLayersCount = m.out.length;
    pmKeptCount = m.out.filter(
      (l) => l.type !== "symbol" && l.id !== "background" && !l.id.startsWith("boundaries"),
    ).length;
  } catch (e) {
    console.log(`  (không đo riêng được protomapsLayers: ${e.message})`);
  }

  const now = new Date();
  const rows = [];
  for (const [label, layerId, opts] of [
    ["nền trơn (layerId = null)", null, { seamarks: false }],
    ["hải đồ độ sâu (đường đẳng sâu + nhãn)", "bathymetry", { seamarks: false }],
    ["nước nóng lạnh (raster GIBS)", "sst", { seamarks: false }],
    ["hải đồ + lớp ảnh báo hiệu", "bathymetry", { seamarks: true }],
  ]) {
    const m = measure(label, () => buildMapStyle(layerId, now, opts), 5);
    const style = m.out;
    const json = JSON.stringify(style);
    rows.push([
      label,
      style.layers.length,
      Object.keys(style.sources).length,
      ms(m.ms),
      (json.length / 1024).toFixed(1) + " KB",
      m.heldMB.toFixed(2),
    ]);
    if (layerId === "bathymetry" && !opts.seamarks) {
      mark({
        group: "dựng style",
        name: "buildMapStyle('bathymetry') — cấu hình app đang dùng",
        ms: m.ms,
        note: `${style.layers.length} lớp · ${(json.length / 1024).toFixed(1)} KB JSON`,
      });
    }
  }

  console.log("");
  table(["cấu hình", "số lớp", "số source", "ms", "JSON", "RAM giữ MB"], rows);

  if (pmLayersMs != null) {
    console.log(
      `\n  Bên trong: \`protomapsLayers("basemap", light)\` sinh ${pmLayersCount} lớp trong ` +
        `${ms(pmLayersMs)} ms;\n` +
        `  buildMapStyle giữ lại ${pmKeptCount} (bỏ symbol + background + boundaries).\n` +
        `  Tức ${pmLayersCount - pmKeptCount} lớp được sinh ra rồi vứt đi NGAY — mỗi lần dựng style.\n` +
        `  Style được dựng lại mỗi khi \`layerId\` hoặc \`anyExclusiveOverlay\` đổi\n` +
        "  (useMemo trong fishing-map-view.tsx), tức mỗi lần bà con bấm đổi lớp.",
    );
  }
  console.log(
    "\n  ⚠️ KHÔNG ĐO ĐƯỢC Ở NODE: dựng object style chỉ là bước đầu. Sau đó MapLibre\n" +
      "     còn phải VALIDATE style theo style-spec, dựng `StyleLayer` cho từng lớp,\n" +
      "     biên dịch mọi biểu thức paint/layout, rồi biên dịch shader WebGL cho\n" +
      "     từng kiểu lớp. Phần đó cần WebGL context — chỉ đo được trên trình duyệt.",
  );

  try {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  } catch {
    /* dọn được thì tốt, không thì thôi — nằm trong node_modules/.cache */
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 6 — QUY ĐỔI SANG MÁY YẾU
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Chỉ số máy — một khối việc CỐ ĐỊNH, thuần JS, không I/O. Có nó thì bảng số
 * chạy trên máy khác so được với bảng số trong docs/research: chia hai chỉ số
 * là ra hệ số máy, không phải đoán "máy tôi mạnh hơn chắc gấp đôi".
 *
 * Trộn ba loại việc đúng với thứ bản đồ thật làm: số học dấu phẩy động (chiếu
 * toạ độ), cấp phát mảng nhỏ (dựng feature), và truy cập bộ nhớ rải rác (tra
 * lưới). Một vòng lặp float thuần sẽ vẽ ra bức tranh quá đẹp.
 */
function deviceScore() {
  const N = 400000;
  const t0 = process.hrtime.bigint();
  let acc = 0;
  const grid = new Float64Array(4096);
  for (let i = 0; i < N; i++) {
    const lon = -180 + (i % 3600) / 10;
    const lat = -85 + (i % 1700) / 10;
    const s = Math.sin((lat * Math.PI) / 180);
    const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
    const x = (lon + 180) / 360;
    const pt = [x, y];
    grid[(i * 2654435761) & 4095] += pt[0] + pt[1];
    acc += grid[(i * 40503) & 4095];
  }
  const t = Number(process.hrtime.bigint() - t0) / 1e6;
  if (acc === Infinity) console.log("");
  return { ms: t, opsPerMs: N / t };
}

/**
 * Hệ số chậm của điện thoại phổ thông so với máy dev.
 *
 * NGUỒN (đọc kỹ phần "giới hạn" bên dưới trước khi dùng):
 *  · Chrome DevTools đặt sẵn: máy phổ thông (low-tier) = ×6, máy tầm trung
 *    (mid-tier) = ×4 CPU slowdown.
 *    https://developer.chrome.com/docs/devtools/device-mode
 *  · Lighthouse mặc định ×4 "để đưa một máy desktop mạnh về khoảng máy di động
 *    tầm trung".
 *    https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
 *  · Đo thật trên máy THẬT (Harry Roberts, 8/2025): so máy dev với Samsung
 *    Galaxy A15 5G (phổ thông) và A54 5G (tầm trung) ⇒ ×9,1 và ×2,9.
 *    https://csswizardry.com/2025/08/low-and-mid-tier-mobile-for-the-real-world-2025/
 *
 * CHỌN GÌ CHO SDFish: bà con dùng điện thoại phổ thông rẻ tiền, thường là máy
 * ĐÃ DÙNG VÀI NĂM (pin chai ⇒ hệ điều hành hạ xung, bộ nhớ đầy ⇒ dọn rác nhiều
 * hơn). Nên lấy dải ×6 (mốc Chrome, dùng cho "khá") tới ×9 (đo thật, dùng cho
 * "xấu"), và ×4 cho máy tầm trung. Không lấy một con số duy nhất — một con số
 * duy nhất trông chắc chắn hơn thực tế.
 */
const SLOWDOWN = [
  ["Máy tầm trung (Galaxy A54 hoặc tương đương)", 4],
  ["Máy phổ thông, còn khoẻ", 6],
  ["Máy phổ thông đã dùng vài năm", 9],
];

function part6() {
  section(6, "Quy đổi sang máy yếu — ước lượng có nguồn, KHÔNG phải phép đo");

  const s1 = deviceScore();
  const s2 = deviceScore();
  const best = Math.min(s1.ms, s2.ms);
  console.log(
    `\n  CHỈ SỐ MÁY NÀY: ${ms(best)} ms cho khối việc chuẩn ` +
      `(${(400000 / best).toFixed(0)} thao tác/ms)\n` +
      `  ${process.version} · ${process.platform}/${process.arch}\n` +
      "  Chạy bộ đo trên máy khác thì chia hai chỉ số này là ra hệ số giữa hai máy —\n" +
      "  đừng so ms với ms khi chỉ số máy khác nhau.\n",
  );

  console.log("  HỆ SỐ CHẬM DÙNG ĐỂ QUY ĐỔI (nguồn ghi trong mã, phần SLOWDOWN):");
  table(
    ["loại máy", "hệ số", "nguồn"],
    [
      ["Máy tầm trung (Galaxy A54…)", "×4", "Lighthouse mặc định / DevTools mid-tier"],
      ["Máy phổ thông, còn khoẻ", "×6", "DevTools low-tier"],
      ["Máy phổ thông đã dùng vài năm", "×9", "Đo thật A15 5G (csswizardry 8/2025): ×9,1"],
    ],
  );

  console.log(
    "\n  GIỚI HẠN CỦA PHÉP QUY ĐỔI — đọc trước khi trích số ra ngoài:\n" +
      "   (a) Hệ số CPU là MỘT SỐ NHÂN ĐỀU. Đời thật không đều: việc nặng bộ nhớ\n" +
      "       (bộ rạn 4 triệu đỉnh) chậm hơn hệ số vì máy rẻ có ít bộ nhớ đệm và\n" +
      "       băng thông RAM thấp; việc nặng số học chậm đúng hệ số hơn.\n" +
      "   (b) RAM là VÁCH ĐỨNG, không phải hệ số. Máy 3–4 GB mà app xin thêm vài\n" +
      "       trăm MB thì không 'chậm gấp 9' — nó bị hệ điều hành GIẾT. Cột 'RAM\n" +
      "       giữ' ở phần 1–2 phải đọc như ngưỡng an toàn, không phải như thời gian.\n" +
      "   (c) Node ≠ trình duyệt. V8 giống nhau nhưng dọn rác, phân bổ luồng, và\n" +
      "       nhất là WebGL thì khác hẳn. Phần WebGL không có trong bảng này chút nào.\n" +
      "   (d) Máy điện thoại HẠ XUNG KHI NÓNG. Bà con để máy trên buồng lái nắng\n" +
      "       chiếu, sau 10 phút hệ số thực tế còn tệ hơn ×9. Không mô phỏng được\n" +
      "       ở Node, và cũng không có trong hệ số của Chrome/Lighthouse.\n" +
      "   (e) Node KHÔNG có cách giới hạn CPU thật. `--cpu-prof` chỉ đo, không hãm;\n" +
      "       `--max-old-space-size` hãm được RAM nhưng đó là RAM chứ không phải CPU.\n" +
      "       Muốn số thật thì phải chạy trên MÁY THẬT hoặc Chrome DevTools bật\n" +
      "       CPU throttling — đó là việc phải làm sau bộ đo này.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PHẦN 7 — NGÂN SÁCH + XẾP HẠNG
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ngân sách đề xuất. Lý do lấy từ TRẢI NGHIỆM, không phải số đẹp:
 *
 *  · 100 ms — ngưỡng "máy phản hồi tức thì". Miller 1968 / Card 1991, được RAIL
 *    của nhóm Chrome lấy làm mốc Response.
 *    https://web.dev/articles/rail
 *  · 1 000 ms — ngưỡng giữ được mạch suy nghĩ. Quá 1 giây là người dùng bắt đầu
 *    ý thức mình đang CHỜ (Nielsen, "Response Times: The 3 Important Limits").
 *    https://www.nngroup.com/articles/response-times-3-important-limits/
 *  · 10 000 ms — ngưỡng bỏ cuộc, đi làm việc khác. Cùng nguồn.
 *  · 16 ms/khung — 60 khung/giây khi kéo bản đồ. RAIL, mục Animation.
 *  · 50 ms — trần cho một khối việc trên luồng chính; dài hơn là chạm bị trễ
 *    (RAIL, mục Idle; cũng là định nghĩa "long task").
 *
 * MẶT BIỂN LÀM MỌI NGƯỠNG NGẶT HƠN: bà con cầm máy trên tàu lắc, một tay bám.
 * Bản đồ đơ 1 giây trên bàn làm việc là khó chịu; đơ 1 giây lúc đang áp bãi cạn
 * là bỏ máy xuống. Nên bản này chia hai mốc riêng, ngặt hơn mốc web thường:
 */
const BUDGETS = [
  {
    mốc: "THẤY BIỂN — có màu nước + hình bờ",
    ngân: 1000,
    vì: "Nielsen 1s: quá đây là bà con biết mình đang chờ. Màn trắng trên tàu = tưởng app hỏng.",
  },
  {
    mốc: "THẤY BẢN ĐỒ — ô nền + đường đẳng sâu ở khung nhìn đầu",
    ngân: 2500,
    vì: "Mốc LCP 'tốt' của Core Web Vitals. Đây là lúc bà con đọc được vị trí mình.",
  },
  {
    mốc: "CHẠM ĐƯỢC — kéo/zoom mượt, chạm ra thông tin",
    ngân: 100,
    vì: "RAIL Response 100 ms. Chạm không nhả trong 100 ms là bà con chạm lại — rồi chạm nhầm.",
  },
  {
    mốc: "MỘT KHUNG HÌNH khi kéo bản đồ",
    ngân: 16,
    vì: "RAIL Animation 16 ms. Giật khi kéo trên tàu lắc còn khó chịu gấp đôi trên bàn.",
  },
  {
    mốc: "MỘT KHỐI VIỆC trên luồng chính",
    ngân: 50,
    vì: "RAIL Idle 50 ms / định nghĩa long task. Dài hơn là tay chạm bị nuốt.",
  },
];

function part7() {
  section(7, "Ngân sách thời gian + xếp hạng chỗ tốn nhất");

  console.log("\n  NGÂN SÁCH ĐỀ XUẤT (đo TRÊN MÁY BÀ CON, không phải máy dev):\n");
  table(
    ["mốc người dùng cảm nhận được", "ngân sách", "vì sao đúng con số đó"],
    BUDGETS.map((b) => [b.mốc, b.ngân + " ms", b.vì]),
  );

  if (!MARKS.length) {
    console.log("\n  (chưa có mốc nào được đo — chạy đủ các phần để có bảng xếp hạng)");
    return;
  }

  const rank = (list, title) => {
    console.log("\n\n  " + title + "\n");
    const sorted = [...list].sort((a, b) => b.ms - a.ms);
    table(
      ["#", "mốc đo", "nhóm", "máy dev", "×4", "×6", "×9", "ghi chú"],
      sorted.map((m, i) => [
        String(i + 1),
        m.name.length > 52 ? m.name.slice(0, 51) + "…" : m.name,
        m.group,
        ms(m.ms),
        ms(m.ms * 4),
        ms(m.ms * 6),
        ms(m.ms * 9),
        m.note ?? "",
      ]),
    );
    return sorted;
  };

  const live = MARKS.filter((m) => m.live);
  const notLive = MARKS.filter((m) => !m.live);

  const sortedLive = rank(
    live,
    "XẾP HẠNG (A) — CHỈ NHỮNG GÌ APP CHẠY THẬT HÔM NAY, kèm quy đổi máy yếu:",
  );
  if (notLive.length) {
    rank(
      notLive,
      "XẾP HẠNG (B) — CHƯA nằm trong đường chạy: bộ rạn ACA (chưa nối) và các\n" +
        "  cách khai source khác (isobaths/rạn OSM hôm nay khai bằng URL nên KHÔNG\n" +
        "  đi qua postMessage). Đây là bảng CÁI GIÁ NẾU LÀM, không phải cái đang tốn:",
    );
  }

  /*  CỘNG THEO LỚP BẢN ĐỒ — bảng quan trọng nhất của phần này.

      Xếp hạng từng thao tác ở trên dễ dẫn tới kết luận sai: không có mốc nào
      MỘT MÌNH vượt ngân sách, nên nhìn qua tưởng "chẳng có gì chậm". Nhưng bà
      con không chờ một thao tác — bà con chờ MỘT LỚP hiện lên, mà mỗi lớp là
      một chuỗi: tải → parse → (clone nếu truyền object) → dựng chỉ mục → cắt
      những ô đầu tiên. Cộng đúng chuỗi đó mới ra thứ có thể so với ngân sách. */
  const LAYER_OF = [
    [/isobath/i, "Đường đẳng sâu (isobaths.v1.json)"],
    [/seamark|báo hiệu/i, "Báo hiệu hàng hải (seamarks.v1.json)"],
    [/reef-shapes\.v1|rạn OSM/i, "Hình rạn OSM (reef-shapes.v1.json)"],
    [/vn-coast/i, "Bờ biển offline (vn-coast.v1.json)"],
    [/sea-lanes/i, "Luồng / tuyến (vn-sea-lanes.v1.json)"],
    [/vn-islands|coral-reefs|vn-aids/i, "Nhãn đảo / rạn / báo hiệu VN"],
    [/PMTiles|pmtiles|ArrayBuffer|ô nền|thư mục gốc/i, "Nền vector PMTiles"],
    [/depth-grid/i, "Lưới độ sâu (tra điểm, không vẽ)"],
    [/buildMapStyle/i, "Dựng style"],
  ];
  const layerOf = (m) => LAYER_OF.find(([re]) => re.test(m.name))?.[1] ?? "khác";
  const byLayer = new Map();
  for (const m of live) {
    const k = layerOf(m);
    byLayer.set(k, (byLayer.get(k) ?? 0) + m.ms);
  }
  console.log(
    "\n\n  CỘNG THEO LỚP BẢN ĐỒ — cái bà con thật sự ngồi chờ:\n" +
      "  (một lớp = tải → parse → clone nếu truyền object → dựng chỉ mục → cắt ô đầu)\n",
  );
  table(
    ["lớp bản đồ", "máy dev", "×4", "×6", "×9", "so ngân sách 2.500 ms (×6)"],
    [...byLayer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, t]) => [
        k,
        ms(t) + " ms",
        ms(t * 4) + " ms",
        ms(t * 6) + " ms",
        ms(t * 9) + " ms",
        ((t * 6 * 100) / 2500).toFixed(0) + "% ngân sách",
      ]),
  );

  // Chỗ nào một mình đã ăn hết ngân sách "thấy bản đồ" trên máy phổ thông?
  const over = sortedLive.filter((m) => m.ms * 6 > 1000);
  console.log(
    `\n  Trong bảng (A): ${over.length}/${sortedLive.length} mốc, MỘT MÌNH nó, vượt 1 giây ` +
      "trên máy phổ thông (×6).\n  Cộng dồn theo nhóm (chỉ bảng A):\n",
  );
  const byGroup = new Map();
  for (const m of live) byGroup.set(m.group, (byGroup.get(m.group) ?? 0) + m.ms);
  table(
    ["nhóm việc", "cộng dồn máy dev", "×6", "×9"],
    [...byGroup.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([g, t]) => [g, ms(t) + " ms", ms(t * 6) + " ms", ms(t * 9) + " ms"]),
  );
  console.log(
    "\n  ⚠️ 'Cộng dồn' KHÔNG phải thời gian mở app: vài mốc là các cách khác nhau cho\n" +
      "     cùng một việc, vài mốc chạy trong worker song song với luồng chính, và\n" +
      "     lớp đường đẳng sâu chỉ dựng khi bà con đang ở nền 'hải đồ độ sâu'. Bảng\n" +
      "     này để so BẬC ĐỘ LỚN giữa các nhóm, không phải để cộng ra một con số.\n" +
      "\n  ⚠️ VÀ NHỚ: bảng này THIẾU toàn bộ phần WebGL, bố trí nhãn, dựng bucket, và\n" +
      "     thời gian phân tích bundle maplibre-gl — xem đầu file. Thời gian mở bản\n" +
      "     đồ THẬT lớn hơn tổng ở đây, không nhỏ hơn.",
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHẠY
   ══════════════════════════════════════════════════════════════════════════ */

async function main() {
  const want = process.argv.slice(2).filter((a) => /^[1-7]$/.test(a));
  const run = (n) => want.length === 0 || want.includes(String(n));

  console.log(
    "\nBỘ ĐO TỐC ĐỘ HIỂN THỊ BẢN ĐỒ SDFish — dữ liệu thật + mã thật\n" +
      `Node ${process.version} · ${process.platform}/${process.arch} · ` +
      `${new Date().toISOString().slice(0, 10)}`,
  );

  // Phần 2, 3 cần kết quả giải mã của phần 1 — nạp im lặng nếu bỏ qua phần 1.
  if (run(1)) part1();
  else if (run(2) || run(3)) {
    const quiet = console.log;
    console.log = () => {};
    try {
      part1();
    } finally {
      console.log = quiet;
    }
    MARKS.length = 0;
  }

  if (run(2)) await part2();
  if (run(3)) await part3();
  if (run(4)) await part4();
  if (run(5)) await part5();
  if (run(6)) part6();
  if (run(7)) part7();

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
