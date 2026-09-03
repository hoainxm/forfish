// Sinh LỚP SỐ ĐO SÂU KHẢO SÁT từ THÔNG BÁO HÀNG HẢI — chạy CÓ CHỦ Ý, không
// phải phản xạ:
//
//   node scripts/fetch-soundings.mjs                      # cả nước, cả hai nguồn
//   node scripts/fetch-soundings.mjs --nguon vmsa         # chỉ vmsa.vn
//   node scripts/fetch-soundings.mjs --nguon wayback      # chỉ kho lưu trữ
//   node scripts/fetch-soundings.mjs --vung ca-mau-455 --max 10 --out /tmp/thu.json
//
// Đầu ra mặc định: public/data/soundings.v1.json (CẢ NƯỚC).
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// Bản đồ của app tới nay chỉ có ETOPO 2022 (~450 m/ô) — mô hình nội suy từ vệ
// tinh, KHÔNG có lấy một điểm đo sâu khảo sát thật nào. Hải đồ thương mại bà
// con thấy ngoài chợ thì rải đầy số đo sâu rời (lớp SOUNDG của chuẩn S-57).
// Thông báo hàng hải lấp đúng khúc đó ở luồng — cửa biển — vũng cảng: độ sâu
// đo bằng máy hồi âm 200 kHz, quy về mực nước "số 0 hải đồ" (CÙNG chuẩn với
// hải đồ), kèm toạ độ WGS-84 tới 0,1 giây, cập nhật tới 2 tháng/lần.
//
// ── HAI NGUỒN, VÌ MỘT NGUỒN KHÔNG ĐỦ ──────────────────────────────────────
// (A) vmsa.vn — danh mục sống. Đây là website cũ của Bảo đảm an toàn hàng hải
//     MIỀN BẮC đổi tên sau hợp nhất, nên nó mang theo 20 năm lưu trữ miền Bắc
//     mà chỉ 15 tháng miền Nam. File đính kèm CHỈ có từ 2025 trở đi (đo thật:
//     0/32 mẫu 2007–2024 có PDF, 15/15 mẫu 2025–2026 có).
// (B) Wayback Machine giữ kho `vms-south.vn` đã chết — đây là cách duy nhất
//     lấy được chiều sâu lịch sử của MIỀN NAM. Liệt kê bằng CDX API, tải qua
//     `/web/<timestamp>id_/<url>` (bản NGUYÊN, không chèn thanh công cụ).
//
// Wayback là hạ tầng công cộng miễn phí: nghỉ dài giữa các yêu cầu, tải một
// lần rồi CACHE ra ngoài repo, chạy lại không tải lại.
//
// ── KHÔNG LỌC THEO TIÊU ĐỀ TRƯỚC KHI TẢI ──────────────────────────────────
// Bản trước lọc tiêu đề rồi mới tải, và báo về "11% thông báo có bảng toạ độ".
// Con số đó là **hậu quả của chính bộ lọc**, không phải tính chất của kho. Bản
// này TẢI TRƯỚC, XÉT SAU: có bảng toạ độ hay không thì đọc trong PDF mới biết.
// (`isDepthNotice` giữ lại vì `scripts/link-fairway-depths.mjs` dùng — ở đây
// nó KHÔNG còn chặn trước khi tải, chỉ dùng để thống kê.)
//
// ── BÓC CHỮ TỪ PDF: TỰ VIẾT, KHÔNG THÊM DEPENDENCY ────────────────────────
// Repo không có thư viện PDF nào, và thêm một gói nặng cho việc chạy vài lần
// một năm là sai thang (nguyên tắc 15 bậc 5). Bộ bóc dưới đây dùng `zlib` của
// thư viện chuẩn, xử lý đúng ba thứ mà PDF của các cảng vụ dùng:
//   · object stream (/ObjStm, PDF ≥1.5) — không bung thì không thấy /ToUnicode
//   · CMap /ToUnicode cả `bfchar` lẫn `bfrange`, KỂ CẢ dạng đích MẢNG
//     `<lo> <hi> [<d0> <d1> …]` — dạng này chứa đúng dấu tiếng Việt (á à â);
//     bỏ nó thì "hàng hải" ra "hng hải" và mọi regex tiếng Việt trượt hết
//   · dựng lại DÒNG theo toạ độ vẽ (ma trận CTM × Tm), vì bảng toạ độ là bảng
//     bố cục — đọc theo thứ tự byte trong stream là ra hàng lộn cột
//
// PDF ẢNH SCAN thì KHÔNG có lớp chữ — 985/2.261 file trong kho là như vậy.
// Chúng KHÔNG còn bị bỏ: `scripts/ocr-soundings.mjs` chạy OCR riêng (chậm,
// vài giờ) rồi cất chữ ra kho ngoài repo; ở đây chỉ việc mở kho ấy ra dùng.
// Chữ OCR đi ĐÚNG một đường với chữ bóc từ lớp text: cùng `readNotice`, cùng
// bốn cổng, cộng thêm cổng "tỉ lệ số mét chẵn" chỉ áp cho đường OCR. Kho
// chưa có bản OCR của file nào thì file đó vẫn vào `boSot` như cũ.
//
// ── BỐN CỔNG TỰ KIỂM — không qua thì KHÔNG ghi file ───────────────────────
// (a) chủ quyền: không một ký tự Hán/CJK nào lọt vào đầu ra
// (b) khung biển VN + dải độ sâu hợp lý
// (c) mọi thông báo có NGÀY + LÝ LỊCH NGUỒN
// (d) VÙNG đọc từ SỐ HIỆU, không đọc từ chuyên mục — xem `areaFromNotice`
//
// ── TRẦN DUNG LƯỢNG (CLAUDE.md "Dữ liệu bản đồ trong git") ────────────────
// Trần 20 MB/file. Script ƯỚC cỡ trước khi ghi và DỪNG nếu vượt — không tự cắt
// dữ liệu cho vừa, không tự nới trần. Vượt thì báo Lead.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ────────────────────────────────────────────────
// Đây là script chạy LÚC PHÁT TRIỂN trên máy người viết mã, không chạy trong
// app của bà con. Không thêm request mạng nào lúc mở app, không đụng
// `public/sw.js`, không đụng khoá `forfish.*`, không đè dữ liệu đã tải. File
// sinh ra là asset tĩnh mới, chưa nối vào màn hình nào.
//
// ## Assumptions
// - `source: "tbhh"` CHƯA có trong `SOURCES` của `src/lib/provenance.ts` (file
//   đó không thuộc phạm vi thay đổi này). Vì vậy dataset này KHÔNG được đưa
//   vào `cleanPackage()` cho tới khi có người đăng ký nguồn. `validateProvenance`
//   sẽ báo "nguồn lạ" — đúng như thiết kế, không phải lỗi im lặng.
// - Hàng bảng có HAI cặp toạ độ thì cặp nào là WGS-84 đọc từ DÒNG TIÊU ĐỀ
//   ("Hệ VN-2000 … Hệ WGS-84"), không mặc định thứ tự. Không xác định được hệ
//   thì BỎ hàng + ghi `boSot`, vì hai hệ lệch ~150–200 m ở biển Việt Nam.
// - Bản Wayback KHÔNG có danh mục để lấy ngày, nên ngày đọc TỪ PDF (dòng
//   "ngày … tháng … năm …" hoặc "ngày dd/mm/yyyy"). Đọc không ra thì lùi về
//   NĂM-THÁNG trong đường dẫn `/wp-content/uploads/<năm>/<tháng>/` và lấy ngày
//   01 — ghi rõ `ngayUocLuong: true` để không ai tưởng đó là ngày ký. Không ra
//   được cả hai thì BỎ, vì một số đo sâu không có ngày là số nguy hiểm.
// - Cỡ ô gộp trùng ~11 m (`SPOT_GRID_DEG`): xem `keepNewestPerSpot`.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { pdfPages } from "./lib/pdf-text.mjs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const HOST = "https://vmsa.vn";
const LIST = `${HOST}/thong-bao-hang-hai-247`;
const UA = "SDFish-build/1.0 (fisherman app; nautical depth notices)";
const REQ_TIMEOUT_MS = 60_000;
const FETCHED_AT = new Date().toISOString().slice(0, 10);

const NHAN =
  "Độ sâu tham khảo — đo tại ngày ghi kèm, luồng bồi lắng liên tục. " +
  "Không thay hải đồ. Đi biển vẫn phải xem hải đồ và máy dò của tàu.";

/* ══ 0. THAM SỐ DÒNG LỆNH ═══════════════════════════════════════════════ */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

/** Vùng biển trên danh mục vmsa; "tat-ca" = dò thẳng từ trang gốc. */
const VUNG = arg("vung", "tat-ca").split(",").filter(Boolean);
const MAX_PER_VUNG = Number(arg("max", "0")) || Infinity;
/** Chỉ xét thông báo từ ngày này trở đi — trước đó danh mục KHÔNG đính PDF. */
const TU_NGAY = arg("tu", "2025-01-01");
/** Kho lưu trữ: chỉ lấy từ năm này trở đi (trước đó gần như toàn ảnh scan). */
const WB_TU_NAM = Number(arg("wayback-tu", "2019"));
const WB_MAX = Number(arg("wayback-max", "0")) || Infinity;
const NGUON = arg("nguon", "ca"); // "vmsa" | "wayback" | "ca"
const OUT = arg("out", "public/data/soundings.v1.json");
/** Nghỉ giữa các yêu cầu (ms) — Wayback nghỉ dài hơn, xem `WB_POLITE_MS`. */
const POLITE_MS = Number(arg("nghi", "250"));
const WB_POLITE_MS = Number(arg("nghi-wayback", "900"));
/** Số luồng tải song song cho kho lưu trữ — vài luồng, không phải một đàn. */
const WB_SONG_SONG = Math.max(1, Math.min(6, Number(arg("song-song", "4"))));
/** Trần dung lượng của hook pre-commit (CLAUDE.md "Dữ liệu bản đồ trong git"). */
const TRAN_MB = Number(arg("tran-mb", "20"));

/**
 * KHO TẢI VỀ nằm NGOÀI repo (CLAUDE.md quy tắc 5: cấm file dữ liệu tạm trong
 * cây làm việc). Chạy lại thì đọc lại từ đây, không đập vào hạ tầng công cộng
 * thêm lần nữa.
 */
const CACHE = arg("kho", join(tmpdir(), "sdfish-soundings-cache"));
const KHO_ONLY = has("chi-kho"); // chỉ dùng bản đã tải, không ra mạng
/**
 * KHO CHỮ OCR do `scripts/ocr-soundings.mjs` sinh, cũng NGOÀI repo. Đặt tên
 * theo `sha1(<địa chỉ>)` — tra bằng địa chỉ PDF trước, không thấy thì tra
 * bằng địa chỉ gốc (bản lưu trữ đổi dấu thời gian giữa hai lần chạy thì địa
 * chỉ PDF đổi theo, còn địa chỉ gốc thì không).
 */
const KHO_OCR = arg("kho-ocr", join(tmpdir(), "sdfish-ocr-cache"));

/* ══ 1. NẠP MÃ THẬT TỪ src/lib/*.ts ═════════════════════════════════════
   Bộ phân tích toạ độ và ba cổng phải là MỘT bản duy nhất, dùng chung với app
   và với test. Chép tay sang .mjs là mở đường cho hai bản lệch nhau. Node 20
   chưa đọc được .ts nên dịch TẠI CHỖ bằng `typescript` trong node_modules —
   cùng cách `scripts/bench-render.mjs` và `scripts/link-fairway-depths.mjs`
   đã làm. Dịch CẢ CÂY `@/lib/*` mà file cần, nếu không thì `fairway-depth.ts`
   (nơi giữ bộ đọc câu "độ sâu đạt …") không nạp được.                      */

const LIB_DIR = join(ROOT, "node_modules", ".cache", "sdfish-soundings", "lib");

async function loadLib(name) {
  const ts = (await import("typescript")).default;
  mkdirSync(LIB_DIR, { recursive: true });
  const done = new Set();
  const conv = (n) => {
    if (done.has(n)) return;
    done.add(n);
    const p = join(ROOT, "src", "lib", `${n}.ts`);
    if (!existsSync(p)) throw new Error(`CHẶN: thiếu src/lib/${n}.ts`);
    const src = readFileSync(p, "utf8");
    for (const m of src.matchAll(/from\s+"@\/lib\/([\w-]+)"/g)) conv(m[1]);
    const js = ts
      .transpileModule(src, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          verbatimModuleSyntax: false,
        },
      })
      .outputText.replace(/from\s+"@\/lib\/([\w-]+)"/g, 'from "./$1.mjs"');
    writeFileSync(join(LIB_DIR, `${n}.mjs`), js);
  };
  conv(name);
  return import(pathToFileURL(join(LIB_DIR, `${name}.mjs`)).href);
}

/* ══ 2. BÓC CHỮ TỪ PDF ════════════════════════════════════════════════
   Bộ bóc chữ ở `scripts/lib/pdf-text.mjs` — MỘT bản duy nhất, dùng chung với
   `scripts/extract-tbhh-text.mjs` (đọc cùng kho PDF để lấy BÁO HIỆU thay vì số
   đo sâu). Trước 2026-09-02 nó khoá trong file này và không có export, nên ai
   cần cũng phải chép — hai bản sẽ lệch nhau ngay lần sửa đầu tiên.        */

/* ══ 3. TẢI TRANG ═══════════════════════════════════════════════════════ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tải một địa chỉ, thử lại 3 lần với nghỉ tăng dần.
 *
 * Kho lưu trữ công cộng hay trả 5xx/đứt kết nối lúc bận. Thử lại là LỊCH SỰ
 * hơn bỏ cuộc rồi chạy lại cả đợt, nhưng chỉ 3 lần rồi thôi — không đập.
 */
async function get(url, as = "text", tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REQ_TIMEOUT_MS);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return as === "buffer" ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) {
      last = e;
      if (i + 1 < tries) await sleep(1200 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

const ENT = {
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", egrave: "è", eacute: "é",
  ecirc: "ê", igrave: "ì", iacute: "í", ograve: "ò", oacute: "ó", ocirc: "ô",
  otilde: "õ", ugrave: "ù", uacute: "ú", yacute: "ý", ntilde: "ñ",
  quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", apos: "'", ldquo: "“", rdquo: "”",
};
function dec(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (x, n) => ENT[n.toLowerCase()] ?? x);
}

const ROW_RE = /<h4><a href="([^"]+)"\s+title="([^"]*)"[^>]*>[\s\S]*?newslist-content"><p>([^<]*)</g;

/**
 * Ngày trong ô mô tả của danh mục viết BA kiểu, đo thật trên vmsa.vn:
 *   · `ngày 25/8/2026`                     (thông báo 2025–2026)
 *   · `ngày 29 tháng 4 năm 2020`           (bản cũ)
 *   · `Đăng ngày 04/05/2007`               (bản rất cũ, KHÔNG có số hiệu)
 * Bản trước chỉ nhận kiểu đầu, nên toàn bộ khối "tháng … năm …" rơi ra ngoài
 * mà không ai biết. Ở đây nhận cả ba.
 */
function parseNgay(meta) {
  const a = /ng[àa]y[:\s]*(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{4})/i.exec(meta);
  if (a) return `${a[3]}-${a[2].padStart(2, "0")}-${a[1].padStart(2, "0")}`;
  const b = /ng[àa]y\s*(\d{1,2})\s*th[áa]ng\s*(\d{1,2})\s*n[ăa]m\s*(\d{4})/i.exec(meta);
  if (b) return `${b[3]}-${b[2].padStart(2, "0")}-${b[1].padStart(2, "0")}`;
  return "";
}

/** Một trang danh mục → [{ url, tieuDe, so, ngay }]. */
function parseList(html) {
  const out = [];
  let m;
  while ((m = ROW_RE.exec(html)) !== null) {
    const meta = dec(m[3]).replace(/\s+/g, " ").trim();
    // "Số: 947/TBHH-CVHHTPHCM ngày 22/4/2026" — dấu cách quanh gạch nối là
    // chuyện thường ("1844/TBHH - CVHHHP"), nên bỏ hết khoảng trắng bên trong.
    const so = /S[ốo]\s*:?\s*([^\s].*?)\s*(?:ng[àa]y|$)/i.exec(meta)?.[1]?.replace(/\s+/g, "") ?? "";
    out.push({
      url: dec(m[1]).trim(),
      tieuDe: dec(m[2]).replace(/\s+/g, " ").trim(),
      so: /TBHH/i.test(so) ? so : "",
      ngay: parseNgay(meta),
    });
  }
  return out;
}

/**
 * Thông báo NÀY có phải thông báo độ sâu không (đọc trên TIÊU ĐỀ).
 *
 * ⚠️ KHÔNG dùng để chặn trước khi tải trong file này nữa — xem đầu file. Giữ
 * lại vì `scripts/link-fairway-depths.mjs` cắt mục 2–3 của file này ra dùng
 * và gọi tới nó. Ở đây chỉ dùng để ĐẾM, cho biết bộ lọc cũ đã bỏ sót bao nhiêu.
 */
function isDepthNotice(tieuDe) {
  return /th[ôo]ng s[ốo] k[ỹy] thu[ậa]t|[đd]ộ s[âa]u|chu[ẩa]n t[ắa]c/i.test(tieuDe);
}

/* ══ 4. ĐỌC MỘT THÔNG BÁO ══════════════════════════════════════════════ */

const RE_VN2000 = /VN\s*-?\s*2000/i;
const RE_WGS84 = /WGS\s*-?\s*84/i;

/**
 * Nhãn của bảng = dòng gần nhất TRƯỚC dòng tiêu đề hệ toạ độ có nói tới đoạn
 * luồng / khu nước. Đây là chữ của chính thông báo, không phải chữ ta đặt.
 */
// Nhãn phải là DÒNG MỞ MỤC ("a) Đoạn luồng từ…", "2. Khu nước…"), không phải
// một dòng giữa câu có chữ "tuyến luồng" — bắt lỏng là lấy phải nửa câu vô nghĩa.
const RE_NHAN = /^\s*(?:[a-z][).]|\d+[.)]|-)?\s*(Đo[ạa]n\s*lu[ồo]ng|Tuy[ếe]n\s*lu[ồo]ng|Lu[ồo]ng\s*h[àa]ng\s*h[ảa]i|Khu\s*n[ưu][ớo]c|V[ũu]ng\s*quay)/i;

function nhanBang(lines, i) {
  for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
    const l = String(lines[j] ?? "").replace(/\s+/g, " ").trim();
    if (!RE_NHAN.test(l)) continue;
    // "Đoạn luồng từ X đến Y có chiều dài khoảng" — cắt đuôi đo đếm, giữ tên.
    return l
      .replace(/\s*[,;]?\s*(?:có\s*)?chi[ềe]u\s*d[àa]i.*$/i, "")
      .replace(/[.;:,\-–\s]+$/, "")
      .slice(0, 90);
  }
  return null;
}

/**
 * Các trang PDF → hai khuôn dữ liệu, xét theo TỪNG BẢNG một:
 *
 *  (a) BẢNG CÓ CỘT ĐỘ SÂU  → điểm đo sâu rời (`pts`)
 *  (b) BẢNG KHÔNG CÓ CỘT ĐỘ SÂU (tim tuyến / góc khu nước) + câu "độ sâu …
 *      đạt X m" NGAY SAU bảng → một ĐƯỜNG có độ sâu khống chế (`tuyen`)
 *
 * Khuôn (b) là ĐA SỐ và đợt trước vứt hết vào `boSot`. Phân biệt (a)/(b) bằng
 * `hasDepthColumn` — cổng CẢ BẢNG, không phải cổng từng hàng; xem `soundings.ts`.
 *
 * ⚠️ PHẢI cắt theo TỪNG BẢNG, không gộp cả thông báo. Thông báo 969/TBHH-CVHHKG
 * (Năm Căn – Bồ Đề) có HAI bảng tim tuyến rời nhau, mỗi bảng một độ sâu (11,8 m
 * và 10,0 m). Gộp làm một là nối hai khúc luồng cách nhau vài km thành một
 * đường không có thật, và gán cho nó một độ sâu không thuộc về khúc nào.
 *
 * Thứ tự cột WGS-84 đọc từ DÒNG TIÊU ĐỀ của chính bảng đó ("Hệ VN-2000 … Hệ
 * WGS-84"), không mặc định — hai hệ lệch ~150–200 m ở biển Việt Nam, đoán sai
 * là đưa tàu ra ngoài luồng. Trả kèm `boQua` để người gọi ghi lý do, không
 * nuốt im.
 */
function readNotice(pages, lib, ocr = false) {
  const boQua = [];
  const lines = pages.flat();
  const bangs = [];
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasVn = RE_VN2000.test(line);
    const hasWgs = RE_WGS84.test(line);

    if (hasVn || hasWgs) {
      const order =
        hasVn && hasWgs
          ? line.search(RE_VN2000) < line.search(RE_WGS84)
            ? ["vn2000", "wgs84"]
            : ["wgs84", "vn2000"]
          : hasWgs
            ? ["wgs84"]
            : ["vn2000"];
      // Dòng tiêu đề LẶP LẠI ở đầu mỗi trang của cùng một bảng. Nối tiếp bảng
      // cũ khi cùng thứ tự cột và chưa gặp câu độ sâu — nếu không, một bảng dài
      // bị cắt vụn thành mấy đường ngắn.
      //
      // NHƯNG: dòng tiêu đề có chữ "Độ sâu" là dòng tiêu đề của một bảng KHÁC
      // HẲN — bảng CÓ cột độ sâu. Nối nó vào một bảng góc vùng (không có cột
      // ấy) là trộn hai bảng khác cấu trúc làm một, và hậu quả đo được ở
      // 445/TBHH-TCTBĐATHHMN: bảng góc vùng có cột đầu là TÊN ĐIỂM (`B1`, `82`,
      // `83`, `84`, `86`, `87`) bị dán vào bảng một hàng "Độ sâu 2,7 m". Bảng
      // gộp có đúng một số thập phân nên `hasDepthColumn` gật đầu, rồi mọi tên
      // điểm hoá thành số đo sâu: 82 m, 83 m, 84 m, 86 m, 87 m — ở toạ độ THẬT,
      // trong khu nước mà chính thông báo ấy nói độ sâu đạt 1,4 m.
      const coCotSau = /đ\s*ộ\s*s\s*â\s*u/i.test(line);
      const noiTiep =
        cur &&
        cur.rows.length &&
        String(cur.order) === String(order) &&
        cur.coCotSau === coCotSau &&
        lib.readControllingDepthM(cur.tail.join(" ")) === null;
      if (!noiTiep) {
        cur = { order, rows: [], tail: [], nhan: nhanBang(lines, i), coCotSau };
        bangs.push(cur);
      } else {
        cur.order = order;
        cur.coCotSau = coCotSau;
      }
      continue;
    }

    const row = cur ? lib.parseSoundingRow(line) : null;
    if (row) {
      let wgs = null;
      for (const [k, pair] of row.pairs.entries()) {
        const datum = k < cur.order.length ? cur.order[k] : row.pairs.length === 1 ? cur.order[0] : null;
        if (datum !== "wgs84") continue;
        if (!lib.inVietnamSea(pair.lat, pair.lon)) {
          boQua.push({ line, lyDo: `toạ độ ngoài khung biển VN [${pair.lon}, ${pair.lat}]` });
          continue;
        }
        wgs = pair;
      }
      cur.rows.push({ row, wgs, line });
      cur.tail = [];
      continue;
    }
    if (cur) cur.tail.push(line);
  }

  if (!bangs.length) return { pts: [], tuyen: [], boQua, khuon: "khong-bang" };

  const pts = [];
  const tuyen = [];
  let chiVn2000 = false;

  for (const b of bangs) {
    if (!b.rows.length) continue;
    if (!b.order.includes("wgs84")) {
      chiVn2000 = true;
      continue;
    }

    // ── (a) bảng có cột độ sâu → điểm rời
    if (lib.hasDepthColumn(b.rows.map((r) => r.row))) {
      // Cột độ sâu thật thì điền kín; cột TÊN ĐIỂM chỉ tình cờ có vài ô trông
      // giống số (`BL.1` OCR ra `81.1`). Xem `isSparseDepthColumn`.
      if (ocr && lib.isSparseDepthColumn(b.rows.map((r) => r.row))) {
        const phu = Math.round(lib.depthColumnCoverage(b.rows.map((r) => r.row)) * 100);
        boQua.push({
          line: b.nhan ?? "",
          lyDo: `OCR: cột "độ sâu" chỉ điền ${phu}% số hàng — nghi đó là cột TÊN ĐIỂM, không phải độ sâu`,
        });
        continue;
      }
      for (const { row, wgs, line } of b.rows) {
        if (!wgs) continue;
        if (row.depthM === null) {
          boQua.push({ line, lyDo: "hàng có toạ độ nhưng ô độ sâu trống" });
          continue;
        }
        if (!lib.isPlausibleDepth(row.depthM)) {
          boQua.push({ line, lyDo: `độ sâu vô lý ${row.depthM} m` });
          continue;
        }
        if (ngoaiDiaBan(wgs.lon, wgs.lat)) {
          boQua.push({
            line,
            lyDo: `điểm cách bờ ${Math.round(kmToiBo(wgs.lon, wgs.lat))} km trên vùng nước sâu — ngoài địa bàn nguồn`,
          });
          continue;
        }
        pts.push({ lat: wgs.lat, lon: wgs.lon, depthM: row.depthM, chuSau: row.depthLiteral });
      }
      continue;
    }

    // ── (b) bảng tim tuyến / góc vùng → đường + độ sâu khống chế ở văn xuôi
    const diem = b.rows.filter((r) => r.wgs).map((r) => [round5(r.wgs.lon), round5(r.wgs.lat)]);
    if (diem.length < 2) continue; // một điểm lẻ (vị trí phao) — không phải tuyến
    // CHỈ GIỮ tuyến CÓ ĐỘ SÂU. Bảng toạ độ không có câu độ sâu thường là góc
    // KHU VỰC THI CÔNG hay vị trí báo hiệu mới — đúng toạ độ, nhưng không phải
    // dữ liệu độ sâu. Để lọt vào lớp độ sâu là bà con tưởng đây là luồng.
    const sauM = lib.readControllingDepthM(b.tail.join(" "));
    if (sauM === null) {
      boQua.push({ line: b.nhan ?? "", lyDo: "bảng toạ độ không kèm câu độ sâu — có lẽ là góc khu vực, không phải luồng" });
      continue;
    }
    // CỔNG: ra khỏi địa bàn của chính nguồn (giữa biển khơi, không phải luồng).
    const raBien = diem.find(([lo, la]) => ngoaiDiaBan(lo, la));
    if (raBien) {
      boQua.push({
        line: b.nhan ?? "",
        lyDo:
          `tuyến nằm cách bờ ${Math.round(kmToiBo(raBien[0], raBien[1]))} km trên vùng nước sâu — ` +
          "ngoài địa bàn luồng/cửa biển/vũng cảng, nghi đọc sai toạ độ",
      });
      continue;
    }

    // CỔNG: một thông báo chỉ nói về MỘT chỗ. Đỉnh văng đi hàng trăm km là
    // dấu hiệu bộ dựng dòng đã đan hai hàng bảng vào nhau — xem `isCoherentRoute`.
    if (!lib.isCoherentRoute(diem)) {
      boQua.push({
        line: b.nhan ?? "",
        lyDo: `tuyến toè ${Math.round(lib.routeSpreadKm(diem))} km — quá trần ${lib.ROUTE_SPREAD_MAX_KM} km, nghi đọc lộn hàng bảng`,
      });
      continue;
    }
    tuyen.push({ ten: b.nhan, diem, sau: Math.round(sauM * 10) });
  }

  const khuon = pts.length ? "diem" : tuyen.length ? "tuyen" : chiVn2000 ? "chi-vn2000" : "bang-rong";
  return { pts, tuyen, boQua, khuon };
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5; // ~1 m
}

/* ══ 5. KHO TẢI VỀ (ngoài repo) ═════════════════════════════════════════ */

const khoDir = (loai) => join(CACHE, loai);
const khoFile = (loai, url, duoi) =>
  join(khoDir(loai), createHash("sha1").update(url).digest("hex") + duoi);

/** Tải một lần rồi giữ lại; chạy lại KHÔNG tải lại. `null` = không lấy được. */
async function tai(loai, url, as, nghi) {
  const f = khoFile(loai, url, as === "buffer" ? ".bin" : ".txt");
  if (existsSync(f)) return as === "buffer" ? readFileSync(f) : readFileSync(f, "utf8");
  if (KHO_ONLY) return null;
  mkdirSync(khoDir(loai), { recursive: true });
  const v = await get(url, as);
  writeFileSync(f, v);
  await sleep(nghi);
  return v;
}

/**
 * Chữ OCR của một file ảnh scan → các TRANG DÒNG, hoặc `null` khi kho chưa có.
 *
 * Dòng trong kho đã được `ocrLineToNoticeLine` gột (dựng lại ký tự độ, ghép
 * N/E, sửa chữ cái đội lốt chữ số), nên từ đây trở đi nó đi chung đúng một
 * đường với chữ bóc từ lớp text — KHÔNG có nhánh riêng cho OCR trong
 * `readNotice`.
 */
function chuOcr(...diaChi) {
  for (const dc of diaChi) {
    if (!dc) continue;
    const f = join(KHO_OCR, createHash("sha1").update(dc).digest("hex") + ".dong.json");
    if (!existsSync(f)) continue;
    try {
      const d = JSON.parse(readFileSync(f, "utf8"));
      const trang = Array.isArray(d?.trang) ? d.trang : null;
      if (trang && trang.some((t) => Array.isArray(t) && t.length)) return trang;
    } catch {
      // kho hỏng một file thì bỏ file đó, không làm hỏng cả đợt
    }
  }
  return null;
}

/* ══ 5b. ĐỊA BÀN CỦA NGUỒN — bờ biển + lưới độ sâu (chỉ ĐỌC) ════════════
   Hai asset này đã nằm sẵn trong repo và app đã dùng chúng; ở đây chỉ đọc để
   trả lời đúng một câu: chỗ này có còn là luồng/cửa biển/vũng cảng không, hay
   đã ra giữa Biển Đông. Xem `isOutsideSourceDomain`.                        */

const COAST_FILE = join(ROOT, "public", "data", "vn-coast.v1.json");
const GRID_FILE = join(ROOT, "public", "data", "depth-grid.v1.bin");

const DG_STEP = 1 / 240;
const DG_META = { lat0: 5 + DG_STEP / 2, lon0: 102 + DG_STEP / 2, step: DG_STEP, nLat: 4441, nLon: 3841 };

let coastPts = null;
let gridData = null;

function napDiaBan() {
  if (coastPts) return;
  coastPts = [];
  if (existsSync(COAST_FILE)) {
    const walk = (o) => {
      if (Array.isArray(o)) {
        if (
          o.length >= 2 &&
          typeof o[0] === "number" &&
          typeof o[1] === "number" &&
          o[0] > 95 && o[0] < 125 && o[1] > 0 && o[1] < 28
        ) coastPts.push(o);
        else o.forEach(walk);
      } else if (o && typeof o === "object") Object.values(o).forEach(walk);
    };
    walk(JSON.parse(readFileSync(COAST_FILE, "utf8")));
  }
  if (existsSync(GRID_FILE)) {
    const b = readFileSync(GRID_FILE);
    gridData = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  say(`địa bàn nguồn: ${coastPts.length} đỉnh bờ biển · lưới độ sâu ${gridData ? "có" : "THIẾU"}`);
}

const RAD = (d) => (d * Math.PI) / 180;
function kmGiua(a, b) {
  const dLat = RAD(b[1] - a[1]);
  const dLon = RAD(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(RAD(a[1])) * Math.cos(RAD(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Khoảng cách tới đỉnh bờ biển gần nhất (km). `Infinity` khi thiếu dữ liệu bờ. */
function kmToiBo(lon, lat) {
  napDiaBan();
  if (!coastPts.length) return Infinity;
  let m = Infinity;
  for (const q of coastPts) {
    const d = kmGiua([lon, lat], q);
    if (d < m) m = d;
  }
  return m;
}

/** Lớp độ sâu của app tại một điểm (0 đất · 1 rất cạn · 2 nông · 3 đủ sâu). */
function lopSau(lon, lat) {
  napDiaBan();
  if (!gridData) return null;
  const i = Math.round((lat - DG_META.lat0) / DG_META.step);
  const j = Math.round((lon - DG_META.lon0) / DG_META.step);
  if (i < 0 || i >= DG_META.nLat || j < 0 || j >= DG_META.nLon) return null;
  const k = i * DG_META.nLon + j;
  return (gridData[k >> 2] >> ((k & 3) * 2)) & 3;
}

/** `true` khi điểm này đã ra khỏi địa bàn luồng/cửa biển/vũng cảng. */
function ngoaiDiaBan(lon, lat) {
  napDiaBan();
  if (!gridData) return false; // thiếu lưới thì KHÔNG kết tội
  return lib.isOutsideSourceDomain(kmToiBo(lon, lat), lopSau(lon, lat));
}

/* ══ 6. GOM THÔNG BÁO ═══════════════════════════════════════════════════ */

const say = (...a) => console.log(...a);

const lib = await loadLib("soundings");

const donVi = new Map(); // mã cơ quan → chỉ số trong `luong`
const luong = [];
const thongBao = [];
const diemTho = []; // { lat, lon, depthM, at, iTb }
const tuyen = [];
const boSot = [];
const stat = {
  danhMuc: 0,
  trongCuaSo: 0,
  coPdf: 0,
  pdfScan: 0,
  pdfOcr: 0,
  khongPhaiPdf: 0,
  ocrChanBiBo: 0,
  pdfRac: 0,
  khuonDiem: 0,
  khuonTuyen: 0,
  khongBang: 0,
  loTieuDeCu: 0,
  wbUrl: 0,
  wbTai: 0,
  wbThieuMeta: 0,
  ngayBiTuChoi: 0,
  ngayUocLuong: 0,
  tuyenCoSau: 0,
  diem: 0,
};
const maLa = new Map();

function themVung(so, lat) {
  const a = lib.areaFromNotice(so, lat);
  if (!a) {
    const ma = lib.noticeAuthorityCode(so) ?? "(không có số hiệu)";
    maLa.set(ma, (maLa.get(ma) ?? 0) + 1);
    return null;
  }
  let i = donVi.get(a.ma);
  if (i === undefined) {
    i = luong.push({ ma: a.ma, ten: a.ten }) - 1;
    donVi.set(a.ma, i);
  }
  return i;
}

/**
 * Một PDF đã tải → điểm / tuyến / bỏ sót. Dùng chung cho CẢ HAI nguồn: khác
 * nhau chỗ lấy siêu dữ liệu, giống nhau từ chỗ mở PDF trở đi.
 */
function nap(buf, meta) {
  const { so, ngay, url, pdf, tieuDe, nguon, ngayUocLuong } = meta;

  /* KHÔNG PHẢI PDF THÌ ĐỪNG GỌI NÓ LÀ "ẢNH SCAN".
     Đo thật 2026-09-01: trong 597 mục mang lý do "PDF ảnh scan", 55 mục tải về
     là TRANG HTML (`<!doctype …`, dưới 2 KB) — trang lỗi/chuyển hướng của kho
     lưu trữ, không phải file quét. Bộ bóc không thấy chữ nên chúng rơi vào
     đúng cái sọt của ảnh scan, và người sau đọc `boSot` sẽ đi OCR một trang
     HTML. Sai lý do còn tốn thời gian hơn không có lý do. */
  if (buf.slice(0, 5).toString("latin1") !== "%PDF-") {
    stat.khongPhaiPdf++;
    boSot.push({
      so,
      ngay,
      url,
      lyDo: "tải về KHÔNG phải PDF (trang lỗi của kho lưu trữ) — cần tải lại, không phải OCR",
    });
    return;
  }

  let pages = pdfPages(buf);
  let ocr = false;
  if (pages.reduce((n, p) => n + p.length, 0) < 5) {
    // Không có lớp chữ. Kho OCR có bản của file này thì dùng; chưa có thì ghi
    // `boSot` như cũ — KHÔNG bịa, và lý do nói rõ là chưa OCR chứ không phải
    // đọc không được.
    const tuOcr = meta.trangOcr ?? chuOcr(pdf, url);
    if (!tuOcr) {
      stat.pdfScan++;
      boSot.push({ so, ngay, url, lyDo: "PDF ảnh scan — không có lớp chữ, chưa OCR" });
      return;
    }
    pages = tuOcr;
    ocr = true;
    stat.pdfOcr++;
  }

  // PDF có lớp chữ nhưng bảng mã hỏng thì ra rác (`; X© W K LË Q`) — vẫn nhiều
  // dòng, vẫn ghi được file, không cổng nào đỏ. Hai chữ này có trong MỌI thông
  // báo hàng hải; không thấy nghĩa là chữ không đọc được. (Cùng luật với
  // `isReadableNotice` của `src/lib/fairway-depth.ts`.)
  const phang = pages.flat().join("").replace(/\s+/g, "").toLowerCase();
  if (!phang.includes("hànghải")) {
    stat.pdfRac++;
    boSot.push({ so, ngay, url, lyDo: "PDF có lớp chữ nhưng bảng mã hỏng — đọc ra ký tự rác" });
    return;
  }

  const { pts, tuyen: tuyenMoi, boQua, khuon } = readNotice(pages, lib, ocr);

  /* CỔNG THỨ NĂM — CHỈ CHO ĐƯỜNG OCR: "tỉ lệ số mét chẵn".
     Máy hồi âm ghi tới 0,1 m. OCR đánh rơi phần thập phân là lỗi ÂM THẦM: số
     vẫn hợp lý, toạ độ vẫn thật, không cổng nào khác đỏ — mà `7,7` thành `7`
     là bảo bà con dưới đáy tàu còn 70 cm không có thật. Bảng nào quá tỉ lệ thì
     BỎ CẢ BẢNG, vì không có cách nào biết hàng nào rơi hàng nào không. */
  if (ocr && pts.length) {
    const chuSau = pts.map((p) => p.chuSau ?? "");
    if (lib.isSuspectWholeMetreTable(chuSau)) {
      stat.ocrChanBiBo++;
      const tiLe = Math.round(lib.wholeMetreRatio(chuSau) * 100);
      boSot.push({
        so,
        ngay,
        url,
        lyDo: `OCR: ${tiLe}% số đo là mét chẵn trên ${pts.length} số — nghi rơi phần thập phân`,
      });
      return;
    }
  }

  if (!pts.length && !tuyenMoi.length) {
    stat.khongBang++;
    const lyDo =
      khuon === "khong-bang"
        ? "PDF không có bảng toạ độ (độ sâu chỉ nêu theo đoạn giữa hai phao)"
        : khuon === "chi-vn2000"
          ? "bảng toạ độ chỉ có hệ VN-2000, không có cột WGS-84"
          : boQua.length
            ? boQua[0].lyDo
            : "bảng toạ độ có nhưng không lấy được điểm WGS-84 nào";
    boSot.push({ so, ngay, url, lyDo });
    return;
  }

  const lat = pts.length ? pts[0].lat : tuyenMoi[0].diem[0][1];
  const iVung = themVung(so, lat);
  if (iVung === null) {
    boSot.push({ so, ngay, url, lyDo: "số hiệu không cho biết cơ quan ban hành — không gán được vùng" });
    return;
  }

  const iTb =
    thongBao.push({
      so,
      ngay,
      tieuDe,
      url,
      pdf,
      luong: iVung,
      prov: { origin: { source: "tbhh", at: FETCHED_AT, version: so, url: pdf } },
      // HAI CỜ NÀY LÀ THỨ DUY NHẤT PHÂN BIỆT ĐƯỢC — đừng bỏ, xem `SoundingNotice`.
      ...(ngayUocLuong ? { ngayUocLuong: true } : {}),
      ...(ocr ? { ocr: true } : {}),
    }) - 1;

  if (pts.length) {
    stat.khuonDiem++;
    for (const p of pts) diemTho.push({ lat: p.lat, lon: p.lon, depthM: p.depthM, at: ngay, iTb });
    say(`  · ${so.padEnd(26)} ${String(pts.length).padStart(4)} điểm   (${ngay}) ${nguon}`);
  }
  if (tuyenMoi.length) {
    stat.khuonTuyen++;
    let coSau = 0;
    for (const t of tuyenMoi) {
      tuyen.push({ tb: iTb, ten: t.ten, diem: t.diem, sau: t.sau });
      if (t.sau !== null) coSau++;
    }
    stat.tuyenCoSau += coSau;
    const dinh = tuyenMoi.reduce((n, t) => n + t.diem.length, 0);
    say(
      `  · ${so.padEnd(26)} ${String(tuyenMoi.length).padStart(2)} tuyến ${String(dinh).padStart(4)} đỉnh, ` +
        `${coSau}/${tuyenMoi.length} có độ sâu (${ngay}) ${nguon}`,
    );
  }
}

/* ══ 6a. NGUỒN A — danh mục sống vmsa.vn ════════════════════════════════ */

async function quetVmsa() {
  let slugs = VUNG;
  if (slugs.length === 1 && slugs[0] === "tat-ca") {
    const root = await tai("list", LIST, "text", POLITE_MS);
    slugs = [
      ...new Set(
        [...String(root).matchAll(/thong-bao-hang-hai-247\/([a-z0-9.\-]+-\d{3})(?:\/|")/g)].map((m) => m[1]),
      ),
    ];
    say(`vùng biển trên danh mục: ${slugs.length}`);
  }

  for (const ma of slugs) {
    // ── danh mục: đọc tới khi rơi khỏi cửa sổ có PDF (danh mục xếp mới→cũ)
    const rows = [];
    for (let off = 0; off < 9000; off += 20) {
      const url = off === 0 ? `${LIST}/${ma}` : `${LIST}/${ma}/${off}`;
      let html;
      try {
        html = await tai("list", url, "text", POLITE_MS);
      } catch (e) {
        say(`  ! danh mục ${url}: ${e.message}`);
        break;
      }
      if (html === null) break;
      const page = parseList(html);
      stat.danhMuc += page.length;
      rows.push(...page);
      const cuoi = page
        .filter((r) => r.ngay)
        .map((r) => r.ngay)
        .sort()[0];
      if (page.length < 20 || (cuoi && cuoi < TU_NGAY)) break;
    }

    // KHÔNG lọc theo tiêu đề. Chỉ cắt theo NGÀY, vì trước 2025 danh mục không
    // đính PDF — đó là phép cắt ĐO ĐƯỢC, không phải phỏng đoán về nội dung.
    const trong = rows.filter((r) => r.ngay && r.ngay >= TU_NGAY && r.so).slice(0, MAX_PER_VUNG);
    stat.trongCuaSo += trong.length;
    stat.loTieuDeCu += trong.filter((r) => !isDepthNotice(r.tieuDe)).length;
    say(`\n── ${ma}: ${rows.length} mục danh mục, ${trong.length} mục từ ${TU_NGAY} (TẢI HẾT, không lọc tiêu đề)`);

    for (const r of trong) {
      try {
        const html = await tai("detail", r.url, "text", POLITE_MS);
        if (html === null) continue;
        const href = html.match(/href="(\/baodam\/upload\/files\/[^"]+\.pdf)"/i)?.[1];
        if (!href) continue; // không đính PDF — chuyện thường với bản cũ, không phải lỗi
        const pdfUrl = `${HOST}${href}`;
        const buf = await tai("pdf", pdfUrl, "buffer", POLITE_MS);
        if (buf === null) continue;
        stat.coPdf++;
        nap(buf, { so: r.so, ngay: r.ngay, url: r.url, pdf: pdfUrl, tieuDe: r.tieuDe, nguon: "vmsa" });
      } catch (e) {
        boSot.push({ so: r.so, ngay: r.ngay, url: r.url, lyDo: `tải/đọc lỗi: ${e.message}` });
      }
    }
  }
}

/* ══ 6b. NGUỒN B — kho lưu trữ vms-south.vn trong Internet Archive ══════ */

const WB_CDX =
  "http://web.archive.org/cdx/search/cdx?url=vms-south.vn*&output=json" +
  "&fl=timestamp,original&filter=statuscode:200&collapse=urlkey";

/** Ngày ban hành đọc TỪ PDF — bản lưu trữ không có danh mục để hỏi. */
function ngayTrongPdf(lines) {
  for (const l of lines) {
    const a = /ng[àa]y\s*(\d{1,2})\s*th[áa]ng\s*(\d{1,2})\s*n[ăa]m\s*(\d{4})/i.exec(l);
    if (a) return `${a[3]}-${a[2].padStart(2, "0")}-${a[1].padStart(2, "0")}`;
    const b = /ng[àa]y\s*(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{4})/i.exec(l);
    if (b) return `${b[3]}-${b[2].padStart(2, "0")}-${b[1].padStart(2, "0")}`;
  }
  return "";
}

/** Số hiệu đọc TỪ PDF ("Số: 123/TBHH-CVHHVT"). */
function soTrongPdf(lines) {
  for (const l of lines) {
    const m = /(\d{1,4}\s*(?:\([TtHh]\))?)\s*\/\s*(?:\d{4}\s*\/\s*)?(TBHH\s*[-–—]\s*[^\s,;]{2,20})/.exec(l);
    if (m) return (m[1] + "/" + m[2]).replace(/\s+/g, "");
  }
  return "";
}

/**
 * Số hiệu đọc TỪ TÊN FILE — bản đăng web nhiều khi là bản CHƯA KÝ, ô số hiệu
 * để trống trong PDF ("Số:      /TBHH-CVHHHP"), nhưng tên file thì có:
 * `35-TBHH-TCTBDATHHMN_1-Signed.pdf`. Tên file viết KHÔNG DẤU nên bảng
 * `CO_QUAN` nhận cả hai cách gõ.
 */
function soTrongTenFile(url) {
  const ten = decodeURIComponent(String(url).split("/").pop() ?? "");
  const m = /(\d{1,4})[-_\s]*TBHH[-_\s]*([A-Za-z]{2,20})/i.exec(ten);
  return m ? `${m[1]}/TBHH-${m[2]}` : "";
}

async function quetWayback() {
  let raw;
  try {
    raw = await tai("cdx", WB_CDX, "text", WB_POLITE_MS);
  } catch (e) {
    say(`! CDX không trả lời (${e.message}) — bỏ nguồn lưu trữ`);
    return;
  }
  if (raw === null) return;

  let hang;
  try {
    hang = JSON.parse(raw);
  } catch {
    say("! CDX trả về không phải JSON — bỏ nguồn lưu trữ");
    return;
  }

  const seen = new Set();
  const ds = [];
  for (const [ts, org] of hang.slice(1)) {
    if (!/\.pdf(\?|$)/i.test(org)) continue;
    if (seen.has(org)) continue;
    seen.add(org);
    // Năm suy từ đường dẫn WordPress `/uploads/<năm>/<tháng>/`; không có thì
    // lấy từ dấu thời gian của bản lưu.
    const u = /\/uploads\/(\d{4})\/(\d{2})\//.exec(org);
    const nam = Number(u?.[1] ?? String(ts).slice(0, 4));
    if (!Number.isFinite(nam) || nam < WB_TU_NAM) continue;
    ds.push({ ts, org, nam, thang: u?.[2] ?? null });
  }
  stat.wbUrl = ds.length;
  ds.sort((a, b) => b.nam - a.nam);
  const lay = ds.slice(0, WB_MAX);
  say(`\n── lưu trữ vms-south.vn: ${seen.size} PDF trong kho, ${ds.length} từ năm ${WB_TU_NAM}, lấy ${lay.length}`);

  let i = 0;
  /**
   * Vài luồng tải song song, KHÔNG phải một đàn.
   *
   * Đo thật: mỗi bản lưu trữ mất ~6 giây phía máy chủ (nó phải dựng lại file
   * từ kho WARC), nên chạy nối đuôi thì 1.432 file hết hơn ba tiếng — quá lâu
   * để giữ một kết nối mở suốt. Bốn luồng, mỗi luồng vẫn NGHỈ giữa hai lần
   * gọi, cho khoảng 4 yêu cầu/giây: đủ nhanh mà vẫn là khách lịch sự với một
   * hạ tầng công cộng miễn phí. Tải xong thì CACHE, chạy lại không tải lại.
   */
  async function tho() {
    for (;;) {
      const k = i++;
      if (k >= lay.length) return;
      const d = lay[k];
      if ((k + 1) % 100 === 0) say(`   … ${k + 1}/${lay.length}`);
      const url = `https://web.archive.org/web/${d.ts}id_/${d.org}`;
      let buf;
      try {
        buf = await tai("wb", url, "buffer", WB_POLITE_MS);
      } catch (e) {
        boSot.push({ so: "", ngay: "", url: d.org, lyDo: `bản lưu trữ tải lỗi: ${e.message}` });
        continue;
      }
      if (buf === null) continue;
      stat.wbTai++;
      try {
        // Bản lưu trữ là ảnh scan thì lớp chữ rỗng, nên SỐ HIỆU và NGÀY cũng
        // không đọc được — cả hai đều phải lấy từ kho chữ OCR, nếu không thì
        // file bị loại ở đây và bước OCR thành công cốc.
        const pages = pdfPages(buf);
        const trangOcr = pages.reduce((n, t) => n + t.length, 0) < 5 ? chuOcr(url, d.org) : null;
        const lines = (trangOcr ?? pages).flat();
        const so = soTrongPdf(lines) || soTrongTenFile(d.org);
        // Ngày bóc từ PDF chỉ được dùng khi NĂM khớp năm của bản lưu — xem
        // `trustNoticeDate`: bản ký số để trống ô ngày thì bộ đọc vớ phải ngày
        // của Nghị định trong phần căn cứ và ghi khảo sát 2025 thành đo 2017.
        let ngay = ngayTrongPdf(lines);
        /* NGÀY SUY ĐOÁN PHẢI CÓ CỜ.
           Bản trước hứa ghi `ngayUocLuong` trong chú thích mà KHÔNG có dòng mã
           nào ghi: đếm trong dữ liệu ra 0 lần, trong khi 149 điểm mang ngày
           `2019-01-01` trông y như ngày ký. Giao diện đọc chính cờ này để vẽ
           điểm cũ rỗng ruột và nói "Số cũ — cửa lạch có thể đã bồi lắng"; vắng
           cờ thì app trình bày một ngày suy đoán như một ngày ký chính xác. */
        let ngayUocLuong = false;
        if (!lib.trustNoticeDate(ngay, d.nam)) {
          if (ngay) stat.ngayBiTuChoi++;
          ngay = d.thang ? `${d.nam}-${d.thang}-01` : "";
          ngayUocLuong = Boolean(ngay);
        }
        if (ngayUocLuong) stat.ngayUocLuong++;
        if (!so || !ngay) {
          stat.wbThieuMeta++;
          boSot.push({
            so,
            ngay,
            url: d.org,
            lyDo: !so
              ? "bản lưu trữ không đọc được số hiệu — không gán được vùng"
              : "bản lưu trữ không đọc được ngày ban hành",
          });
          continue;
        }
        stat.coPdf++;
        nap(buf, {
          so,
          ngay,
          url: d.org,
          pdf: url,
          tieuDe: (lines[2] ?? lines[0] ?? "").slice(0, 160),
          nguon: "kho",
          ngayUocLuong,
          trangOcr,
        });
      } catch (e) {
        boSot.push({ so: "", ngay: "", url: d.org, lyDo: `bản lưu trữ đọc lỗi: ${e.message}` });
      }
    }
  }
  await Promise.all(Array.from({ length: WB_SONG_SONG }, tho));
}

/* ══ 7. CHẠY ════════════════════════════════════════════════════════════ */

if (NGUON === "vmsa" || NGUON === "ca") await quetVmsa();
if (NGUON === "wayback" || NGUON === "ca") await quetWayback();

/* ══ 8. THÔNG BÁO MỚI ĐÈ THÔNG BÁO CŨ ══════════════════════════════════ */

const truocGop = diemTho.length;
const diemGop = lib.keepNewestPerSpot(diemTho);
say(`\ngộp trùng chỗ: ${truocGop} → ${diemGop.length} điểm (bỏ ${truocGop - diemGop.length} bản cũ hơn)`);

// Bỏ thông báo không còn điểm/tuyến nào sau khi gộp, rồi đánh số lại.
const dung = new Set([...diemGop.map((p) => p.iTb), ...tuyen.map((t) => t.tb)]);
const soMoi = new Map();
const thongBaoGon = [];
for (let i = 0; i < thongBao.length; i++) {
  if (!dung.has(i)) continue;
  soMoi.set(i, thongBaoGon.push(thongBao[i]) - 1);
}
const diem = diemGop.map((p) => [round5(p.lon), round5(p.lat), Math.round(p.depthM * 10), soMoi.get(p.iTb)]);
const tuyenGon = tuyen.map((t) => ({ tb: soMoi.get(t.tb), ten: t.ten, diem: t.diem, sau: t.sau }));
stat.diem = diem.length;

/* ══ 9. BỐN CỔNG TỰ KIỂM — không qua thì KHÔNG ghi file ════════════════ */

// (a) CHỦ QUYỀN: không cho lọt ký tự Hán/CJK vào bất kỳ chuỗi nào
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/;
const strings = [
  NHAN,
  ...luong.flatMap((l) => [l.ma, l.ten]),
  ...thongBaoGon.flatMap((t) => [t.so, t.tieuDe, t.url, t.pdf]),
  ...tuyenGon.map((t) => t.ten ?? ""),
  ...boSot.flatMap((b) => [b.so, b.url, b.lyDo]),
];
const dirty = strings.filter((s) => CJK.test(s));
if (dirty.length) {
  throw new Error(`CHẶN: ${dirty.length} chuỗi còn ký tự Hán/CJK — ${dirty.slice(0, 5).join(" | ")}`);
}

// (b) KHUNG BIỂN VN + DẢI ĐỘ SÂU
const bad = diem.filter(([lon, lat, dm]) => !lib.inVietnamSea(lat, lon) || !lib.isPlausibleDepth(dm / 10));
if (bad.length) {
  throw new Error(`CHẶN: ${bad.length} điểm ngoài khung VN hoặc độ sâu vô lý — ${JSON.stringify(bad.slice(0, 3))}`);
}
const badTuyen = tuyenGon.filter((t) => t.diem.some(([lon, lat]) => !lib.inVietnamSea(lat, lon)));
if (badTuyen.length) {
  throw new Error(`CHẶN: ${badTuyen.length} tuyến có đỉnh ngoài khung biển VN`);
}

// (c) MỌI ĐIỂM PHẢI CÓ NGÀY + LÝ LỊCH — hải đồ cũ là hải đồ nguy hiểm
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const noDate = thongBaoGon.filter((t) => !ISO.test(t.ngay) || !t.prov?.origin?.source || !ISO.test(t.prov.origin.at));
if (noDate.length) {
  throw new Error(
    `CHẶN: ${noDate.length} thông báo thiếu ngày hoặc lý lịch — ${noDate.slice(0, 3).map((t) => t.so).join(", ")}`,
  );
}

// (d) VÙNG PHẢI ĐỌC TỪ SỐ HIỆU, KHÔNG ĐỌC TỪ CHUYÊN MỤC
//     `an-giang-456` thực ra là Kiên Giang, `gia-lai-449` là Quy Nhơn — lấy
//     chuyên mục làm tỉnh là dán nhãn sai tỉnh cho số đo sâu.
const viTri = new Map(); // chỉ số thông báo → vĩ độ đại diện (để tách mã trùng)
for (const d of diem) if (!viTri.has(d[3])) viTri.set(d[3], d[1]);
for (const t of tuyenGon) if (!viTri.has(t.tb)) viTri.set(t.tb, t.diem[0][1]);
const saiVung = thongBaoGon.filter((t, i) => {
  const a = lib.areaFromNotice(t.so, viTri.get(i) ?? null);
  const v = luong[t.luong];
  return !v || !a || a.ma !== v.ma;
});
if (saiVung.length) {
  throw new Error(
    `CHẶN: ${saiVung.length} thông báo có vùng không khớp số hiệu — ${saiVung
      .slice(0, 3)
      .map((t) => t.so)
      .join(", ")}`,
  );
}

/* ══ 10. GHI ════════════════════════════════════════════════════════════ */

diem.sort((a, b) => a[3] - b[3] || a[1] - b[1] || a[0] - b[0]);
tuyenGon.sort((a, b) => a.tb - b.tb);

const out = {
  v: 1,
  nguon:
    "Thông báo hàng hải — Tổng công ty Bảo đảm an toàn hàng hải (vmsa.vn) " +
    "và bản lưu trữ vms-south.vn trong Internet Archive",
  nhan: NHAN,
  layNgay: FETCHED_AT,
  luong,
  thongBao: thongBaoGon,
  diem,
  tuyen: tuyenGon,
  boSot,
};

const text = JSON.stringify(out);
const mb = text.length / 1024 / 1024;
if (mb > TRAN_MB) {
  throw new Error(
    `CHẶN: file ${mb.toFixed(1)} MB vượt trần ${TRAN_MB} MB của hook pre-commit. ` +
      "KHÔNG tự cắt dữ liệu cho vừa và KHÔNG tự nới trần — báo Lead (CLAUDE.md " +
      '"Dữ liệu bản đồ trong git"), rồi đổi ĐỊNH DẠNG LƯU chứ không đổi chỗ lưu.',
  );
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, text);

const ngay = thongBaoGon.map((t) => t.ngay).sort();
say(`\n════ KẾT QUẢ ════`);
say(`danh mục đọc được          ${stat.danhMuc}`);
say(`  · trong cửa sổ có PDF    ${stat.trongCuaSo}  (từ ${TU_NGAY})`);
say(`  · bộ lọc TIÊU ĐỀ CŨ bỏ   ${stat.loTieuDeCu}`);
say(`lưu trữ: URL xét ${stat.wbUrl}  ·  tải được ${stat.wbTai}  ·  thiếu số/ngày ${stat.wbThieuMeta}`);
say(`  · ngày trong PDF bị cổng loại (lấy ngày của bản lưu thay) ${stat.ngayBiTuChoi}`);
say(`PDF mở được                ${stat.coPdf}`);
say(`  · tải về KHÔNG phải PDF  ${stat.khongPhaiPdf}`);
say(`  · ảnh scan CHƯA OCR      ${stat.pdfScan}`);
say(`  · ảnh scan ĐỌC BẰNG OCR  ${stat.pdfOcr}`);
say(`  · OCR bị cổng mét chẵn loại ${stat.ocrChanBiBo}`);
say(`  · bảng mã hỏng           ${stat.pdfRac}`);
say(`  · BẢNG CÓ CỘT ĐỘ SÂU     ${stat.khuonDiem}`);
say(`  · TIM TUYẾN / GÓC VÙNG   ${stat.khuonTuyen}`);
say(`  · không có bảng toạ độ   ${stat.khongBang}`);
say(`điểm đo sâu                ${stat.diem}`);
say(`tuyến                      ${tuyenGon.length}`);
say(`vùng (cơ quan ban hành)    ${luong.length}`);
for (const [i, l] of luong.entries()) {
  const n = diem.filter((d) => thongBaoGon[d[3]]?.luong === i).length;
  const t = tuyenGon.filter((x) => thongBaoGon[x.tb]?.luong === i).length;
  say(`   ${l.ma.padEnd(14)} ${l.ten.padEnd(42)} ${String(n).padStart(6)} điểm  ${String(t).padStart(4)} tuyến`);
}
if (maLa.size) {
  say(`\n⚠ mã cơ quan CHƯA có trong bảng CO_QUAN (dữ liệu bị bỏ, KHÔNG đoán):`);
  for (const [k, v] of [...maLa.entries()].sort((a, b) => b[1] - a[1])) say(`   ${k} × ${v}`);
}
say(`cũ nhất / mới nhất         ${ngay[0] ?? "-"} … ${ngay[ngay.length - 1] ?? "-"}`);
{
  // Hai con số này phải LUÔN in ra. Cờ nào không ai đếm là cờ sẽ chết lặng —
  // đúng cách `ngayUocLuong` đã chết lặng suốt đợt trước.
  const nUoc = thongBaoGon.filter((t) => t.ngayUocLuong).length;
  const nOcr = thongBaoGon.filter((t) => t.ocr).length;
  const diemOcr = diem.filter((d) => thongBaoGon[d[3]]?.ocr).length;
  const diemUoc = diem.filter((d) => thongBaoGon[d[3]]?.ngayUocLuong).length;
  say(`thông báo NGÀY SUY ĐOÁN    ${nUoc} (mang cờ ngayUocLuong) → ${diemUoc} điểm`);
  say(`thông báo đọc bằng OCR     ${nOcr} (mang cờ ocr) → ${diemOcr} điểm`);
}
say(`bỏ sót                     ${boSot.length}`);
say(`\n${OUT} — ${mb.toFixed(2)} MB (${(text.length / Math.max(1, stat.diem)).toFixed(0)} byte/điểm)`);
