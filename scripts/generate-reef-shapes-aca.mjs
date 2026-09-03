// VẼ LẠI HÌNH RẠN TỪ NGUỒN ĐỘC LẬP — chạy MỘT LẦN (khi có mạng, ~30–60 phút):
//
//   node --max-old-space-size=8192 scripts/generate-reef-shapes-aca.mjs
//
// Đầu ra: public/data/reef-shapes-aca.v1.json — FeatureCollection<MultiPolygon>,
//   MỘT feature = MỘT CỤM rạn liên thông (xem phần (4) cuối file),
//   properties: { kind: "reef" | "shoal", prov: Provenance }
//   KHÔNG có trường tên nào (chủ dự án cấm tuyệt đối nhãn nước ngoài/chữ Hán).
//
// Đây là MỨC CHI TIẾT NHẤT và là bản DUY NHẤT nằm trong git. Hai mức nhẹ hơn
// ("vừa" mặc định, "nhẹ" cho máy yếu / sóng kém) sinh LÚC BUILD từ chính file
// này: `(đã bỏ — chủ dự án chốt 2026-08-30: chỉ MỘT bản chi tiết)`. Xem CLAUDE.md "Dữ liệu bản đồ trong git
// — CHỐNG PHÌNH". Chạy lại script này là một khoản nợ lịch sử git ~76 MB không
// trả lại được — chỉ chạy khi NGUỒN thật sự đổi, không phải khi sửa script.
//
// ═══ VÌ SAO CÓ FILE NÀY ════════════════════════════════════════════════════
// public/data/reef-shapes.v1.json (2.622 hình) bóc từ OpenStreetMap → ODbL, CÓ
// share-alike. Dự án tính bán licence dữ liệu (ForMaps) nên đó là hàng KHÔNG
// bán được. Hướng dẫn "Trivial Transformations" của OSMF đã chốt: đổi định
// dạng, cắt khung, Douglas–Peucker đều là *trivial* — dữ liệu vẫn là OSM. Chỉ
// VẼ LẠI TỪ NGUỒN ĐỘC LẬP mới thoát ràng buộc.
//
// Ranh giới pháp lý nằm ở hành vi TRÍCH XUẤT, không ở kết quả giống nhau: script
// này KHÔNG đọc một byte hình học nào từ bộ OSM khi dựng dữ liệu. Nó CÓ đọc bộ
// OSM ở cuối, nhưng chỉ để IN BÁO CÁO SO SÁNH (đếm hình, đo phủ ven bờ) — không
// có số liệu nào của OSM chảy vào file xuất.
//
// ═══ NGUỒN (cả hai CC BY 4.0 — ghi công, KHÔNG share-alike) ════════════════
//  · Allen Coral Atlas — WFS GeoServer, layer coral-atlas:geomorphic_data_verbose.
//    Phân loại địa mạo rạn từ ảnh PlanetScope 5 m. ⚠️ PHẢI dùng WFS 1.0.0: bản
//    2.0.0 đảo trục lat/lon và trả 0 feature KHÔNG BÁO LỖI (đã dò thật).
//  · UNEP-WCMC WCMC-008 v4.1 — ArcGIS FeatureServer, trần 2.000 bản ghi/lượt.
//
// THỨ TỰ TIN CẬY: ACA > WCMC. Lý do là PHƯƠNG PHÁP ĐO, không phải uy tín:
// ACA là remote-sensing 5 m, quy trình lặp lại được, sai số ước lượng được bằng
// GSD ảnh; WCMC là survey-compilation 30 m gộp từ nhiều khảo sát, sai số KHÔNG
// đều theo vùng. Cùng một chỗ mà hai bên đều thấy rạn thì mép của ACA nét hơn.
// Nên: nơi ACA có → dùng hình ACA, hình WCMC ở đó bị coi là TRÙNG và bỏ; nơi
// ACA KHÔNG có → giữ nguyên hình WCMC (đó là phần WCMC đóng góp thật).
//
// ═══ CÁCH "VẼ LẠI" ═════════════════════════════════════════════════════════
// ACA trả 251.308 mảnh đa giác trong khung VN — mảnh nhỏ nhất 24 m², tổng ~19
// triệu đỉnh (~535 MB GeoJSON thô). Đó là biên PIXEL của ảnh phân loại, không
// phải hình rạn. Giữ nguyên thì vừa quá nặng vừa răng cưa. Nên:
//   (1) TÔ mọi mảnh lên MỘT lưới chung 0,00005° (≈ 5,6 m) — hợp nhất tự động,
//       không cần thư viện cắt đa giác (nguyên tắc 1: cấm thêm dependency).
//   (2) DÒ BIÊN lưới đó bằng cách nối các cạnh ô có hàng xóm rỗng, hướng sao
//       cho phần đặc luôn nằm BÊN TRÁI → vòng ngoài ngược kim đồng hồ, vòng
//       lỗ (đầm trong rạn vòng) thuận kim đồng hồ. Lỗ được giữ ĐÚNG: tô đầy
//       lòng đầm là báo hiểm hoạ giả ở chỗ tàu đi được.
//   (3) Douglas–Peucker khử răng cưa.
//
// NGÂN SÁCH SAI SỐ (chủ dự án chốt: ≤ 1 px ở z14 ≈ 9,5 m — đừng hy sinh độ nét
// để tiết kiệm byte):
//   · lượng tử hoá lưới 0,00005°  → tệ nhất nửa đường chéo ô = 3,9 m
//   · Douglas–Peucker tol 0,00004° (4,45 m) cho lớp RẠN — vẫn > biên độ răng
//     cưa (nửa ô = 2,8 m) nên răng cưa sập hết, mà không ăn vào hình thật
//   · làm tròn 5 số thập phân = ĐÚNG bước lưới ⇒ 0 m sai số thêm
//   ⇒ cộng dồn tệ nhất 8,4 m ≈ 0,88 px ở z14 (9,5 m/px). Đạt.
// Lớp BÃI (đầm/thềm) đi tol rộng hơn — xem DP_TOL_SHOAL, đó là quyết định về
// chỗ nào CẦN nét, không phải mẹo nén.
// (Bộ OSM cũ: tol 0,0003° ≈ 32 m ⇒ 3,50 px ở z14.)
//
// ═══ BỘ NHỚ / THỜI GIAN ════════════════════════════════════════════════════
// Tải ~535 MB (có CACHE ra thư mục tạm, chạy lại không tải lại). Lưới giữ dạng
// RUN (đoạn liên tiếp mỗi hàng) chứ không giữ từng ô — 153 triệu ô thu về ~vài
// triệu run. Dò biên làm THEO TỪNG CỤM (connected component trên lưới thô 712 m)
// nên đỉnh điểm bộ nhớ chỉ bằng cụm rạn LỚN NHẤT, không phải cả Biển Đông.
// Vẫn cần `--max-old-space-size=8192` cho giai đoạn tô lưới.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── KHUNG + LƯỚI ───────────────────────────────────────────────────────────
// `--bbox w,s,e,n --out <file>` CHỈ để chạy thử một góc nhỏ cho nhanh. Hai cờ
// đi CẶP: đổi khung mà vẫn ghi đè file thật là xuất bản một bộ rạn thiếu — bà
// con sẽ tưởng chỗ trắng là chỗ không có rạn.
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const OUT_PATH = argOf("--out", "public/data/reef-shapes-aca.v1.json");
const bboxArg = argOf("--bbox", null);
if (bboxArg && OUT_PATH === "public/data/reef-shapes-aca.v1.json") {
  throw new Error("--bbox phải đi kèm --out <file khác>, đừng ghi đè bộ thật bằng khung thử.");
}

/** Khung trọn vùng biển VN [Tây, Nam, Đông, Bắc] — gồm Hoàng Sa/Trường Sa. */
const BBOX = bboxArg ? bboxArg.split(",").map(Number) : [102.0, 4.0, 118.0, 24.0];
const [W, S, E, N] = BBOX;

/** Bước lưới, độ. 0,00005° = ĐÚNG một đơn vị của ROUND=5 ⇒ làm tròn không mất gì. */
const CELL = 0.00005;
const ROUND = 5;
const XMAX = Math.round((E - W) / CELL); // 320.000 cột
const YMAX = Math.round((N - S) / CELL); // 400.000 hàng
const XSPAN = XMAX + 2; // để khoá đỉnh không đụng nhau giữa hai hàng

/**
 * Douglas–Peucker, độ.
 *  · RẠN (mặt rạn/đỉnh rạn/sườn rạn) = vật cản chết người → 0,00004° ≈ 4,45 m,
 *    giữ đúng ngân sách ≤ 1 px ở z14. Đây là chỗ KHÔNG được đổi độ nét lấy byte.
 *  · BÃI (đầm sâu / đầm nông / thềm) = nước tàu thường qua được, mép của nó
 *    không phải thứ người lái căn vào → 0,00012° ≈ 13,4 m (~1,4 px ở z14).
 *    Nới ở đây là quyết định về AN TOÀN (chỗ nào cần nét), không phải mẹo nén.
 *
 * ⚠️ ĐÂY LÀ MỨC CHI TIẾT NHẤT, và là bản DUY NHẤT nằm trong git (CLAUDE.md
 * "Dữ liệu bản đồ trong git — CHỐNG PHÌNH", quy tắc 2). Hai mức nhẹ hơn KHÔNG
 * sinh ở đây mà sinh LÚC BUILD từ chính file này —
 * `(đã bỏ — chủ dự án chốt 2026-08-30: chỉ MỘT bản chi tiết)`. Đừng thêm mức vào script này: mỗi biến thể
 * commit vào repo là một bản sao 40–75 MB nằm lại trong lịch sử git mãi mãi.
 */
const DP_TOL_REEF = Number(argOf("--tol-reef", "0.00004"));
const DP_TOL_SHOAL = Number(argOf("--tol-shoal", "0.00012"));

/** Lưới THÔ gom cụm khi dò biên: 128 ô = 0,0064° ≈ 712 m. */
const COARSE_SHIFT = 7;
/**
 * Lưới THÔ đối chiếu ACA↔WCMC: 0,002° ≈ 222 m (= 40 ô lưới chính).
 * Dùng lưới riêng vì hình WCMC là cả CỤM rạn — tô nó ở bước 5,6 m là hàng trăm
 * triệu ô cho một hình, vô ích: phép hỏi ở đây chỉ là "chỗ này hai bên có cùng
 * thấy rạn không", 222 m đã quá đủ.
 */
const CHECK_CELL = 0.002;
const CHECK_DIV = Math.round(CHECK_CELL / CELL); // 40
const CXMAX = Math.round((E - W) / CHECK_CELL);
const CXSPAN = CXMAX + 2;

/**
 * Trần cỡ file — 80 MB, và đây là một CHỖ PHẢI GIẢI THÍCH.
 *
 * Chủ dự án nói hai câu: "40–50 MB là chấp nhận được" VÀ "đừng hy sinh độ nét
 * để tiết kiệm byte". Đo thật ngày 29/08/2026 cho thấy hai câu đó XUNG ĐỘT: ở
 * độ nét ≤ 1 px z14, trọn khung VN là 75 MB (ACA khoanh 6.989 km² rạn, gấp gần
 * ba lần ước lượng ban đầu). Chọn theo câu SAU — độ nét — vì nó là câu ra lệnh,
 * còn 40–50 MB là một con số "chấp nhận được", không phải phép đo.
 * Trần 80 MB = 75 MB đo được + chỗ cho ACA mọc thêm lần sinh sau. Vượt nữa thì
 * HỎI LEAD, đừng tự nâng.
 * Bảng đánh đổi độ nét ↔ cỡ file: docs/research/ran-ve-lai-aca.md §4.
 *
 * ⚠️ File CHƯA nằm trong SHELL của service worker và CHƯA có màn nào đọc — Lead
 * quyết sau. Nếu đưa vào offline thì phải chạy lại bộ QA offline bắt buộc
 * (docs/app-map/ops/qa-offline-acceptance.md): 75 MB là rất nặng cho máy bà con
 * tải ở cảng sóng yếu. Chính vì vậy mới có BA MỨC (sinh lúc build từ file này,
 * xem `(đã bỏ — chủ dự án chốt 2026-08-30: chỉ MỘT bản chi tiết)`): mức nhẹ là lối thoát cho máy yếu / sóng
 * kém, mức chi tiết — file này — là bản đủ nét cho ai tải nổi.
 */
const MAX_BYTES = Number(argOf("--max-mb", "80")) * 1024 * 1024;

/** Ngày lấy dữ liệu, ghi vào lý lịch từng đối tượng ("YYYY-MM-DD"). */
const AT = new Date().toISOString().slice(0, 10);

const UA = "SDFish-build/1.0 (fisherman app; nautical chart)";

// ── NGUỒN ──────────────────────────────────────────────────────────────────
const ACA_URL = "https://allencoralatlas.org/geoserver/ows";
const ACA_LAYER = "coral-atlas:geomorphic_data_verbose";
const WCMC_URL =
  "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/FeatureServer/1/query";
const WCMC_VERSION = "WCMC-008 v4.1 (2021)";

/**
 * Lớp địa mạo ACA nào là "bãi" (shoal) — nước trong/quanh rạn, sâu hơn, tàu
 * thường qua được; còn lại là "rạn" (reef) = mặt rạn/đỉnh rạn/sườn rạn, cạn và
 * chết người. Tách hai loại vì gộp hết thành "reef" là báo hiểm hoạ GIẢ ngay
 * giữa lòng đầm — bà con sẽ tắt lớp cảnh báo, mất luôn cảnh báo thật.
 * Lớp lạ (ACA thêm class mới) → mặc định "reef": sai lệch nghiêng về CẢNH BÁO THỪA.
 */
const SHOAL_CLASSES = new Set(["Deep Lagoon", "Shallow Lagoon", "Plateau"]);

/** Tải theo ô 1°; ô nào quá dày thì tự chia tư. */
const TILE_DEG = 1.0;
const TILE_MAX_FEATURES = 15000;
const CONCURRENCY = 3;
const CACHE_DIR = process.env.SDFISH_ACA_CACHE ?? join(tmpdir(), "sdfish-aca-cache");

// ── MẠNG ───────────────────────────────────────────────────────────────────
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

// ── TOÁN CẦU (bản riêng — scripts/*.mjs không nạp được alias "@/lib") ───────
const R_EARTH_M = 6_371_008.8;
const rad = (d) => (d * Math.PI) / 180;
function haversineM(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── LƯỚI: TÔ ĐA GIÁC THÀNH "RUN" ───────────────────────────────────────────
// rows: Map<y, number[]> — mảng phẳng [x0,x1, x0,x1, …], nửa mở [x0,x1).
const reefRows = new Map();
const shoalRows = new Map();

function pushRun(rows, y, x0, x1, xmax) {
  // Lấy mẫu ở TÂM ô: ô x được tô khi tâm (x+0,5) rơi trong [x0,x1].
  let lo = Math.ceil(x0 - 0.5);
  let hi = Math.floor(x1 - 0.5);
  if (lo < 0) lo = 0;
  if (hi >= xmax) hi = xmax - 1;
  if (hi < lo) return;
  let arr = rows.get(y);
  if (!arr) {
    arr = [];
    rows.set(y, arr);
  }
  arr.push(lo, hi + 1);
}

/**
 * Tô một Polygon (vòng ngoài + vòng lỗ) lên lưới, luật CHẴN–LẺ.
 * Dùng bảng cạnh hoạt động (active edge table) để không thành O(hàng × cạnh):
 * vài mảnh ACA có hàng nghìn đỉnh, quét vét cạn ở đó là treo máy.
 */
function rasterizePolygon(rings, rows, cell = CELL, xmax = XMAX, ymax = YMAX) {
  const edges = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const ax = (ring[i][0] - W) / cell;
      const ay = (ring[i][1] - S) / cell;
      const bx = (ring[i + 1][0] - W) / cell;
      const by = (ring[i + 1][1] - S) / cell;
      if (ay === by) continue;
      edges.push(ay < by ? { y0: ay, y1: by, x0: ax, x1: bx } : { y0: by, y1: ay, x0: bx, x1: ax });
      if (ay < minY) minY = ay;
      if (by < minY) minY = by;
      if (ay > maxY) maxY = ay;
      if (by > maxY) maxY = by;
    }
  }
  if (!edges.length) return;
  edges.sort((p, q) => p.y0 - q.y0);

  let yStart = Math.floor(minY);
  let yEnd = Math.ceil(maxY);
  if (yStart < 0) yStart = 0;
  if (yEnd >= ymax) yEnd = ymax - 1;

  let ei = 0;
  let active = [];
  const xs = [];
  for (let y = yStart; y <= yEnd; y++) {
    const yc = y + 0.5;
    while (ei < edges.length && edges[ei].y0 <= yc) active.push(edges[ei++]);
    if (active.length === 0) continue;
    if (active.some((e) => e.y1 <= yc)) active = active.filter((e) => e.y1 > yc);
    xs.length = 0;
    for (const e of active) {
      if (e.y0 <= yc) xs.push(e.x0 + ((yc - e.y0) * (e.x1 - e.x0)) / (e.y1 - e.y0));
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) pushRun(rows, y, xs[i], xs[i + 1], xmax);
  }
}

function rasterizeGeometry(geom, rows, cell, xmax, ymax) {
  if (!geom) return;
  if (geom.type === "Polygon") rasterizePolygon(geom.coordinates, rows, cell, xmax, ymax);
  else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) rasterizePolygon(poly, rows, cell, xmax, ymax);
  }
}

/** Gộp run chồng/kề nhau trong MỘT hàng → danh sách rời nhau, tăng dần. */
function mergeRow(flat) {
  const n = flat.length / 2;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((a, b) => flat[2 * a] - flat[2 * b]);
  const out = [];
  let cs = -1;
  let ce = -1;
  for (const i of idx) {
    const a = flat[2 * i];
    const b = flat[2 * i + 1];
    if (cs < 0) {
      cs = a;
      ce = b;
    } else if (a <= ce) {
      if (b > ce) ce = b;
    } else {
      out.push(cs, ce);
      cs = a;
      ce = b;
    }
  }
  if (cs >= 0) out.push(cs, ce);
  return out;
}

function mergeAllRows(rows) {
  let runs = 0;
  let cells = 0;
  for (const [y, flat] of rows) {
    const m = mergeRow(flat);
    rows.set(y, m);
    runs += m.length / 2;
    for (let i = 0; i < m.length; i += 2) cells += m[i + 1] - m[i];
  }
  return { runs, cells };
}

// ── GOM CỤM TRÊN LƯỚI THÔ ──────────────────────────────────────────────────
/**
 * Vì sao gom cụm: dò biên phải giữ TOÀN BỘ cạnh của một vật trong bộ nhớ cùng
 * lúc. Cả Biển Đông một lượt là hàng chục triệu cạnh → sập heap. Rạn thì tách
 * nhau bởi nước sâu, nên gom theo ô thô 712 m rồi dò TỪNG CỤM: đỉnh điểm bộ
 * nhớ = cụm lớn nhất.
 */
function coarseComponents(rows) {
  const cells = new Set();
  for (const [y, m] of rows) {
    const cy = y >> COARSE_SHIFT;
    for (let i = 0; i < m.length; i += 2) {
      const cx0 = m[i] >> COARSE_SHIFT;
      const cx1 = (m[i + 1] - 1) >> COARSE_SHIFT;
      for (let cx = cx0; cx <= cx1; cx++) cells.add(cy * XSPAN + cx);
    }
  }
  const label = new Map();
  let next = 0;
  for (const start of cells) {
    if (label.has(start)) continue;
    const id = next++;
    const stack = [start];
    label.set(start, id);
    while (stack.length) {
      const k = stack.pop();
      const cy = Math.floor(k / XSPAN);
      const cx = k - cy * XSPAN;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nk = (cy + dy) * XSPAN + (cx + dx);
          if (cells.has(nk) && !label.has(nk)) {
            label.set(nk, id);
            stack.push(nk);
          }
        }
      }
    }
  }
  // Phát hàng-run về từng cụm.
  const comps = new Map();
  for (const [y, m] of rows) {
    const cy = y >> COARSE_SHIFT;
    for (let i = 0; i < m.length; i += 2) {
      const id = label.get(cy * XSPAN + (m[i] >> COARSE_SHIFT));
      let c = comps.get(id);
      if (!c) {
        c = new Map();
        comps.set(id, c);
      }
      let arr = c.get(y);
      if (!arr) {
        arr = [];
        c.set(y, arr);
      }
      arr.push(m[i], m[i + 1]);
    }
  }
  return comps;
}

// ── DÒ BIÊN → VÒNG ─────────────────────────────────────────────────────────
/** Phần của [a,b) KHÔNG được `other` (danh sách run rời, tăng dần) phủ. */
function gaps(a, b, other) {
  const out = [];
  let cur = a;
  for (let i = 0; i < other.length; i += 2) {
    const p = other[i];
    const q = other[i + 1];
    if (q <= cur) continue;
    if (p >= b) break;
    if (p > cur) out.push(cur, p < b ? p : b);
    if (q > cur) cur = q;
    if (cur >= b) break;
  }
  if (cur < b) out.push(cur, b);
  return out;
}

const EMPTY = [];

/**
 * Cạnh biên của một cụm, hướng sao cho PHẦN ĐẶC LUÔN BÊN TRÁI.
 * Ô (x,y) chiếm ô vuông lưới [x,x+1]×[y,y+1]:
 *   dưới trống → (x,y)→(x+1,y) · phải trống → (x+1,y)→(x+1,y+1)
 *   trên  trống → (x+1,y+1)→(x,y+1) · trái trống → (x,y+1)→(x,y)
 * Vòng ngoài ra ngược kim đồng hồ, vòng lỗ ra thuận kim đồng hồ.
 */
function traceComponent(compRows) {
  const outMap = new Map();
  const key = (x, y) => y * XSPAN + x;
  const addEdge = (x0, y0, x1, y1) => {
    const k = key(x0, y0);
    const v = key(x1, y1);
    const arr = outMap.get(k);
    if (arr) arr.push(v);
    else outMap.set(k, [v]);
  };

  for (const [y, m] of compRows) {
    const prev = compRows.get(y - 1) ?? EMPTY;
    const next = compRows.get(y + 1) ?? EMPTY;
    for (let i = 0; i < m.length; i += 2) {
      const a = m[i];
      const b = m[i + 1];
      addEdge(a, y + 1, a, y); // trái
      addEdge(b, y, b, y + 1); // phải
      const gb = gaps(a, b, prev);
      for (let k = 0; k < gb.length; k += 2) addEdge(gb[k], y, gb[k + 1], y);
      const gt = gaps(a, b, next);
      for (let k = 0; k < gt.length; k += 2) addEdge(gt[k + 1], y + 1, gt[k], y + 1);
    }
  }

  // Đi vòng. Ở đỉnh "thắt nút" (hai ô chạm nhau theo đường chéo) có 2 cạnh ra:
  // chọn cạnh RẼ TRÁI NHẤT ⇒ coi phần đặc là liên thông 4 hướng ⇒ hai ô chéo
  // thành HAI vòng ĐƠN riêng, thay vì một vòng tự chạm (GeoJSON không hợp lệ).
  const rings = [];
  const starts = [...outMap.keys()];
  for (const s of starts) {
    while (outMap.has(s)) {
      const ring = [];
      let cur = s;
      let dir = null;
      for (;;) {
        const list = outMap.get(cur);
        if (!list || !list.length) break;
        let pick = 0;
        if (list.length > 1 && dir) {
          const cy = Math.floor(cur / XSPAN);
          const cx = cur - cy * XSPAN;
          const order = [
            [-dir[1], dir[0]], // trái
            [dir[0], dir[1]], // thẳng
            [dir[1], -dir[0]], // phải
          ];
          outer: for (const [ox, oy] of order) {
            for (let j = 0; j < list.length; j++) {
              const ny = Math.floor(list[j] / XSPAN);
              const nx = list[j] - ny * XSPAN;
              if (Math.sign(nx - cx) === ox && Math.sign(ny - cy) === oy) {
                pick = j;
                break outer;
              }
            }
          }
        }
        const nxt = list[pick];
        list.splice(pick, 1);
        if (!list.length) outMap.delete(cur);
        ring.push(cur);
        const cy = Math.floor(cur / XSPAN);
        const cx = cur - cy * XSPAN;
        const ny = Math.floor(nxt / XSPAN);
        const nx = nxt - ny * XSPAN;
        dir = [Math.sign(nx - cx), Math.sign(ny - cy)];
        cur = nxt;
        if (cur === s) break;
      }
      if (ring.length >= 3) {
        ring.push(ring[0]);
        rings.push(ring.map((k) => {
          const yy = Math.floor(k / XSPAN);
          return [W + (k - yy * XSPAN) * CELL, S + yy * CELL];
        }));
      }
    }
  }
  return rings;
}

// ── ĐƠN GIẢN HOÁ (Douglas–Peucker — cùng khuôn generate-reef-shapes.mjs) ────
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

function dpRange(pts, first, last, tol2, keep) {
  const stack = [[first, last]];
  while (stack.length) {
    const [f, l] = stack.pop();
    let maxD = tol2;
    let idx = -1;
    for (let i = f + 1; i < l; i++) {
      const d = segDist2(pts[i], pts[f], pts[l]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx === -1) continue;
    keep[idx] = true;
    stack.push([f, idx], [idx, l]);
  }
}

/**
 * Vòng KÍN: hai mút trùng nên DP thẳng sẽ sập cả vòng; cắt vòng tại điểm XA mút
 * đầu nhất rồi chạy DP hai nửa. (Đệ quy đổi thành ngăn xếp: vòng ở đây dài tới
 * hàng trăm nghìn đỉnh, đệ quy sẽ tràn ngăn xếp.)
 */
function simplifyRing(pts, tol) {
  if (pts.length < 5) return pts;
  const tol2 = tol * tol;
  const last = pts.length - 1;
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[last] = true;
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
  return pts.filter((_, i) => keep[i]);
}

/**
 * CỨU VÒNG NHỎ: vòng bé hơn ~2×tol bị DP rút còn <4 điểm. KHÔNG được bỏ — mất
 * một vật cản khỏi hải đồ nguy hiểm hơn nhiều so với vẽ nó thô. Giữ 4 đỉnh cực
 * THẬT của vòng, đúng thứ tự gốc nên không tự cắt nhau.
 */
function extremeRing(pts) {
  const n = pts.length - 1;
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
  if (idx.length < 3) return null;
  const ring = idx.map((i) => pts[i]);
  ring.push(ring[0]);
  return ring;
}

const r5 = (v) => Number(v.toFixed(ROUND));

function finishRing(pts, tol) {
  let ring = simplifyRing(pts, tol);
  if (ring.length < 4) {
    ring = extremeRing(pts);
    if (!ring) return null;
  }
  const out = ring.map(([x, y]) => [r5(x), r5(y)]);
  out[out.length - 1] = out[0];
  return out;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

function bboxOf(ring) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Vòng ngoài (diện tích dương) + gán vòng lỗ vào vòng ngoài NHỎ NHẤT chứa nó. */
function ringsToPolygons(rings, tol) {
  const outers = [];
  const holes = [];
  for (const raw of rings) {
    const ring = finishRing(raw, tol);
    if (!ring || ring.length < 4) continue;
    const a = ringArea(ring);
    if (a === 0) continue;
    (a > 0 ? outers : holes).push({ ring, area: Math.abs(a), bbox: bboxOf(ring) });
  }
  outers.sort((p, q) => q.area - p.area);
  const polys = outers.map((o) => [o.ring]);
  for (const h of holes) {
    const p = h.ring[0];
    let best = -1;
    for (let i = 0; i < outers.length; i++) {
      const o = outers[i];
      if (p[0] < o.bbox[0] || p[0] > o.bbox[2] || p[1] < o.bbox[1] || p[1] > o.bbox[3]) continue;
      if (!pointInRing(p, o.ring)) continue;
      best = i; // outers đã sắp giảm dần ⇒ cái sau cùng khớp là NHỎ NHẤT chứa nó
    }
    if (best >= 0) polys[best].push(h.ring);
  }
  return polys;
}

// ── TẢI ACA THEO Ô, CÓ CACHE ───────────────────────────────────────────────
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
  return join(CACHE_DIR, `aca_${bbox.map((v) => v.toFixed(4)).join("_")}.json`);
}

async function fetchAcaTile(bbox) {
  const p = cachePath(bbox);
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  const body = await getText(acaUrl(bbox, TILE_MAX_FEATURES), { label: "ACA" });
  const j = JSON.parse(body);
  writeFileSync(p, body);
  return j;
}

/** Ô nào chạm trần thì chia tư — không được lặng lẽ mất rạn. */
async function loadAcaTile(bbox, onFeatures, depth = 0) {
  const j = await fetchAcaTile(bbox);
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
      await loadAcaTile(sub, onFeatures, depth + 1);
    }
    return;
  }
  onFeatures(feats);
}

async function loadAca(onFeatures) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const tiles = [];
  for (let x = W; x < E - 1e-9; x += TILE_DEG) {
    for (let y = S; y < N - 1e-9; y += TILE_DEG) {
      tiles.push([x, y, Math.min(x + TILE_DEG, E), Math.min(y + TILE_DEG, N)]);
    }
  }
  let done = 0;
  let i = 0;
  const worker = async () => {
    for (;;) {
      const k = i++;
      if (k >= tiles.length) return;
      await loadAcaTile(tiles[k], onFeatures);
      done++;
      if (done % 20 === 0 || done === tiles.length) {
        process.stdout.write(`  ACA ${done}/${tiles.length} ô\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// ── CHẠY: (1) TÔ LƯỚI TỪ ACA ───────────────────────────────────────────────
console.log(`VẼ LẠI RẠN — nguồn độc lập ACA + WCMC · ${AT}`);
console.log(`cache ô ACA: ${CACHE_DIR}`);

let acaFeatureCount = 0;
let acaVertexCount = 0;
let acaAreaSqkm = 0;
const classTally = new Map();

await loadAca((feats) => {
  for (const f of feats) {
    const cls = f.properties?.class_name ?? "(không rõ)";
    classTally.set(cls, (classTally.get(cls) ?? 0) + 1);
    acaAreaSqkm += f.properties?.area_sqkm ?? 0;
    acaFeatureCount++;
    const g = f.geometry;
    if (g?.type === "MultiPolygon") {
      for (const poly of g.coordinates) for (const ring of poly) acaVertexCount += ring.length;
    } else if (g?.type === "Polygon") {
      for (const ring of g.coordinates) acaVertexCount += ring.length;
    }
    rasterizeGeometry(g, SHOAL_CLASSES.has(cls) ? shoalRows : reefRows);
  }
});

console.log(
  `\nACA: ${acaFeatureCount.toLocaleString("vi-VN")} mảnh · ` +
    `${acaVertexCount.toLocaleString("vi-VN")} đỉnh thô · ` +
    `${acaAreaSqkm.toFixed(0)} km²`,
);
if (acaFeatureCount === 0) {
  console.warn("⚠️ ACA không trả gì — KHÔNG ghi đè file cũ. Chạy lại khi có mạng.");
  process.exit(0);
}

const reefStats = mergeAllRows(reefRows);
const shoalStats = mergeAllRows(shoalRows);
console.log(
  `Lưới ${CELL}° : rạn ${reefStats.runs.toLocaleString("vi-VN")} run / ` +
    `${reefStats.cells.toLocaleString("vi-VN")} ô · bãi ` +
    `${shoalStats.runs.toLocaleString("vi-VN")} run / ${shoalStats.cells.toLocaleString("vi-VN")} ô`,
);

// ── (2) DÒ BIÊN ────────────────────────────────────────────────────────────
function tracedClusters(rows, label, tol) {
  const comps = coarseComponents(rows);
  console.log(`  ${label}: ${comps.size.toLocaleString("vi-VN")} cụm`);
  const clusters = [];
  let n = 0;
  for (const compRows of comps.values()) {
    const polys = ringsToPolygons(traceComponent(compRows), tol);
    if (polys.length) clusters.push(polys);
    if (++n % 2000 === 0) process.stdout.write(`    ${label} ${n}/${comps.size}` + "\n");
  }
  return clusters;
}

console.log("\nDò biên…");
const reefClusters = tracedClusters(reefRows, "rạn", DP_TOL_REEF);
const shoalClusters = tracedClusters(shoalRows, "bãi", DP_TOL_SHOAL);

// Phủ ACA quy về lưới thô 222 m — lấy THẲNG từ lưới chính (rẻ), trước khi thả.
const acaCover = new Set();
for (const rows of [reefRows, shoalRows]) {
  for (const [y, m] of rows) {
    const cy = Math.floor(y / CHECK_DIV);
    for (let i = 0; i < m.length; i += 2) {
      const cx1 = Math.floor((m[i + 1] - 1) / CHECK_DIV);
      for (let cx = Math.floor(m[i] / CHECK_DIV); cx <= cx1; cx++) acaCover.add(cy * CXSPAN + cx);
    }
  }
}
reefRows.clear();
shoalRows.clear();
console.log(
  `→ ${reefClusters.length.toLocaleString("vi-VN")} cụm rạn · ` +
    `${shoalClusters.length.toLocaleString("vi-VN")} cụm bãi`,
);

// ── (3) WCMC ───────────────────────────────────────────────────────────────
async function loadWcmc() {
  const feats = [];
  for (let offset = 0; ; offset += 2000) {
    const qs = new URLSearchParams({
      geometry: BBOX.join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      where: "1=1",
      // CHỈ objectid: WCMC có `name`/`orig_name`/`species` chữ nước ngoài — không
      // kéo về thì không có đường nào lọt vào file.
      outFields: "objectid",
      returnGeometry: "true",
      resultRecordCount: "2000",
      resultOffset: String(offset),
      f: "geojson",
    });
    const j = JSON.parse(await getText(`${WCMC_URL}?${qs}`, { label: "WCMC" }));
    const page = j.features ?? [];
    feats.push(...page);
    if (page.length < 2000) break;
  }
  return feats;
}

console.log("\nWCMC…");
const wcmcRaw = await loadWcmc();
console.log(`WCMC: ${wcmcRaw.length} hình thô`);

console.log(`Phủ ACA (ô ${CHECK_CELL}° ≈ 222 m): ${acaCover.size.toLocaleString("vi-VN")}`);

/** Ô thô 222 m mà một hình WCMC chiếm (tô THẲNG trên lưới thô). */
function checkCellsOf(geom) {
  const rows = new Map();
  rasterizeGeometry(geom, rows, CHECK_CELL, CXMAX, Math.round((N - S) / CHECK_CELL));
  const set = new Set();
  for (const [y, flat] of rows) {
    const m = mergeRow(flat);
    for (let i = 0; i < m.length; i += 2) {
      for (let x = m[i]; x < m[i + 1]; x++) set.add(y * CXSPAN + x);
    }
  }
  return set;
}

/**
 * Ngưỡng TRÙNG 15%. Vì sao KHÔNG phải 50%: đo thật ở cụm Trường Sa thấy một
 * hình WCMC phủ 2.105 ô 222 m còn ACA chỉ 586 ô trong cùng chỗ (~28%) — không
 * phải vì ACA sót rạn, mà vì WCMC vẽ CẢ nền thềm quanh rạn thành một mảng thô
 * 30 m, còn ACA chỉ khoanh phần thật sự là rạn. Lấy 50% thì gần như KHÔNG hình
 * WCMC nào bị coi là trùng, và bộ dữ liệu sẽ vẽ chồng mảng thô lên đúng những
 * rạn đã có mép nét — người lái không biết tin mép nào.
 * Đọc ngược lại: có ≥15% thân hình WCMC nằm trên rạn ACA nghĩa là ACA ĐÃ lập
 * bản đồ cụm rạn đó; hình WCMC ở đấy không thêm thông tin, chỉ thêm nhiễu.
 * Dưới 15% (thường là 0%) mới là chỗ ACA MÙ — giữ nguyên hình WCMC, thà cảnh
 * báo thô còn hơn để trắng một vật cản. Phân bố tỉ lệ được IN ra để Lead soi.
 */
const DUP_RATIO = 0.15;

const wcmcKept = [];
const dupRatios = [];
let wcmcDup = 0;
let wcmcOutOfFrame = 0;
for (const f of wcmcRaw) {
  const cells = checkCellsOf(f.geometry);
  if (cells.size === 0) {
    wcmcOutOfFrame++;
    continue;
  }
  let hit = 0;
  for (const c of cells) if (acaCover.has(c)) hit++;
  const ratio = hit / cells.size;
  dupRatios.push(ratio);
  if (ratio >= DUP_RATIO) {
    wcmcDup++;
    continue;
  }
  wcmcKept.push(f);
}
const hist = [0, 0, 0, 0, 0];
for (const v of dupRatios) hist[v === 0 ? 0 : v < 0.05 ? 1 : v < 0.15 ? 2 : v < 0.5 ? 3 : 4]++;
console.log(
  `WCMC: giữ ${wcmcKept.length} · trùng ACA (bỏ) ${wcmcDup} · ngoài khung ${wcmcOutOfFrame}`,
);
console.log(
  `  tỉ lệ thân hình WCMC có rạn ACA bên dưới: 0% → ${hist[0]} · <5% → ${hist[1]}` +
    ` · 5–15% → ${hist[2]} · 15–50% → ${hist[3]} · ≥50% → ${hist[4]}`,
);

/**
 * CẮT VÀO KHUNG (Sutherland–Hodgman). WFS/FeatureServer trả hình GIAO với khung,
 * tức TRỌN hình kể cả phần tràn ra ngoài. Không cắt thì file mang toạ độ ngoài
 * vùng biển VN — cổng tự kiểm (d) chặn, mà bỏ cả hình thì mất rạn thật.
 */
function clipRingToFrame(ring) {
  let pts = ring;
  const edges = [
    [(p) => p[0] >= W, (a, b) => [W, a[1] + ((b[1] - a[1]) * (W - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= E, (a, b) => [E, a[1] + ((b[1] - a[1]) * (E - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= S, (a, b) => [a[0] + ((b[0] - a[0]) * (S - a[1])) / (b[1] - a[1]), S]],
    [(p) => p[1] <= N, (a, b) => [a[0] + ((b[0] - a[0]) * (N - a[1])) / (b[1] - a[1]), N]],
  ];
  for (const [inside, cut] of edges) {
    const next = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const ia = inside(a);
      const ib = inside(b);
      if (ia) next.push(a);
      if (ia !== ib) next.push(cut(a, b));
    }
    if (!next.length) return null;
    next.push(next[0]);
    pts = next;
  }
  return pts.length >= 4 ? pts : null;
}

// Chỉ mục đỉnh WCMC (ô 0,05°) để đo VÊNH tâm-ACA ↔ mép-WCMC gần nhất.
const VTX_CELL = 0.05;
const wcmcVtx = new Map();
for (const f of wcmcRaw) {
  const walk = (c) => {
    if (typeof c[0] === "number") {
      const k = `${Math.floor(c[1] / VTX_CELL)}|${Math.floor(c[0] / VTX_CELL)}`;
      let arr = wcmcVtx.get(k);
      if (!arr) {
        arr = [];
        wcmcVtx.set(k, arr);
      }
      arr.push(c);
    } else for (const x of c) walk(x);
  };
  walk(f.geometry.coordinates);
}

function nearestWcmcM(p) {
  const gy0 = Math.floor(p[1] / VTX_CELL);
  const gx0 = Math.floor(p[0] / VTX_CELL);
  let best = Infinity;
  for (let ring = 0; ring <= 2 && !Number.isFinite(best); ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const arr = wcmcVtx.get(`${gy0 + dy}|${gx0 + dx}`);
        if (!arr) continue;
        for (const q of arr) {
          const d = haversineM(p, q);
          if (d < best) best = d;
        }
      }
    }
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

// Phủ WCMC trên cùng lưới thô 222 m — để chấm "WCMC có xác nhận chỗ này không".
const wcmcCover = new Set();
for (const f of wcmcRaw) for (const c of checkCellsOf(f.geometry)) wcmcCover.add(c);
console.log(`Phủ WCMC (ô 222 m): ${wcmcCover.size.toLocaleString("vi-VN")}`);

// ── (4) ĐÓNG GÓI FEATURE + LÝ LỊCH NGUỒN ───────────────────────────────────
// Lý lịch để MỎNG có chủ ý: `version`/`url` là trường TUỲ CHỌN của `SourceRef`
// và GIỐNG HỆT nhau ở mọi đối tượng — nhân ra hàng chục nghìn lần là vài MB
// thuần lặp. Chúng nằm ở `properties.sources` cấp bộ: cùng thông tin, tra lại
// được, mà file nhẹ hơn. Thứ BẮT BUỘC theo từng đối tượng (nguồn hình học +
// đối chiếu chéo) thì vẫn đi kèm TỪNG đối tượng, đúng lý do tồn tại của
// src/lib/provenance.ts.
function clusterCentroid(polys) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const poly of polys) {
    const ring = poly[0];
    for (let i = 0; i + 1 < ring.length; i++) {
      x += ring[i][0];
      y += ring[i][1];
      n++;
    }
  }
  return [x / n, y / n];
}

function checkCellKey(lng, lat) {
  return Math.floor((lat - S) / CHECK_CELL) * CXSPAN + Math.floor((lng - W) / CHECK_CELL);
}

const features = [];
let agreedCount = 0;
let acaPolyCount = 0;
const offsets = [];

// MỘT feature = MỘT CỤM rạn (MultiPolygon), không phải một mảnh.
// Vì sao: ACA cắt một rạn thành hàng trăm mảnh pixel; đo thật ở cụm Trường Sa
// thấy TRUNG VỊ 7 đỉnh/mảnh — tức phần lớn "hình" chỉ là một chấm vài ô. Mỗi
// feature GeoJSON tốn ~215 byte khung + lý lịch dù chỉ có 5 đỉnh; ở quy mô cả
// Biển Đông đó là hàng chục MB thuần khung. Gom theo cụm liên thông (712 m) vừa
// cắt được khoản đó, vừa ĐÚNG hơn về nghĩa: "đối tượng" mà bà con nhìn thấy và
// mà lý lịch nguồn nói về, là CỤM RẠN, không phải mảnh pixel của nó.
for (const [clusters, kind] of [
  [reefClusters, "reef"],
  [shoalClusters, "shoal"],
]) {
  for (const polys of clusters) {
    acaPolyCount += polys.length;
    const c = clusterCentroid(polys);
    const prov = { origin: { source: "aca", at: AT } };
    if (wcmcCover.has(checkCellKey(c[0], c[1]))) {
      const off = nearestWcmcM(c);
      prov.crossChecks = [{ source: "wcmc", agreed: true, offsetM: off, at: AT }];
      agreedCount++;
      if (off != null) offsets.push(off);
    } else {
      // agreed=false BẮT BUỘC offsetM=null — validateProvenance chặn mâu thuẫn
      // "không khớp mà vẫn ghi khoảng lệch".
      prov.crossChecks = [{ source: "wcmc", agreed: false, offsetM: null, at: AT }];
    }
    features.push({
      type: "Feature",
      properties: { kind, prov },
      geometry: { type: "MultiPolygon", coordinates: polys },
    });
  }
}

// Hình WCMC còn lại = phần ACA KHÔNG thấy ⇒ theo định nghĩa chưa có nguồn thứ
// hai xác nhận. Ghi agreed=false cho thật, không tô hồng điểm tin cậy.
let wcmcVerts = 0;
let wcmcOut = 0;
for (const f of wcmcKept) {
  const src = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  const parts = [];
  for (const poly of src) {
    // Vòng NGOÀI bị cắt mất hẳn ⇒ bỏ mảnh đó (lỗ không có vỏ là vô nghĩa).
    const outerClip = clipRingToFrame(poly[0]);
    if (!outerClip) continue;
    const outer = finishRing(outerClip, DP_TOL_REEF);
    if (!outer || outer.length < 4) continue;
    const rings = [outer];
    for (let h = 1; h < poly.length; h++) {
      const clipped = clipRingToFrame(poly[h]);
      if (!clipped) continue;
      const ring = finishRing(clipped, DP_TOL_REEF);
      if (ring && ring.length >= 4) rings.push(ring);
    }
    wcmcVerts += rings.reduce((a, r) => a + r.length, 0);
    parts.push(rings);
  }
  if (!parts.length) continue;
  wcmcOut++;
  features.push({
    type: "Feature",
    properties: {
      kind: "reef",
      prov: {
        origin: { source: "wcmc", at: AT },
        crossChecks: [{ source: "aca", agreed: false, offsetM: null, at: AT }],
      },
    },
    geometry: { type: "MultiPolygon", coordinates: parts },
  });
}

// ── (5) CỔNG TỰ KIỂM ───────────────────────────────────────────────────────
const out = {
  type: "FeatureCollection",
  properties: {
    // Siêu dữ liệu CẤP BỘ: phần lý lịch giống nhau ở mọi đối tượng.
    generatedAt: AT,
    bbox: BBOX,
    cellDeg: CELL,
    simplifyTolDeg: { reef: DP_TOL_REEF, shoal: DP_TOL_SHOAL },
    sources: [
      {
        source: "aca",
        version: ACA_LAYER,
        url: ACA_URL,
        license: "cc-by-4.0",
        attribution: "Allen Coral Atlas (CC BY 4.0)",
      },
      {
        source: "wcmc",
        version: WCMC_VERSION,
        url: WCMC_URL,
        license: "cc-by-4.0",
        attribution: "UNEP-WCMC, WorldFish Centre, WRI, TNC (2021), WCMC-008 v4.1",
      },
    ],
  },
  features,
};
const json = JSON.stringify(out);

// (a) CHỦ QUYỀN — không cho lọt ký tự Hán/CJK. Chép nguyên cổng của
// scripts/generate-coral-reefs.mjs: quét TOÀN BỘ chuỗi sắp ghi, còn chữ Hán là
// throw, KHÔNG ghi file — thà không có lớp rạn còn hơn lọt nhãn nước ngoài.
const CJK = /[⺀-⿿　-〿㐀-䶿一-鿿豈-﫿]/;
const hit = json.match(CJK);
if (hit) {
  throw new Error(
    `CHẶN: dữ liệu sắp ghi còn ký tự Hán/CJK ("${hit[0]}" ở vị trí ${hit.index}).`,
  );
}

// (b) KHÔNG trường tên: mỗi feature chỉ được có đúng `kind` + `prov`.
const stray = features.find(
  (f) =>
    Object.keys(f.properties).length !== 2 ||
    !["reef", "shoal"].includes(f.properties.kind) ||
    !f.properties.prov?.origin,
);
if (stray) {
  throw new Error(`CHẶN: feature có thuộc tính lạ — ${JSON.stringify(Object.keys(stray.properties))}`);
}

// (c) KHÔNG một đối tượng nào được ghi nguồn OSM — đó là lý do tồn tại của bộ này.
const dirty = features.find((f) => {
  const p = f.properties.prov;
  const ids = [p.origin.source, ...(p.derivedFrom ?? []).map((d) => d.source)];
  return ids.includes("osm");
});
if (dirty) throw new Error("CHẶN: có đối tượng ghi nguồn OSM — bộ này phải sạch ODbL.");

// (d) Toạ độ phải nằm trong khung VN.
let outside = 0;
for (const f of features) {
  for (const poly of f.geometry.coordinates) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        if (x < W || x > E || y < S || y > N) outside++;
      }
    }
  }
}
if (outside) throw new Error(`CHẶN: ${outside} đỉnh nằm ngoài khung VN.`);

const bytes = Buffer.byteLength(json);
if (bytes > MAX_BYTES) {
  throw new Error(
    `CHẶN: ${Math.round(bytes / 1024 / 1024)} MB vượt trần ${Math.round(
      MAX_BYTES / 1024 / 1024,
    )} MB — nới DP_TOL hoặc HỎI LEAD trước khi nâng trần.`,
  );
}

mkdirSync("public/data", { recursive: true });
writeFileSync(OUT_PATH, json);

// ── (6) BÁO CÁO SO SÁNH VỚI BỘ OSM ─────────────────────────────────────────
// CHỈ ĐỌC, CHỈ ĐỂ IN. Không số liệu nào của OSM chảy vào file xuất ở trên —
// ranh giới ODbL nằm ở hành vi TRÍCH XUẤT.
/** Ven bờ = kinh độ < 110°Đ: vùng biển ven bờ đất liền + vịnh Thái Lan, tách
 *  hẳn khỏi Hoàng Sa (111–113°Đ) và Trường Sa (111,5–117,5°Đ). */
const COASTAL_LON = 110.0;

/**
 * Đếm theo MẢNH ĐA GIÁC, không theo feature — bộ OSM một mảnh một feature, bộ
 * mới gom cụm thành MultiPolygon; so feature-với-feature là so hai đơn vị khác
 * nhau rồi kết luận sai.
 */
function tally(feats, geomOf) {
  let n = 0;
  let coastal = 0;
  let verts = 0;
  const parts = (g) => {
    if (g.type === "MultiPolygon") return g.coordinates;
    if (g.type === "Polygon") return [g.coordinates];
    return [[g.coordinates]]; // LineString/Point của bộ OSM
  };
  for (const f of feats) {
    const g = geomOf(f);
    if (!g) continue;
    for (const part of parts(g)) {
      n++;
      // Chỉ cần kinh độ trung bình: phép phân loại ven bờ là một đường kinh tuyến.
      let x = 0;
      let c = 0;
      const walk = (arr) => {
        if (typeof arr[0] === "number") {
          x += arr[0];
          c++;
          verts++;
        } else for (const a of arr) walk(a);
      };
      walk(part);
      if (c && x / c < COASTAL_LON) coastal++;
    }
  }
  return { n, coastal, verts };
}

const mine = tally(features, (f) => f.geometry);
const split = {};
for (const f of features) {
  const k = `${f.properties.prov.origin.source}/${f.properties.kind}`;
  const t = tally([f], (x) => x.geometry);
  const cur = split[k] ?? { feats: 0, parts: 0, verts: 0 };
  cur.feats++;
  cur.parts += t.n;
  cur.verts += t.verts;
  split[k] = cur;
}
console.log(`\n${"═".repeat(74)}\n▌ BÁO CÁO`);
console.log(
  `BỘ MỚI: ${features.length.toLocaleString("vi-VN")} feature = ` +
    `${mine.n.toLocaleString("vi-VN")} mảnh đa giác · ${mine.verts.toLocaleString("vi-VN")} đỉnh · ` +
    `${(bytes / 1048576).toFixed(1)} MB (trần ${MAX_BYTES / 1048576} MB)`,
);
console.log(
  `  gốc ACA ${(reefClusters.length + shoalClusters.length).toLocaleString("vi-VN")} cụm` +
    ` (rạn ${reefClusters.length.toLocaleString("vi-VN")} · bãi ${shoalClusters.length.toLocaleString("vi-VN")})` +
    ` = ${acaPolyCount.toLocaleString("vi-VN")} mảnh đa giác` +
    ` · gốc WCMC ${wcmcOut} hình (${wcmcVerts.toLocaleString("vi-VN")} đỉnh)`,
);
console.log(
  `  WCMC xác nhận ${agreedCount.toLocaleString("vi-VN")}/${(reefClusters.length + shoalClusters.length).toLocaleString("vi-VN")} cụm ACA` +
    (offsets.length
      ? ` · vênh tâm-ACA↔mép-WCMC: trung vị ${
          [...offsets].sort((a, b) => a - b)[Math.floor(offsets.length / 2)]
        } m`
      : ""),
);
console.log(`  ven bờ (<${COASTAL_LON}°Đ): ${mine.coastal.toLocaleString("vi-VN")} mảnh`);
console.log(`  tol rạn ${DP_TOL_REEF}° · tol bãi ${DP_TOL_SHOAL}°`);
for (const [k, v] of Object.entries(split)) {
  console.log(
    `  ${k.padEnd(11)} ${String(v.feats).padStart(6)} feature · ` +
      `${String(v.parts).padStart(8)} mảnh · ${String(v.verts).padStart(9)} đỉnh` +
      ` (${((v.verts / mine.verts) * 100).toFixed(0)}% số đỉnh)`,
  );
}
console.log("  lớp địa mạo ACA:", Object.fromEntries([...classTally].sort((a, b) => b[1] - a[1])));

try {
  const osm = JSON.parse(readFileSync("public/data/reef-shapes.v1.json", "utf8"));
  const shapes = osm.features.filter(
    (f) => f.properties?.kind === "reef" || f.properties?.kind === "shoal",
  );
  const o = tally(shapes, (f) => f.geometry);
  console.log(
    `BỘ OSM (đối chiếu, KHÔNG dùng): ${o.n.toLocaleString("vi-VN")} hình · ` +
      `${o.verts.toLocaleString("vi-VN")} đỉnh · ven bờ ${o.coastal} mảnh`,
  );
  console.log(
    `→ mảnh: ×${(mine.n / o.n).toFixed(1)} · ven bờ: ×${(mine.coastal / Math.max(1, o.coastal)).toFixed(1)}` +
      ` · đỉnh: ×${(mine.verts / o.verts).toFixed(1)}`,
  );
} catch (e) {
  console.log(`(không đọc được bộ OSM để so: ${e.message})`);
}

console.log(
  `\nOK: ${OUT_PATH} — ${features.length.toLocaleString("vi-VN")} feature, ` +
    `${(bytes / 1048576).toFixed(1)} MB`,
);
