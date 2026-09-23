// Sinh LỚP CHẤT ĐÁY (nature of seabed) cho Trục 1 — chạy MỘT LẦN (khi có mạng):
//   node scripts/generate-chat-day.mjs
//
// Đầu ra: public/data/chat-day.v1.json — bảng tra + mảng số (KHÔNG hình học,
// chỉ ĐIỂM đại diện cho một ô lưới nhỏ đã có mẫu thật — xem "GOM Ô" bên dưới).
//
// ── VÌ SAO CÓ FILE NÀY ───────────────────────────────────────────────────
// Hải đồ thương mại nào cũng ghi chất đáy (S cát, M bùn, R đá, Co san hô, G
// sỏi…) — ngư dân cần để thả neo (neo không bám đá) và để biết cá đáy nào ở
// đâu (cá mú quanh đá/san hô, cá đáy mềm ở bùn cát). App CHƯA có lớp này.
//
// ── NGUỒN: Allen Coral Atlas — layer `benthic_data_verbose` ──────────────
// KHÔNG PHẢI layer `geomorphic_data_verbose` đã dùng cho reef-shapes-aca.mjs
// (đó là phân VÙNG địa mạo — Reef Crest/Slope/Flat/Lagoon — suy ra được đáy
// CỨNG/MỀM nhưng là SUY). Layer `benthic_data_verbose` phân loại CHẤT ĐÁY
// TRỰC TIẾP từ ảnh PlanetScope 5 m: class_name quan sát được trong khung biển
// VN (đo 2026-09-03, mẫu Đá Chữ Thập 9,55N/112,89E) gồm Sand, Rubble,
// Coral/Algae, Seagrass — đúng nhóm "sand/rubble/rock/coral" bà con cần, và
// NGUỒN GHI THẲNG (không phải suy diễn từ hình rạn) → độ tin cậy cao hơn.
// GetCapabilities xác nhận layer tồn tại:
//   https://allencoralatlas.org/geoserver/ows?service=wfs&version=1.0.0&request=GetCapabilities
//   → <Name>coral-atlas:benthic_data_verbose</Name>
// Giấy phép: CC BY 4.0 (ghi công, KHÔNG share-alike) — GIỐNG hệt layer
// geomorphic đã đăng ký sẵn ở `src/lib/provenance.ts` SOURCES.aca, dùng lại,
// không đăng ký nguồn mới.
//
// ⚠️ PHẢI dùng WFS 1.0.0 (2.0.0 đảo trục lat/lon, trả 0 feature KHÔNG báo lỗi
// — án lệ ghi trong generate-reef-shapes-aca.mjs, cùng máy chủ).
//
// ── PHỦ: chỉ 88 Ô 1°×1° ĐÃ BIẾT CÓ RẠN (đo 2026-09-03) ─────────────────────
// ACA chỉ phân loại được nơi CÓ ảnh vệ tinh rạn nông (< ~15 m) — phần lớn
// Biển Đông không có gì để phân loại. Quét trọn khung VN từng dùng cho
// geomorphic_data_verqbose (VN_BBOX 88 ô 1°×1° có ≥1 feature trên tổng 337 ô)
// — benthic dùng CHUNG quy trình xử lý ảnh của ACA với geomorphic (cùng đơn vị
// rạn), nên phủ ⊆ phủ geomorphic. Ghim sẵn danh sách 88 ô để KHỎI quét lại
// 233 ô biển trống (tốn ~40 phút, 0 kết quả). Nguồn thật đổi (ACA thêm vùng
// mới) → chạy `--full-sweep` để quét lại toàn khung rồi cập nhật mảng này.
const KNOWN_REEF_TILES = [
  [102, 10], [102, 11], [102, 12], [102, 5], [102, 9], [103, 10], [103, 11],
  [103, 4], [103, 5], [103, 9], [104, 10], [104, 8], [104, 9], [105, 18],
  [105, 19], [106, 17], [106, 18], [106, 8], [107, 10], [107, 17], [107, 20],
  [107, 21], [107, 4], [108, 10], [108, 11], [108, 15], [108, 16], [108, 19],
  [108, 21], [108, 4], [109, 11], [109, 12], [109, 13], [109, 14], [109, 15],
  [109, 18], [109, 19], [109, 20], [109, 21], [110, 18], [110, 19], [110, 20],
  [111, 15], [111, 16], [111, 17], [111, 19], [111, 21], [111, 8], [112, 16],
  [112, 21], [112, 5], [112, 8], [112, 9], [113, 10], [113, 21], [113, 22],
  [113, 6], [113, 7], [113, 8], [113, 9], [114, 10], [114, 11], [114, 21],
  [114, 22], [114, 4], [114, 7], [114, 8], [114, 9], [115, 10], [115, 11],
  [115, 22], [115, 5], [115, 6], [115, 8], [115, 9], [116, 10], [116, 20],
  [116, 5], [116, 6], [116, 7], [116, 8], [116, 9], [117, 15], [117, 5],
  [117, 6], [117, 7], [117, 8], [117, 9],
];

// ── GOM Ô: điểm đại diện, KHÔNG nội suy vùng trắng ────────────────────────
// ACA trả ~5 m/mảnh (bằng pixel ảnh) — hàng trăm nghìn mảnh nếu giữ nguyên.
// Gom về lưới CELL độ, MỖI Ô CÓ MẪU THẬT thành MỘT điểm (loại chiếm nhiều
// diện tích nhất trong ô + % diện tích của nó + số mảnh gộp). Ô KHÔNG có mảnh
// nào thì KHÔNG xuất điểm — tuyệt đối không nội suy chất đáy giữa hai điểm có
// mẫu (nội suy chất đáy nguy hiểm hơn nội suy độ sâu, xem CLAUDE.md phần bẫy).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const OUT_PATH = argOf("--out", "public/data/chat-day.v1.json");
const FULL_SWEEP = argv.includes("--full-sweep");

/** Khung trọn vùng biển VN [Tây, Nam, Đông, Bắc] — GIỐNG generate-reef-shapes-aca.mjs. */
const [W, S, E, N] = [102.0, 4.0, 118.0, 24.0];

/** Lưới gom, độ. 0,001° ≈ 111 m ở xích đạo — đủ thô để nén, đủ mịn để không
 *  trộn lẫn hai chất đáy khác hẳn nhau trong cùng một ô (rạn hẹp, đổi chất đáy
 *  nhanh trong vài chục mét). Đo thật ở BƯỚC 2 nếu quá nhiều điểm thì nới. */
const CELL = Number(argOf("--cell", "0.001"));
const ROUND = 4; // làm tròn toạ độ điểm xuất — 4 số ~11 m, đủ cho tâm ô 111 m

const AT = new Date().toISOString().slice(0, 10);
const UA = "SDFish-build/1.0 (fisherman app; nautical chart)";

const ACA_URL = "https://allencoralatlas.org/geoserver/ows";
const ACA_LAYER = "coral-atlas:benthic_data_verbose";
const TILE_DEG = 1.0;
const TILE_MAX_FEATURES = 15000;
const CONCURRENCY = 3;
const CACHE_DIR = process.env.SDFISH_CHATDAY_CACHE ?? join(tmpdir(), "sdfish-chatday-cache");

/** class_name của ACA → mã ngắn + nhãn Việt. Loại LẠ (ACA thêm class mới) rơi
 *  về "khac" — KHÔNG ném lỗi (không được chặn cả lớp vì một class mới), nhưng
 *  in cảnh báo để người chạy script biết mà bổ sung bảng này. */
export const ACA_BENTHIC_CLASS = {
  Sand: "S",
  Rubble: "G", // vụn san hô/đá — gần nghĩa "sỏi" nhất trong bộ mã hải đồ
  "Coral/Algae": "Co",
  Rock: "R",
  Seagrass: "Sg",
  "Microalgal Mats": "Ma",
};
export const CODES = ["S", "R", "Co", "G", "Sg", "Ma", "khac"];

async function getText(url, { tries = 4, timeoutMs = 300_000, label = "" } = {}) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json,*/*" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.text();
      if (res.ok) return body;
      last = `HTTP ${res.status}`;
      if (res.status < 500) throw new Error(`${label} ${last}: ${body.slice(0, 200)}`);
    } catch (e) {
      last = e.message;
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw new Error(`${label} hỏng sau ${tries} lượt: ${last}`);
}

function acaUrl(bbox, max) {
  const qs = new URLSearchParams({
    service: "WFS",
    version: "1.0.0", // ⚠️ 2.0.0 đảo trục lat/lon → 0 feature, KHÔNG báo lỗi
    request: "GetFeature",
    typeName: ACA_LAYER,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    maxFeatures: String(max),
    bbox: bbox.join(","),
  });
  return `${ACA_URL}?${qs}`;
}

function cachePath(bbox) {
  return join(CACHE_DIR, `benthic_${bbox.map((v) => v.toFixed(4)).join("_")}.json`);
}

async function fetchTile(bbox) {
  const p = cachePath(bbox);
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  const body = await getText(acaUrl(bbox, TILE_MAX_FEATURES), { label: "ACA benthic" });
  const j = JSON.parse(body);
  writeFileSync(p, body);
  return j;
}

/** Ô nào chạm trần thì chia tư — không được lặng lẽ mất mảnh. */
async function loadTile(bbox, onFeatures, depth = 0) {
  const j = await fetchTile(bbox);
  const feats = j.features ?? [];
  const total = j.totalFeatures ?? feats.length;
  if (total > TILE_MAX_FEATURES || feats.length >= TILE_MAX_FEATURES) {
    if (depth > 6) throw new Error(`Ô ${bbox} vẫn quá dày sau ${depth} lần chia`);
    const [w, s, e, n] = bbox;
    const mx = (w + e) / 2;
    const my = (s + n) / 2;
    for (const sub of [
      [w, s, mx, my],
      [mx, s, e, my],
      [w, my, mx, n],
      [mx, my, e, n],
    ]) {
      await loadTile(sub, onFeatures, depth + 1);
    }
    return;
  }
  onFeatures(feats);
}

async function loadAll(onFeatures) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const tiles = [];
  if (FULL_SWEEP) {
    for (let x = W; x < E - 1e-9; x += TILE_DEG) {
      for (let y = S; y < N - 1e-9; y += TILE_DEG) {
        tiles.push([x, y, Math.min(x + TILE_DEG, E), Math.min(y + TILE_DEG, N)]);
      }
    }
  } else {
    for (const [x, y] of KNOWN_REEF_TILES) {
      tiles.push([x, y, x + TILE_DEG, y + TILE_DEG]);
    }
  }
  let done = 0;
  let i = 0;
  const worker = async () => {
    for (;;) {
      const k = i++;
      if (k >= tiles.length) return;
      await loadTile(tiles[k], onFeatures);
      done++;
      if (done % 10 === 0 || done === tiles.length) {
        process.stdout.write(`  ACA benthic ${done}/${tiles.length} ô\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/** Tâm hình học thô của vòng ngoài — polygon ACA nhỏ ~5–25 m, gần vuông, nên
 *  trung bình đỉnh là xấp xỉ đủ tốt (không cần công thức centroid có trọng số
 *  diện tích cho việc GOM Ô, sai số dưới nửa cạnh ô lưới CELL). */
function ringCentroid(ring) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const [lon, lat] of ring) {
    x += lon;
    y += lat;
    n++;
  }
  return n > 0 ? [x / n, y / n] : null;
}

function featureCentroid(geom) {
  if (!geom) return null;
  if (geom.type === "Polygon") return ringCentroid(geom.coordinates[0]);
  if (geom.type === "MultiPolygon") {
    // đa giác LỚN NHẤT theo số đỉnh vòng ngoài — đại diện đủ cho việc gom ô
    let best = null;
    let bestLen = -1;
    for (const poly of geom.coordinates) {
      const ring = poly[0];
      if (ring && ring.length > bestLen) {
        bestLen = ring.length;
        best = ring;
      }
    }
    return best ? ringCentroid(best) : null;
  }
  return null;
}

// ── CHẠY ───────────────────────────────────────────────────────────────────
console.log(`CHẤT ĐÁY — Allen Coral Atlas benthic_data_verbose · ${AT}`);
console.log(`cache ô: ${CACHE_DIR}`);
console.log(FULL_SWEEP ? "quét TOÀN khung VN (337 ô)" : `quét ${KNOWN_REEF_TILES.length} ô đã biết có rạn`);

/** Map<"cx,cy", { area: number[] (theo CODES index), n: number }> */
const cells = new Map();
const classTally = new Map();
let rawFeatureCount = 0;
let unknownClasses = new Set();

function onFeatures(feats) {
  for (const f of feats) {
    rawFeatureCount++;
    const className = f.properties?.class_name;
    classTally.set(className, (classTally.get(className) ?? 0) + 1);
    let code = ACA_BENTHIC_CLASS[className];
    if (!code) {
      code = "khac";
      if (className && !unknownClasses.has(className)) {
        unknownClasses.add(className);
        console.warn(`  ⚠️ class_name lạ chưa có trong bảng mã: "${className}"`);
      }
    }
    const codeIdx = CODES.indexOf(code);
    const area = typeof f.properties?.area_sqkm === "number" ? f.properties.area_sqkm : 0.000025;
    const c = featureCentroid(f.geometry);
    if (!c) continue;
    const [lon, lat] = c;
    if (lon < W || lon > E || lat < S || lat > N) continue;
    const cx = Math.floor(lon / CELL);
    const cy = Math.floor(lat / CELL);
    const key = `${cx},${cy}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { area: new Array(CODES.length).fill(0), n: 0 };
      cells.set(key, cell);
    }
    cell.area[codeIdx] += area;
    cell.n++;
  }
}

await loadAll(onFeatures);

console.log(`\nmảnh ACA thô: ${rawFeatureCount.toLocaleString("vi-VN")}`);
console.log("theo class_name:");
for (const [k, v] of [...classTally.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k ?? "(rỗng)"}: ${v.toLocaleString("vi-VN")}`);
}
console.log(`ô lưới ${CELL}° có mẫu: ${cells.size.toLocaleString("vi-VN")}`);

// ── XUẤT: bảng tra + mảng số ────────────────────────────────────────────
// points[i] = [lon, lat, codeIdx, tyLe (0-100, % diện tích của loại thắng
//              trong ô — đo ĐỘ THUẦN của ô, không phải độ tin cậy phép đo),
//              soManh (số mảnh ACA gộp vào ô — càng nhiều càng chắc)]
const points = [];
for (const [key, cell] of cells) {
  const [cx, cy] = key.split(",").map(Number);
  const lon = Number(((cx + 0.5) * CELL).toFixed(ROUND));
  const lat = Number(((cy + 0.5) * CELL).toFixed(ROUND));
  let bestIdx = 0;
  let bestArea = -1;
  let total = 0;
  for (let i = 0; i < cell.area.length; i++) {
    total += cell.area[i];
    if (cell.area[i] > bestArea) {
      bestArea = cell.area[i];
      bestIdx = i;
    }
  }
  const tyLe = total > 0 ? Math.round((bestArea / total) * 100) : 0;
  points.push([lon, lat, bestIdx, tyLe, cell.n]);
}
points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const out = {
  v: 1,
  nguon: "Allen Coral Atlas — benthic_data_verbose (CC BY 4.0)",
  nhan:
    "Chất đáy VÙNG RẠN/ĐẢO — tham khảo, gom từ ảnh vệ tinh phân loại tự động, KHÔNG phủ đáy bùn/cát cửa sông ven bờ, không thay khảo sát đáy biển thật",
  layNgay: AT,
  cellDeg: CELL,
  codes: CODES,
  // points: [lon, lat, codeIdx, tyLeThuanPhanTram, soManhGop]
  points,
};

const json = JSON.stringify(out);
const bytes = Buffer.byteLength(json, "utf8");
console.log(`\nđiểm xuất: ${points.length.toLocaleString("vi-VN")} · ${(bytes / 1024 / 1024).toFixed(2)} MB`);

const MAX_BYTES = 20 * 1024 * 1024;
if (bytes > MAX_BYTES) {
  throw new Error(
    `chat-day.v1.json ${(bytes / 1024 / 1024).toFixed(1)} MB vượt trần 20 MB — nới --cell rồi chạy lại (KHÔNG tự nâng trần, hỏi Lead).`,
  );
}

mkdirSync("public/data", { recursive: true });
writeFileSync(OUT_PATH, json);
console.log(`đã ghi ${OUT_PATH}`);
