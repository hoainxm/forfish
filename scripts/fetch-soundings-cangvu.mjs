// Sinh LỚP SỐ ĐO SÂU KHẢO SÁT từ TRANG RIÊNG CỦA CÁC CẢNG VỤ HÀNG HẢI TỈNH —
// chạy CÓ CHỦ Ý, không phải phản xạ:
//
//   node scripts/fetch-soundings-cangvu.mjs --do                 # chỉ DÒ, không ghi file
//   node scripts/fetch-soundings-cangvu.mjs --trang 6 --max 40   # lượt chạy chuẩn
//   node scripts/fetch-soundings-cangvu.mjs --cv kien-giang,binh-thuan --max 25
//   node scripts/fetch-soundings-cangvu.mjs --xem <url-pdf>      # in chữ bóc được, gỡ rối
//
// Đầu ra mặc định: public/data/soundings-cangvu.v1.json
// Kết quả đo được + bảng 27 cảng vụ: docs/research/cang-vu-tinh-2026-08.md
//
// ── VÌ SAO CÓ FILE NÀY, TRONG KHI ĐÃ CÓ fetch-soundings.mjs ───────────────
// `fetch-soundings.mjs` bóc kho TRUNG ƯƠNG (vmsa.vn). Kho đó có hai lỗ thật,
// đo được (docs/research/nguon-do-sau-mo-rong-2026-08.md):
//   · Hải Phòng — vùng đông thông báo nhất — có ~47% PDF là ẢNH SCAN, không
//     có lớp chữ, bóc không ra chữ nào.
//   · Miền Nam chỉ được lưu từ 05/2025; trước đó kho trung ương trống.
// Mỗi cảng vụ tỉnh lại có trang riêng với mục Thông báo hàng hải của mình, và
// `cangvuhaiphong.gov.vn` phát bản `.signed.pdf` CÓ LỚP CHỮ — tức là né được
// OCR ở đúng vùng tệ nhất. Đây là nguồn BỔ SUNG cho kho trung ương.
//
// ── FILE RIÊNG, KHÔNG TRỘN ───────────────────────────────────────────────
// Kết quả ghi ra `soundings-cangvu.v1.json`, KHÔNG đè file của kho trung ương.
// Nguồn khác nhau thì độ tin khác nhau; trộn hai kho vào một file là mất khả
// năng truy nguồn, và không ai còn phân biệt được một điểm đến từ đâu. Việc
// gộp (nếu gộp) là quyết định của Lead, làm ở tầng trên, trên hai file còn
// nguyên vẹn.
//
// Kiểu dữ liệu dùng CHUNG với `src/lib/soundings.ts` (`SoundingsFile`, kể cả
// `tuyen[]`), và vùng gán bằng CHÍNH hàm `areaFromNotice` của thư viện — Lead
// gộp được mà không phải chuyển đổi gì.
//
// ── NGUỒN ─────────────────────────────────────────────────────────────────
// 16 trang cảng vụ còn sống (đo 2026-08-31), ba họ mã nguồn và BỐN kiểu bày
// mục — nhận nhầm kiểu là ra 0 mục mà tưởng "trang này không có thông báo":
//   · họ ASPX  — `index.aspx?page=news&cat=<N>`, chi tiết `?page=detail&id=<N>`.
//     Phân trang là POSTBACK của ASP.NET WebForms: phải POST lại toàn bộ
//     `__VIEWSTATE`/`__EVENTVALIDATION` kèm `<nút>.x/.y`. Không có tham số
//     `?p=2` nào cả — đã thử 10 biến thể, tất cả trả về trang 1.
//     Bốn kiểu bày mục: `tin` · `xep` (accordion, KHÔNG có trang chi tiết và
//     KHÔNG có ngày) · `bang` (GridView) · `muc-con` (phải vào từng mục con).
//   · họ WordPress — `/chuyen-muc/thong-bao-hang-hai/`. Lấy danh mục qua
//     `wp-json/wp/v2` (nhanh, có sẵn ngày). Link PDF nấp trong tham số `file=`
//     của plugin `pdfjs-viewer-shortcode`, phải bóc ra rồi tải thẳng.
//   · Đà Nẵng dùng mã nguồn thứ ba, không WP không ASPX — bắt link bài theo
//     tiền tố `/vi/thong-bao-hang-hai...`.
// Không trang nào chặn tự động: không CAPTCHA, không lọc User-Agent, không
// giới hạn nhịp. Cản trở là kỹ thuật, không phải chính sách.
//
// ── BÓC CHỮ TỪ PDF ────────────────────────────────────────────────────────
// nợ: bộ bóc chữ PDF ở §3, và `nhanBang`/`readNotice` ở §8, là BẢN CHÉP từ
// `scripts/fetch-soundings.mjs` (cùng thuật toán, không sửa một dòng nào).
// Trần là: sửa lỗi ở một bản thì bản kia không được sửa theo. Điều kiện nâng
// cấp: khi Lead quyết gộp hai đường ống, tách ra `scripts/lib/tbhh-doc.mjs`
// cho CẢ HAI script nạp chung. Không tự tách ở đây vì `fetch-soundings.mjs`
// thuộc quyền teammate khác, sửa nó là dẫm chân.
// Bộ phân tích TOẠ ĐỘ, cắt mã cơ quan, đọc độ sâu khống chế thì KHÔNG chép:
// nạp thẳng từ `src/lib/soundings.ts`.
//
// ── BỐN CÁI BẪY ĐÃ DÍNH THẬT, MỖI CÁI MỘT CỔNG ───────────────────────────
// 1. TÊN ĐIỂM ĐỌC THÀNH ĐỘ SÂU. Chuỗi `DHN - 0 6` là TÊN điểm, bị đọc thành
//    độ sâu 6 m — ở một toạ độ THẬT, trong dải THẬT. Không cổng thông thường
//    nào chặn được, vì kết quả trông hoàn toàn hợp lệ. Cổng đúng nằm trong
//    `parseSoundingRow` + `hasDepthColumn` của thư viện (ô độ sâu phải CHỈ
//    CHỨA con số, và cổng đặt trên CẢ BẢNG chứ không từng hàng).
// 2. KHOẢNG TRẮNG NUỐT CỘT. `7,5 10°44'` đọc thành `510` độ. Cổng nằm ở khuôn
//    `D_DEG`/`D_MIN` của thư viện (chữ số phải LIỀN NHAU) cộng cổng khung biển
//    VN ở cuối. Bắt được thật 2 lần lượt chạy này (kinh độ 3,9° và 7,0° — bờ
//    Tây Phi), ghi rõ trong `boSot`. Có ca đối chứng trong test.
// 3. GÁN SAI CẢNG VỤ. Ở kho trung ương slug không khớp tỉnh (`an-giang-456`
//    thực ra là Kiên Giang). Ở đây TÊN MIỀN CŨNG KHÔNG ĐÁNG TIN: 40 thông báo
//    độ sâu lấy từ `cangvuhaiphong.gov.vn` mang mã của TÁM cảng vụ khác và
//    KHÔNG có Hải Phòng — trang đó đang làm bảng tin đăng lại của cả nước.
//    Nên vùng đọc bằng `areaFromNotice` từ SỐ HIỆU; mã lạ thì bỏ, KHÔNG lấy
//    tên miền thay thế. Cùng một số hiệu lấy được ở hai trang thì gộp lại.
// 4. ĐỘ SÂU KHỐNG CHẾ CỦA CẢ VÙNG GẮN VÀO TỪNG GÓC VÙNG. Khuôn phổ biến nhất
//    ở trang cảng vụ: bảng BỐN GÓC vùng khảo sát (không có cột độ sâu) rồi
//    câu "…đạt 14,46 m" ở văn xuôi. Bốn góc đó KHÔNG phải bốn phép đo — gắn
//    con số vào chúng là bịa ra bốn phép đo chưa từng có ở bốn toạ độ thật.
//    Chúng đi vào `tuyen[]` (một ĐƯỜNG mang độ sâu khống chế), không vào
//    `diem[]`.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ─────────────────────────────────────────────
// Script chạy LÚC PHÁT TRIỂN trên máy người viết mã, không chạy trong app của
// bà con. (a) không thêm request mạng nào lúc mở app; (b) không đụng
// `public/sw.js`, `SHELL`, danh sách cache hay khoá `forfish.*`; (c) không
// đè/xoá dữ liệu bà con đã tải — file sinh ra là asset tĩnh MỚI, đường dẫn
// riêng, chưa nối vào màn hình nào; (d) chưa có màn hình nào đọc nó.
//
// ── TRẦN DUNG LƯỢNG (CLAUDE.md "Dữ liệu bản đồ trong git") ────────────────
// Một file `public/data/**` > 20 MB thì hook CHẶN. File này ở mức vài chục KB
// (số đo sâu là số, không phải hình học), còn xa trần — nhưng vẫn chạy theo
// `--max`/`--trang` chứ không quét sạch 16 trang mỗi lần, vì mỗi lần sinh lại
// là một bản sao vĩnh viễn trong lịch sử git.
//
// ## Assumptions
// - `source: "tbhh"` CHƯA có trong `SOURCES` của `src/lib/provenance.ts` (file
//   đó không thuộc phạm vi thay đổi này). Dùng đúng chuỗi mà
//   `fetch-soundings.mjs` đang dùng để hai kho còn ghép được; `validateProvenance`
//   sẽ báo "nguồn lạ" cho tới khi có người đăng ký nguồn — đúng như thiết kế,
//   không phải lỗi im lặng.
// - `luong[]` sinh bằng `areaFromNotice`, nên `ma` là MÃ CƠ QUAN viết hoa
//   (`CVHHKG`, `CVHHTPHCM`…) đúng như file của kho trung ương. `SITES[].ma`
//   là chuyện khác: đó chỉ là khoá cho tham số `--cv`.
// - NGÀY BAN HÀNH ưu tiên đọc từ TIÊU ĐỀ ("… số 1810/TBHH-CVHHTPHCM ngày
//   17/7/2026 …"), rồi dòng ký trong PDF, rồi mới tới ngày ĐĂNG của danh mục
//   (đo thật: 1810 ký 17/7 nhưng đăng 20/7). Bản ký số hay để TRỐNG ngày; khi
//   đó KHÔNG được lùi về một chuỗi dd/mm/yyyy bất kỳ trong văn bản — đã dính:
//   vớ phải "Nghị định 58/2017/NĐ-CP ngày 10/5/2017" và ghi một khảo sát 2025
//   thành đo năm 2017. Có cổng chặn khoảng ngày ở §11(c2).
// - Bình đồ khảo sát (`BINH DO…pdf`) treo cùng trang bị BỎ QUA có chủ ý: đó là
//   ảnh raster ~94 dpi, chữ số cao 7–9 px, dưới xa ngưỡng OCR đọc được
//   (docs/research/nguon-do-sau-mo-rong-2026-08.md §5). Tải về chỉ tốn băng
//   thông. Vẫn ghi vào `boSot` kèm URL để lần sau còn biết đường quay lại.
// - `readControllingDepthM` của `src/lib/soundings.ts` cho phép tối đa 80 ký
//   tự giữa "độ sâu" và "đạt". Câu chuẩn của các cảng vụ miền Nam dài 85 ký
//   tự ("Độ sâu được xác định bằng máy đo sâu hồi âm tần số 200 kHz tính đến
//   mực nước "số 0 Hải đồ" đạt 14,46 m"), nên KHÔNG khớp — đây là toàn bộ lý
//   do Bình Thuận có 33 PDF có chữ mà bóc ra 0. CỐ Ý không sửa (file đó thuộc
//   quyền teammate khác) và CỐ Ý không viết bản đọc thứ hai ở đây: hai bộ đọc
//   khác nhau trên cùng một loại văn bản là thứ tệ hơn cả trùng lặp mã. Việc
//   cần làm nằm ở docs/research/cang-vu-tinh-2026-08.md §6.1.

import { writeFileSync, mkdirSync, readFileSync, mkdtempSync } from "node:fs";
import { inflateSync, inflateRawSync, unzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const UA = "SDFish-build/1.0 (fisherman app; nautical depth notices)";
const REQ_TIMEOUT_MS = 60_000;
const POLITE_MS = 300;
const FETCHED_AT = new Date().toISOString().slice(0, 10);

const NHAN =
  "Độ sâu tham khảo — đo tại ngày ghi kèm, luồng bồi lắng liên tục. " +
  "Không thay hải đồ. Đi biển vẫn phải xem hải đồ và máy dò của tàu.";

/* ══ 0. DANH BẠ TRANG CẢNG VỤ ═══════════════════════════════════════════
   Dò thẳng bằng HTTP ngày 2026-08-31, 16/27 cảng vụ ven biển còn trang sống.

   Cột `ma` ở đây là KHOÁ TRANG cho tham số `--cv`, KHÔNG phải mã cảng vụ. Mã
   cảng vụ (`CVHHxx` trong số hiệu) chỉ đọc được từ chữ trong PDF và được ĐO ở
   §9 — đặt sẵn mã ở đây là đoán, mà đoán mã chính là bẫy 3.

   ⚠️ SÁP NHẬP TỈNH 2025: cảng vụ KHÔNG đổi tên theo tỉnh mới. Cảng vụ Kiên
   Giang vẫn tên Kiên Giang dù tỉnh nay là An Giang; Quy Nhơn vẫn Quy Nhơn dù
   tỉnh nay là Gia Lai; Nha Trang vẫn Nha Trang dù tỉnh nay là Khánh Hoà. Vì
   vậy `ten` là TÊN CẢNG VỤ (địa bàn quản lý), không phải tên tỉnh hành chính
   — gán theo tên tỉnh mới sẽ đặt Rạch Giá lên An Giang, một tỉnh không giáp
   biển ở đó.

   Các tên miền đã CHẾT, đo cùng ngày (ghi ra để lần sau khỏi dò lại):
   · không phân giải DNS — nam-dinh · quang-binh · quang-ngai · phu-yen ·
     ninh-thuan · vung-tau · my-tho · ca-mau · vinh-long · gia-lai ·
     khanh-hoa · lam-dong · dak-lak
   · chứng thư hết hạn VÀ chỉ còn trang mặc định Plesk (không nội dung) —
     quang-nam · an-giang · dong-thap                                       */

const SITES = [
  { ma: "quang-ninh", ten: "Quảng Ninh", host: "cangvuhanghaiquangninh.gov.vn", cms: "aspx", cat: 15 },
  { ma: "hai-phong", ten: "Hải Phòng", host: "cangvuhaiphong.gov.vn", cms: "wp", cat: 200 },
  { ma: "thai-binh", ten: "Thái Bình", host: "cangvuhanghaithaibinh.gov.vn", cms: "aspx", cat: 15 },
  { ma: "thanh-hoa", ten: "Thanh Hoá", host: "cangvuhanghaithanhhoa.gov.vn", cms: "aspx", cat: 30 },
  { ma: "nghe-an", ten: "Nghệ An", host: "cangvuhanghainghean.gov.vn", cms: "aspx", cat: 15 },
  { ma: "ha-tinh", ten: "Hà Tĩnh", host: "cangvuhanghaihatinh.gov.vn", cms: "aspx", cat: 2084 },
  { ma: "quang-tri", ten: "Quảng Trị", host: "cangvuhanghaiquangtri.gov.vn", cms: "aspx", cat: 15 },
  { ma: "hue", ten: "Thừa Thiên Huế", host: "cangvuhanghaithuathienhue.gov.vn", cms: "aspx", cat: 30 },
  { ma: "da-nang", ten: "Đà Nẵng", host: "cangvuhanghaidanang.gov.vn", cms: "dnang", cat: 0 },
  { ma: "quy-nhon", ten: "Quy Nhơn", host: "cangvuhanghaiquynhon.gov.vn", cms: "aspx", cat: 15 },
  { ma: "nha-trang", ten: "Nha Trang", host: "cangvuhanghainhatrang.gov.vn", cms: "aspx", cat: 2014 },
  { ma: "binh-thuan", ten: "Bình Thuận", host: "cangvuhanghaibinhthuan.gov.vn", cms: "wp", cat: 15 },
  { ma: "tphcm", ten: "Thành phố Hồ Chí Minh", host: "cangvuhanghaitphcm.gov.vn", cms: "aspx", cat: 30 },
  { ma: "dong-nai", ten: "Đồng Nai", host: "cangvuhanghaidongnai.gov.vn", cms: "aspx", cat: 2046 },
  { ma: "can-tho", ten: "Cần Thơ", host: "cangvuhanghaicantho.gov.vn", cms: "aspx", cat: 0, catTab: "tb" },
  { ma: "kien-giang", ten: "Kiên Giang", host: "cangvuhanghaikiengiang.gov.vn", cms: "aspx", cat: 2049 },
];

/* ══ 1. THAM SỐ DÒNG LỆNH ══════════════════════════════════════════════ */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const ONLY = arg("cv", "").split(",").filter(Boolean);
const MAX_PER_CV = Number(arg("max", "30"));
const MAX_TRANG = Number(arg("trang", "4"));
const OUT = arg("out", "public/data/soundings-cangvu.v1.json");
const DRY = flag("do"); // chỉ DÒ: đo trang, không ghi file

/* ══ 2. NẠP MÃ THẬT TỪ src/lib/soundings.ts ════════════════════════════
   Bộ phân tích toạ độ phải là MỘT bản duy nhất, dùng chung với app, với test
   và với đường ống kho trung ương. Chép tay sang .mjs là mở đường cho hai bản
   lệch nhau. Node 20 chưa đọc được .ts nên dịch TẠI CHỖ.                   */

const CACHE_DIR = join(ROOT, "node_modules", ".cache", "sdfish-soundings-cangvu");

async function loadLib(name) {
  const ts = (await import("typescript")).default;
  mkdirSync(CACHE_DIR, { recursive: true });
  const dir = mkdtempSync(join(CACHE_DIR, "m-"));
  const src = readFileSync(join(ROOT, "src", "lib", `${name}.ts`), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  writeFileSync(join(dir, `${name}.mjs`), js);
  return import(pathToFileURL(join(dir, `${name}.mjs`)).href);
}

/* ══ 3. BÓC CHỮ TỪ PDF (zlib, không dependency) ════════════════════════
   nợ: bản chép của `scripts/fetch-soundings.mjs` — xem đầu file.           */

const ESC = { n: 10, r: 13, t: 9, b: 8, f: 12 };

function hexToUtf16(h) {
  let out = "";
  for (let i = 0; i + 1 < h.length; i += 4) {
    out += String.fromCharCode(parseInt(h.slice(i, i + 4).padEnd(4, "0"), 16));
  }
  return out;
}

/** Nhân hai ma trận affine PDF [a b c d e f]. */
function mul(a, b) {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/** Tách chuỗi nội dung PDF thành token: số · tên · chuỗi · dấu gom · toán tử. */
function* tokens(t) {
  let i = 0;
  const n = t.length;
  while (i < n) {
    const c = t[i];
    if (c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\0") {
      i++;
      continue;
    }
    if (c === "%") {
      while (i < n && t[i] !== "\n") i++;
      continue;
    }
    if (c === "(") {
      const bytes = [];
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        const ch = t[i];
        if (ch === "\\") {
          const nx = t[++i];
          if (nx >= "0" && nx <= "7") {
            let o = nx;
            while (o.length < 3 && t[i + 1] >= "0" && t[i + 1] <= "7") o += t[++i];
            bytes.push(parseInt(o, 8));
          } else if (nx !== "\n") {
            bytes.push(ESC[nx] ?? nx.charCodeAt(0));
          }
          i++;
          continue;
        }
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        bytes.push(ch.charCodeAt(0));
        i++;
      }
      yield { k: "str", bytes };
      continue;
    }
    if (c === "<" && t[i + 1] !== "<") {
      const end = t.indexOf(">", i);
      const hex = t.slice(i + 1, end < 0 ? n : end).replace(/[^0-9A-Fa-f]/g, "");
      const bytes = [];
      for (let j = 0; j < hex.length; j += 2) bytes.push(parseInt(hex.slice(j, j + 2).padEnd(2, "0"), 16));
      yield { k: "str", bytes };
      i = end < 0 ? n : end + 1;
      continue;
    }
    if (c === "<" || c === ">") {
      yield { k: "op", v: t.slice(i, i + 2) };
      i += 2;
      continue;
    }
    if (c === "[" || c === "]" || c === "{" || c === "}") {
      yield { k: "op", v: c };
      i++;
      continue;
    }
    if (c === "/") {
      let j = i + 1;
      while (j < n && !/[\s/[\]<>(){}%]/.test(t[j])) j++;
      yield { k: "name", v: t.slice(i + 1, j) };
      i = j;
      continue;
    }
    if (/[-+.0-9]/.test(c)) {
      let j = i;
      while (j < n && /[-+.0-9eE]/.test(t[j])) j++;
      const v = Number.parseFloat(t.slice(i, j));
      yield { k: "num", v: Number.isFinite(v) ? v : 0 };
      i = j;
      continue;
    }
    let j = i;
    while (j < n && !/[\s/[\]<>(){}%]/.test(t[j])) j++;
    if (j === i) j++;
    yield { k: "op", v: t.slice(i, j) };
    i = j;
  }
}

/** PDF (Buffer) → mảng TRANG, mỗi trang là mảng DÒNG chữ đã dựng lại. */
function pdfPages(buf) {
  const s = buf.toString("latin1");

  const objs = new Map();
  const reObj = /(?:^|[\s>])(\d+)\s+0\s+obj\b/g;
  let m;
  while ((m = reObj.exec(s)) !== null) objs.set(Number(m[1]), m.index + m[0].length);

  const rawCache = new Map();
  const packed = new Map(); // đối tượng nằm trong /ObjStm

  function rawOf(num) {
    if (rawCache.has(num)) return rawCache.get(num);
    const st = objs.get(num);
    let r = null;
    if (st != null) {
      const end = s.indexOf("endobj", st);
      r = { body: s.slice(st, end < 0 ? s.length : end), start: st };
    } else if (packed.has(num)) {
      r = { body: packed.get(num), start: -1 };
    }
    rawCache.set(num, r);
    return r;
  }

  function decode(bytes, hdr) {
    let b = bytes;
    const filters = [
      ...hdr.matchAll(
        /\/(FlateDecode|LZWDecode|ASCIIHexDecode|ASCII85Decode|DCTDecode|CCITTFaxDecode|JBIG2Decode|JPXDecode|RunLengthDecode)/g,
      ),
    ].map((f) => f[1]);
    for (const f of filters) {
      if (f !== "FlateDecode") return null; // ảnh — không phải chữ
      try {
        b = inflateSync(b);
      } catch {
        try {
          b = inflateRawSync(b);
        } catch {
          try {
            b = unzipSync(b);
          } catch {
            return null;
          }
        }
      }
    }
    return b;
  }

  function streamOf(num) {
    const r = rawOf(num);
    if (!r || r.start < 0) return null;
    const k = r.body.search(/stream\r?\n|stream\r/);
    if (k < 0) return null;
    const lead = r.body.slice(k).match(/stream\r?\n|stream\r/)[0];
    const hdr = r.body.slice(0, k);
    const abs = r.start + k + lead.length;
    const endRel = r.body.indexOf("endstream", k);
    if (endRel < 0) return null;
    return decode(buf.subarray(abs, r.start + endRel), hdr);
  }

  // ── bung object stream TRƯỚC, vì từ điển font/trang nằm trong đó
  for (const num of [...objs.keys()]) {
    const r = rawOf(num);
    if (!r || !/\/Type\s*\/ObjStm/.test(r.body)) continue;
    const b = streamOf(num);
    if (!b) continue;
    const t = b.toString("latin1");
    const n = Number(r.body.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const first = Number(r.body.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const head = t.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const on = head[i * 2];
      const off = head[i * 2 + 1];
      if (!Number.isFinite(on) || !Number.isFinite(off)) continue;
      const nxt = i + 1 < n ? first + head[i * 2 + 3] : t.length;
      if (!objs.has(on) && !packed.has(on)) packed.set(on, t.slice(first + off, nxt));
    }
  }

  function cmapOf(num) {
    const b = streamOf(num);
    if (!b) return null;
    const t = b.toString("latin1");
    const map = new Map();
    for (const blk of t.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
      for (const p of blk.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
        map.set(parseInt(p[1], 16), hexToUtf16(p[2]));
      }
    }
    // bfrange có HAI dạng đích: `<lo> <hi> <dst>` và `<lo> <hi> [<d0> <d1> …]`.
    // Bỏ dạng mảng là nuốt đúng các dấu tiếng Việt (á à â).
    for (const blk of t.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
      const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]*>)/g;
      let p;
      while ((p = re.exec(blk)) !== null) {
        const a = parseInt(p[1], 16);
        const z = parseInt(p[2], 16);
        if (p[3][0] === "[") {
          const dst = [...p[3].matchAll(/<([0-9A-Fa-f]*)>/g)].map((d) => hexToUtf16(d[1]));
          for (let c = a; c <= z && c - a < dst.length; c++) map.set(c, dst[c - a]);
        } else {
          const d = parseInt(p[3].slice(1, -1).slice(0, 4) || "0", 16);
          for (let c = a; c <= z && c - a < 65536; c++) map.set(c, String.fromCharCode(d + (c - a)));
        }
      }
    }
    return map.size ? map : null;
  }

  const fontCache = new Map();
  function fontOf(num) {
    if (fontCache.has(num)) return fontCache.get(num);
    const r = rawOf(num);
    const body = r ? r.body : "";
    const tu = body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    const f = { cid: /\/Type0\b/.test(body), map: tu ? cmapOf(Number(tu[1])) : null };
    fontCache.set(num, f);
    return f;
  }

  function decodeStr(bytes, font) {
    if (font?.cid) {
      let out = "";
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        out += font.map?.get((bytes[i] << 8) | bytes[i + 1]) ?? "";
      }
      return out;
    }
    if (font?.map) return bytes.map((c) => font.map.get(c) ?? String.fromCharCode(c)).join("");
    return bytes.map((c) => String.fromCharCode(c)).join("");
  }

  const pages = [];
  for (const num of [...objs.keys(), ...packed.keys()]) {
    const r = rawOf(num);
    if (!r || !/\/Type\s*\/Page(?![sA-Za-z])/.test(r.body)) continue;
    const res = {};
    const fm = r.body.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (fm) for (const p of fm[1].matchAll(/\/([^\s/]+)\s+(\d+)\s+0\s+R/g)) res[p[1]] = Number(p[2]);
    const cts = [];
    const c1 = r.body.match(/\/Contents\s+(\d+)\s+0\s+R/);
    if (c1) cts.push(Number(c1[1]));
    const c2 = r.body.match(/\/Contents\s*\[([^\]]*)\]/);
    if (c2) for (const p of c2[1].matchAll(/(\d+)\s+0\s+R/g)) cts.push(Number(p[1]));
    pages.push({ num, res, cts });
  }
  pages.sort((a, b) => a.num - b.num);

  return pages.map((pg) => {
    const items = [];
    for (const c of pg.cts) {
      const b = streamOf(c);
      if (b) runContent(b.toString("latin1"), pg.res, items);
    }
    return itemsToLines(items);
  });

  function runContent(t, res, items) {
    let ctm = [1, 0, 0, 1, 0, 0];
    const gs = [];
    let tm = [1, 0, 0, 1, 0, 0];
    let tlm = tm;
    let leading = 0;
    let font = null;
    const st = [];
    const push = (str) => {
      if (!str) return;
      const d = mul(tm, ctm);
      items.push({ x: d[4], y: d[5], s: str });
    };
    for (const tk of tokens(t)) {
      // `[ ] << >>` là DẤU GOM, không phải toán tử — xoá chồng ở đây là xoá
      // trắng mảng của TJ trước khi TJ đọc tới.
      if (tk.k !== "op" || tk.v === "[" || tk.v === "]" || tk.v === "<<" || tk.v === ">>") {
        st.push(tk);
        if (st.length > 4096) st.shift();
        continue;
      }
      const nums = st.filter((x) => x.k === "num").map((x) => x.v);
      switch (tk.v) {
        case "q":
          gs.push(ctm.slice());
          break;
        case "Q":
          ctm = gs.pop() ?? ctm;
          break;
        case "cm":
          if (nums.length >= 6) ctm = mul(nums.slice(-6), ctm);
          break;
        case "BT":
          tm = tlm = [1, 0, 0, 1, 0, 0];
          break;
        case "Tf": {
          const nm = [...st].reverse().find((x) => x.k === "name");
          font = nm && res[nm.v] != null ? fontOf(res[nm.v]) : null;
          break;
        }
        case "Tm":
          if (nums.length >= 6) tm = tlm = nums.slice(-6);
          break;
        case "Td":
        case "TD":
          if (nums.length >= 2) {
            if (tk.v === "TD") leading = -nums[nums.length - 1];
            tlm = mul([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], tlm);
            tm = tlm;
          }
          break;
        case "TL":
          if (nums.length) leading = nums[nums.length - 1];
          break;
        case "T*":
          tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
          tm = tlm;
          break;
        case "Tj":
        case "'":
        case '"': {
          if (tk.v !== "Tj") {
            tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
            tm = tlm;
          }
          const sv = [...st].reverse().find((x) => x.k === "str");
          if (sv) push(decodeStr(sv.bytes, font));
          break;
        }
        case "TJ": {
          const open = st.map((x) => x.k === "op" && x.v === "[").lastIndexOf(true);
          const arr = open >= 0 ? st.slice(open + 1) : st;
          let out = "";
          for (const el of arr) {
            if (el.k === "str") out += decodeStr(el.bytes, font);
            else if (el.k === "num" && el.v <= -200) out += " ";
          }
          push(out);
          break;
        }
        default:
          break;
      }
      st.length = 0;
    }
  }

  /** Gom mẩu chữ về DÒNG theo toạ độ vẽ; trong dòng sắp theo x (trái→phải). */
  function itemsToLines(items) {
    const rows = new Map();
    for (const it of items) {
      const k = Math.round(it.y / 3.2);
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k).push(it);
    }
    return [...rows.entries()]
      .sort((a, b) => b[0] - a[0]) // y lớn = trên đầu trang
      .map(([, r]) =>
        r
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean);
  }
}

/* ══ 4. TẢI TRANG ══════════════════════════════════════════════════════ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = "text", init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQ_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, ...(init.headers ?? {}) },
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return as === "buffer" ? Buffer.from(await r.arrayBuffer()) : await r.text();
  } finally {
    clearTimeout(timer);
  }
}

const ENT = {
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", egrave: "è", eacute: "é",
  ecirc: "ê", igrave: "ì", iacute: "í", ograve: "ò", oacute: "ó", ocirc: "ô",
  otilde: "õ", ugrave: "ù", uacute: "ú", yacute: "ý", ntilde: "ñ",
  quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", apos: "'", ldquo: "“", rdquo: "”",
  hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
};
function dec(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (x, n) => ENT[n.toLowerCase()] ?? x);
}
const strip = (s) => dec(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/** "28/08/2026" (mọi thứ tự ngày/tháng/năm) → "2026-08-28"; "" khi đọc không ra. */
function ngayVN(text) {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Ngày ban hành đọc TỪ CHỮ TRONG PDF — dùng khi danh mục không cho ngày
 * (trang Hà Tĩnh bày kiểu accordion, không có ngày ở đâu cả).
 * Văn bản viết "…, ngày 21 tháng 8 năm 2026".
 *
 * CHỈ nhận đúng khuôn dòng ký, KHÔNG được lùi về "một chuỗi dd/mm/yyyy bất kỳ
 * trong văn bản". Đã dính thật: bản ký số để trống ngày ("ngày tháng 6 năm
 * 2025"), bộ đọc lùi về chuỗi ngày đầu tiên gặp được và vớ phải
 * "Nghị định số 58/2017/NĐ-CP ngày 10/5/2017" — thành ra một khảo sát năm 2025
 * bị ghi là đo năm 2017. Với số đo sâu, sai tuổi cũng nguy hiểm như sai số.
 * Đọc không ra thì trả "" để người gọi lùi về ngày đăng của danh mục.
 */
function ngayTuChu(chu) {
  const m = chu.match(/ng[àa]y\s*(\d{1,2})\s*th[áa]ng\s*(\d{1,2})\s*n[ăa]m\s*(\d{4})/i);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

/**
 * Ngày KÝ đọc từ tiêu đề, khuôn "… số 1810/TBHH-CVHHTPHCM ngày 17/7/2026 …".
 * Chỉ nhận ngày đứng NGAY SAU số hiệu — tiêu đề còn nhiều ngày khác (ngày nghị
 * định, ngày khảo sát), vớ ngày đầu tiên gặp được là gán sai tuổi cho số đo.
 */
function ngayTuTieuDe(tieuDe) {
  const m = String(tieuDe).match(
    /TBHH\s*[-–]\s*(?:CVHH|CHH)[A-ZĐ]{1,8}\s*ng[àa]y\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
  );
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

/* ══ 5. ĐỌC DANH MỤC — BA HỌ MÃ NGUỒN ══════════════════════════════════ */

/**
 * Họ ASPX có tới BA cách bày mục, không phải một. Nhận nhầm là ra 0 mục mà
 * tưởng "trang này không có thông báo" — im lặng và sai:
 *   · `tin`      — có trang chi tiết `?page=detail&id=N`  (đa số)
 *   · `xep`      — accordion, tệp PDF nằm THẲNG trong danh mục, KHÔNG có
 *                  trang chi tiết và KHÔNG có ngày (Hà Tĩnh)
 *   · `bang`     — bảng GridView, tệp PDF + ngày nằm thẳng trong hàng (Cần Thơ)
 *   · `muc-con`  — trang chỉ chứa các chuyên mục con, phải vào từng cái (Huế)
 */
function kieuAspx(html) {
  if (/JqueryDisplayCate/.test(html)) return "muc-con";
  if (/id="accordion"/.test(html)) return "xep";
  if (/GridView_News/.test(html)) return "bang";
  return "tin";
}

/** Trang danh mục ASPX (một trang) → [{ url, tieuDe, ngay }] */
function parseAspxList(html, host) {
  const out = [];
  // Bài nổi + bài thường: <a href="index.aspx?page=detail&id=N" class="titleNews…">TIÊU ĐỀ</a>
  //                       … <div class="dateNews…">Thứ Sáu,&nbsp;28/08/2026, …</div>
  const re =
    /<a href="([^"]*page=detail&(?:amp;)?id=\d+)"[^>]*class="titleNews[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,400}?class="dateNews[^"]*">([^<]*)</g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ url: abs(host, dec(m[1])), tieuDe: strip(m[2]), ngay: ngayVN(dec(m[3])) });
  }
  // Khối "Các bài đã đăng": <a href="…">TIÊU ĐỀ</a><span class="dateNews">(15/07/2026)</span>
  const re2 =
    /<a href="([^"]*page=detail&(?:amp;)?id=\d+)"[^>]*>([\s\S]*?)<\/a>\s*<span class="dateNews">\(([^)]*)\)/g;
  while ((m = re2.exec(html)) !== null) {
    out.push({ url: abs(host, dec(m[1])), tieuDe: strip(m[2]), ngay: ngayVN(dec(m[3])) });
  }

  // Kiểu `bang` (GridView): tiêu đề + ngày + TỆP PDF nằm thẳng trong hàng.
  const re3 =
    /<a href="([^"]*page=detail&(?:amp;)?id=\d+)">\s*<span title="[^"]*">([\s\S]{5,400}?)<\/span>[\s\S]{0,200}?\((\d{1,2}\/\d{1,2}\/\d{4})\)([\s\S]{0,400}?)<\/label>/gi;
  while ((m = re3.exec(html)) !== null) {
    const pdf = m[4].match(/href=['"]([^'"]+\.(?:pdf|PDF))['"]/)?.[1];
    out.push({
      url: abs(host, dec(m[1])),
      tieuDe: strip(m[2]),
      ngay: ngayVN(dec(m[3])),
      pdf: pdf ? abs(host, dec(pdf).replace(/ /g, "%20")) : undefined,
    });
  }

  // Kiểu `xep` (accordion): KHÔNG có trang chi tiết, KHÔNG có ngày — tệp PDF
  // treo thẳng dưới tiêu đề. Ngày phải lấy từ chữ trong PDF, xem `ngayTuChu`.
  const re4 = /<li>\s*\d+\.(?:&nbsp;|\s)*([^<]{10,400}?)<\/li>\s*<ul>([\s\S]{0,4000}?)<\/ul>/g;
  while ((m = re4.exec(html)) !== null) {
    const pdf = m[2].match(/href="([^"]+\.(?:pdf|PDF))"/)?.[1];
    if (!pdf) continue;
    out.push({
      url: abs(host, dec(pdf).replace(/ /g, "%20")),
      tieuDe: strip(m[1]),
      ngay: "",
      pdf: abs(host, dec(pdf).replace(/ /g, "%20")),
    });
  }
  return out;
}

function abs(host, href) {
  if (/^https?:\/\//i.test(href)) return href;
  return `https://${host}/${href.replace(/^\/+/, "")}`;
}

/** Bóc toàn bộ `<input type=hidden>` của form ASP.NET WebForms. */
function hiddenFields(html) {
  const f = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) {
    const n = m[0].match(/name="([^"]+)"/)?.[1];
    if (!n) continue;
    f[n] = dec(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return f;
}

/**
 * Danh mục họ ASPX. Phân trang là POSTBACK: không có `?p=2`, phải POST lại
 * `__VIEWSTATE`/`__EVENTVALIDATION` kèm nút "Trang sau" (`.x`/`.y` vì nút là
 * `input type=image`). Bỏ qua bước này là chỉ lấy được trang 1 mà tưởng đã
 * quét hết — im lặng và sai.
 */
async function listAspx(site, maxTrang, catOverride) {
  const cat = catOverride ?? site.cat;
  const url = site.catTab
    ? `https://${site.host}/index.aspx?page=news&tab=${site.catTab}`
    : `https://${site.host}/index.aspx?page=news&cat=${cat}`;
  const rows = [];
  let html = await get(url);

  const kieu = kieuAspx(html);
  if (kieu === "muc-con") {
    // Chuyên mục cha chỉ bày các mục con (mỗi bến một mục) — phải vào từng cái.
    const cons = [
      ...new Set([...html.matchAll(/class="linkDisplayCate"[^>]*href="[^"]*cat=(\d+)"/g)].map((m) => m[1])),
    ];
    for (const c of cons) {
      await sleep(POLITE_MS);
      const r = await listAspx(site, maxTrang, c).catch(() => ({ rows: [] }));
      rows.push(...r.rows);
    }
    return { rows, tong: rows.length };
  }
  if (kieu === "xep" || kieu === "bang") {
    return { rows: parseAspxList(html, site.host), tong: 1 };
  }

  const tong = Number(html.match(/LabelTotalPage">(\d+)/)?.[1] ?? 1);
  for (let t = 1; ; t++) {
    rows.push(...parseAspxList(html, site.host));
    if (t >= Math.min(maxTrang, tong)) break;
    const nut = html.match(/name="([^"]*ImageButton_NavNext)"/)?.[1];
    if (!nut) break;
    const body = new URLSearchParams({
      ...hiddenFields(html),
      [`${nut}.x`]: "5",
      [`${nut}.y`]: "5",
    });
    await sleep(POLITE_MS);
    html = await get(url, "text", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }
  return { rows, tong };
}

/** JSON của WP hay bị plugin nối rác vào đuôi — cắt tới dấu `]` cuối cùng. */
function jsonArray(text) {
  const i = text.lastIndexOf("]");
  return JSON.parse(i >= 0 ? text.slice(0, i + 1) : text);
}

/** Danh mục họ WordPress qua REST — có sẵn ngày, không phải mò HTML. */
async function listWp(site, maxTrang) {
  const rows = [];
  let tong = 0;
  for (let p = 1; p <= maxTrang; p++) {
    const u =
      `https://${site.host}/wp-json/wp/v2/posts?categories=${site.cat}` +
      `&per_page=25&page=${p}&_fields=date,link,title`;
    const arr = jsonArray(await get(u));
    if (!Array.isArray(arr) || !arr.length) break;
    tong += arr.length;
    for (const post of arr) {
      rows.push({
        url: post.link,
        tieuDe: strip(post.title?.rendered ?? ""),
        ngay: String(post.date ?? "").slice(0, 10),
      });
    }
    if (arr.length < 25) break;
    await sleep(POLITE_MS);
  }
  return { rows, tong };
}

/** Đà Nẵng — mã nguồn thứ ba: bắt link bài theo tiền tố `/vi/thong-bao…`. */
async function listDanang(site) {
  const html = await get(`https://${site.host}/vi/chuyen-muc/thong-bao-hang-hai`);
  const seen = new Set();
  const rows = [];
  const re = /<a[^>]+href="(\/vi\/thong-bao[^"#?]*)"[^>]*>([\s\S]{10,300}?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = abs(site.host, m[1]);
    if (seen.has(url)) continue;
    seen.add(url);
    rows.push({ url, tieuDe: strip(m[2]), ngay: "" }); // ngày lấy ở trang chi tiết
  }
  return { rows, tong: rows.length };
}

async function listOf(site, maxTrang) {
  if (site.cms === "wp") return listWp(site, maxTrang);
  if (site.cms === "dnang") return listDanang(site);
  return listAspx(site, maxTrang);
}

/* ══ 6. TRANG CHI TIẾT → PDF ═══════════════════════════════════════════ */

/** Tệp đính kèm là BÌNH ĐỒ raster, không phải văn bản có lớp chữ. */
const RE_BINH_DO = /b[ìi]nh\s*[-_]?\s*[đd][ồo]|binh[-_ ]?do|khao[-_ ]?sat|BINH_DO/i;

/**
 * Trang chi tiết → { pdf, ngay, binhDo }.
 *
 * Hai kiểu nhúng:
 *   · thẻ `<a href="…pdf">` thẳng (họ ASPX)
 *   · tham số `file=…pdf` của plugin `pdfjs-viewer-shortcode` (họ WordPress) —
 *     link hiện ra trong HTML là URL của trình xem, không phải của tệp.
 */
function pdfOf(html, host) {
  const cands = [];
  for (const m of html.matchAll(/file=([^"'&<>\s]+\.(?:pdf|PDF))/g)) cands.push(dec(m[1]));
  for (const m of html.matchAll(/href="([^"]+\.(?:pdf|PDF))"/g)) cands.push(dec(m[1]));
  const seen = new Set();
  const all = [];
  for (const c of cands) {
    const u = abs(host, c.replace(/ /g, "%20"));
    if (seen.has(u)) continue;
    seen.add(u);
    all.push(u);
  }
  const vanBan = all.find((u) => !RE_BINH_DO.test(decodeURIComponent(u)));
  const binhDo = all.filter((u) => RE_BINH_DO.test(decodeURIComponent(u)));
  return { pdf: vanBan ?? null, binhDo, all };
}

/* ══ 7. SỐ HIỆU THÔNG BÁO ══════════════════════════════════════════════ */

/**
 * Số hiệu kiểu `947/TBHH-CVHHKG`. Tìm trong: chữ của PDF (đáng tin nhất), tên
 * tệp PDF, rồi tới HTML trang chi tiết. Trả `null` khi không thấy — KHÔNG đoán.
 *
 * Cắt mã cơ quan ra khỏi số hiệu là việc của `noticeAuthorityCode`/
 * `areaFromNotice` trong `src/lib/soundings.ts` — ở đây CHỈ tìm chuỗi số hiệu
 * rồi chuẩn hoá về khuôn `<số>/TBHH-<mã>`. Có bản cắt mã thứ hai là có hai
 * cách đọc khác nhau cho cùng một số hiệu, tức là bẫy 3 quay lại bằng cửa sau.
 *
 * Ba chỗ dễ trượt, mỗi chỗ đã đo thật:
 * · Dấu ngăn giữa số và `TBHH` có thể là `/`, `-` HOẶC `.` — tên tệp của Bình
 *   Thuận là `833.TBHH-CVHHBT.signed.signed.pdf`. Bỏ dấu chấm là mất trắng cả
 *   một cảng vụ (33 PDF có chữ mà không nhận ra số hiệu nào).
 * · Mã phải bắt đầu bằng `CVHH`/`CHH`/`CT`/`TCT` VÀ còn chữ nữa. Nới ra thì
 *   dòng bị ngắt giữa chừng ("… /TBHH - CVHH" xuống dòng) đẻ ra mã cụt `CVHH`,
 *   `CVH` — mã cụt là mã lạ, `areaFromNotice` trả `null`, cả thông báo rơi.
 * · KHÔNG viết hoa/viết thường lại mã: `CVHHQNg` (Quảng Ngãi) và `CVHHQNh`
 *   (Quy Nhơn) chỉ khác nhau ở chữ cuối viết thường.
 * · Dòng "Số: …" ở ĐẦU văn bản phải thắng: thân văn bản hay có câu "Tiếp theo
 *   Thông báo hàng hải số 2012/TBHH-CVHHTPHCM ngày…" — lấy số đầu tiên gặp
 *   được là lấy nhầm số hiệu của một thông báo KHÁC, rồi lý lịch nguồn trỏ sai
 *   chỗ mà vẫn trông hợp lệ.
 */
/* Sau mã KHÔNG được nuốt phần đuôi tên tệp: `833.TBHH-CVHHBT.signed.signed.pdf`
   mà cho dấu chấm vào lớp ký tự thì bắt luôn thành `CVHHBT.signed.si`, rồi
   `noticeAuthorityCode` gột dấu chấm ra `CVHHBTsignedsi` — một mã không có
   trong bảng, và cả cảng vụ Bình Thuận rơi. Chỉ cho một khúc `.CHỮ HOA` đi
   tiếp (dạng thật `24/TBHH-CT.BĐATHHMB`), còn `.signed` viết thường thì dừng. */
const RE_SO = /(\d{1,5})\s*[/.-]\s*TBHH\s*[-–]\s*((?:CVHH|CHH|CT|TCT)[A-ZĐa-zđ]{1,12}(?:\.[A-ZĐ]{2,12})?)/;
const RE_SO_DAU = new RegExp(`S[ốo]\\s*:?\\s*${RE_SO.source}`);

function soHieu(...texts) {
  const gon = texts.filter(Boolean).map((t) => String(t).replace(/\s+/g, " "));
  for (const re of [RE_SO_DAU, RE_SO]) {
    for (const t of gon) {
      const m = t.match(re);
      if (m) return `${m[1]}/TBHH-${m[2].replace(/[.]+$/, "")}`;
    }
  }
  return null;
}

/* ══ 8. ĐỌC MỘT THÔNG BÁO ══════════════════════════════════════════════ */

const RE_VN2000 = /VN\s*-?\s*2000/i;
const RE_WGS84 = /WGS\s*-?\s*84/i;

/*  nợ: `nhanBang` + `readNotice` dưới đây là BẢN CHÉP từ
    `scripts/fetch-soundings.mjs` (thuật toán y hệt, không sửa một dòng nào).
    Trần là: sửa lỗi ở một bản thì bản kia không được sửa theo. Điều kiện nâng
    cấp: khi Lead quyết gộp hai đường ống, tách ra `scripts/lib/tbhh-doc.mjs`
    cho cả hai nạp chung. Chép chứ không viết lại: hai bộ đọc khác nhau trên
    CÙNG một loại văn bản sẽ cho hai kết quả khác nhau ở cùng một thông báo, và
    đó là thứ tệ hơn cả trùng lặp mã. */

/**
 * Nhãn của bảng = dòng gần nhất TRƯỚC dòng tiêu đề hệ toạ độ có nói tới đoạn
 * luồng / khu nước. Đây là chữ của chính thông báo, không phải chữ ta đặt.
 */
const RE_NHAN =
  /^\s*(?:[a-z][).]|\d+[.)]|-)?\s*(Đo[ạa]n\s*lu[ồo]ng|Tuy[ếe]n\s*lu[ồo]ng|Lu[ồo]ng\s*h[àa]ng\s*h[ảa]i|Khu\s*n[ưu][ớo]c|V[ũu]ng\s*quay)/i;

function nhanBang(lines, i) {
  for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
    const l = String(lines[j] ?? "").replace(/\s+/g, " ").trim();
    if (!RE_NHAN.test(l)) continue;
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
 * Khuôn (b) là ĐA SỐ ở các trang cảng vụ tỉnh: phần lớn thông báo in bốn góc
 * vùng khảo sát rồi nói "độ sâu … đạt 14,46 m" ở văn xuôi. Gắn con số đó vào
 * bốn góc là bịa ra bốn phép đo chưa từng có, ở đúng bốn toạ độ thật — cùng
 * loại sai lầm với đọc tên điểm `DHN - 0 6` thành 6 m. Nên nó đi vào `tuyen`,
 * KHÔNG đi vào `diem`.
 *
 * Phân biệt (a)/(b) bằng `hasDepthColumn` — cổng CẢ BẢNG, không phải cổng từng
 * hàng; xem `soundings.ts`.
 *
 * PHẢI cắt theo TỪNG BẢNG, không gộp cả thông báo: một thông báo có thể có hai
 * bảng tim tuyến rời nhau, mỗi bảng một độ sâu. Gộp làm một là nối hai khúc
 * luồng cách nhau vài km thành một đường không có thật.
 */
function readNotice(pages, lib) {
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
      const noiTiep =
        cur &&
        cur.rows.length &&
        String(cur.order) === String(order) &&
        lib.readControllingDepthM(cur.tail.join(" ")) === null;
      if (!noiTiep) {
        cur = { order, rows: [], tail: [], nhan: nhanBang(lines, i) };
        bangs.push(cur);
      } else {
        cur.order = order;
      }
      continue;
    }

    const row = cur ? lib.parseSoundingRow(line) : null;
    if (row) {
      let wgs = null;
      for (const [k, pair] of row.pairs.entries()) {
        const datum =
          k < cur.order.length ? cur.order[k] : row.pairs.length === 1 ? cur.order[0] : null;
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
        pts.push({ lat: wgs.lat, lon: wgs.lon, depthM: row.depthM });
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
      boQua.push({
        line: b.nhan ?? "",
        lyDo: "bảng toạ độ không kèm câu độ sâu — có lẽ là góc khu vực, không phải luồng",
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

/**
 * PDF có lớp chữ NHƯNG bảng mã hỏng — trường hợp thứ ba, không phải "có chữ"
 * cũng không phải "ảnh scan".
 *
 * Vài cảng vụ (đo thật: Thừa Thiên Huế) nhúng font con KHÔNG kèm bảng
 * `/ToUnicode`. Bóc ra vẫn có hàng nghìn ký tự, đúng bố cục bảng, nhưng mỗi ký
 * tự là một mã tuỳ font: `Ubcd4PUe bd44Pce` thực ra là một cặp toạ độ. Nếu
 * không nhận ra, script sẽ báo "PDF không có bảng toạ độ" — sai lý do, và người
 * sau sẽ đi tìm nhầm chỗ.
 */
const RE_TU_THAT =
  /h[àa]ng h[ải]|[đd][ộo] s[âa]u|to[ạa] [đd][ộo]|TBHH|WGS|VN\s*-?\s*2000|C[ảa]ng v[ụu]/i;
const maHong = (chu) => chu.length > 200 && !RE_TU_THAT.test(chu);

/** Thông báo NÀY có phải thông báo độ sâu không (lọc trên tiêu đề). */
function isDepthNotice(tieuDe) {
  return /th[ôo]ng s[ốo] k[ỹy] thu[ậa]t|[đd][ộo] s[âa]u|chu[ẩa]n t[ắa]c/i.test(tieuDe);
}

/* ══ 9. CHẠY ═══════════════════════════════════════════════════════════ */

const lib = await loadLib("soundings");
const say = (...a) => console.log(...a);

// Cờ gỡ rối cho người làm sau: `--xem <url-pdf>` in ra chữ bóc được từ một
// PDF. Mỗi cảng vụ bày bảng một kiểu; không nhìn được chữ thô thì đoán mò.
const XEM = arg("xem", "");
if (XEM) {
  const pages = pdfPages(await get(XEM, "buffer"));
  say(`${pages.length} trang, ${pages.reduce((n, p) => n + p.length, 0)} dòng`);
  for (const [i, p] of pages.entries()) {
    say(`\n── trang ${i + 1}`);
    for (const l of p) say(`   ${l}`);
  }
  process.exit(0);
}

const luong = [];
const thongBao = [];
const diem = [];
const tuyen = [];
const boSot = [];
/** Bảng cho VIỆC 1 — dò được gì ở từng cảng vụ. */
const doDuoc = [];

const chon = ONLY.length ? SITES.filter((s) => ONLY.includes(s.ma)) : SITES;

/**
 * BẪY 3 — VÙNG ĐỌC TỪ SỐ HIỆU, KHÔNG ĐỌC TỪ TÊN MIỀN.
 *
 * Ở kho trung ương, slug chuyên mục không khớp tỉnh (`an-giang-456` thực ra là
 * Kiên Giang). Tên miền cảng vụ đáng tin hơn slug — nhưng chỉ đáng tin về việc
 * "đây là website của cảng vụ nào", KHÔNG về việc "thông báo này của cảng vụ
 * nào": trang cảng vụ đăng lại cả thông báo của cảng vụ khác (đo thật: trang
 * Hải Phòng có thông báo mang mã CVHHTPHCM, CVHHKG, CVHHBT, CVHHNT, CVHHCT,
 * CVHHNA, CVHHĐN).
 *
 * Nên vùng lấy từ `areaFromNotice` của `src/lib/soundings.ts` — ĐÚNG hàm mà
 * đường ống kho trung ương dùng, để hai file gộp được mà không phải quy đổi.
 * Mã lạ thì trả `null`: KHÔNG lấy tên miền thay thế, ghi `boSot`.
 */
function vungCua(so, lat) {
  const a = lib.areaFromNotice(so, lat);
  if (!a) return null;
  const i = luong.findIndex((x) => x.ma === a.ma);
  return i >= 0 ? i : luong.push(a) - 1;
}

for (const site of chon) {
  const d = {
    ma: site.ma,
    ten: site.ten,
    host: site.host,
    cms: site.cms,
    song: false,
    tbhh: 0,
    doSau: 0,
    pdfChu: 0,
    pdfScan: 0,
    maHong: 0,
    khongBang: 0,
    binhDo: 0,
    diem: 0,
    tuyen: 0,
    maQuanSat: new Map(), // mã cơ quan quan sát được → số lần
    lechMa: 0, // thông báo của cảng vụ KHÁC đăng nhờ trên trang này
    loi: "",
  };
  doDuoc.push(d);

  let rows = [];
  try {
    const r = await listOf(site, MAX_TRANG);
    rows = r.rows;
    d.song = true;
  } catch (e) {
    d.loi = e.message;
    say(`\n── ${site.ten.padEnd(22)} ! danh mục: ${e.message}`);
    continue;
  }

  // Bỏ trùng theo URL (bài nổi lặp lại ở khối "Các bài đã đăng").
  const seen = new Set();
  rows = rows.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
  d.tbhh = rows.length;

  const depth = rows.filter((r) => isDepthNotice(r.tieuDe)).slice(0, MAX_PER_CV);
  d.doSau = depth.length;
  say(`\n── ${site.ten} (${site.ma}) — ${rows.length} thông báo, ${depth.length} về độ sâu`);

  for (const r of depth) {
    try {
      let pdf = r.pdf ?? null;
      let ngay = r.ngay;
      let htmlChu = "";
      if (!pdf) {
        const html = await get(r.url);
        htmlChu = strip(html.slice(0, 20000));
        const found = pdfOf(html, site.host);
        d.binhDo += found.binhDo.length;
        for (const b of found.binhDo) {
          boSot.push({
            so: "",
            ngay,
            url: b,
            lyDo: "bình đồ khảo sát — ảnh raster ~94 dpi, chữ số cao 7–9 px, dưới ngưỡng OCR; chưa khai được",
          });
        }
        pdf = found.pdf;
        ngay = ngay || ngayVN(htmlChu);
        await sleep(POLITE_MS);
      }
      if (!pdf) {
        boSot.push({ so: "", ngay, url: r.url, lyDo: "trang chi tiết không có tệp PDF văn bản" });
        say(`  · ${r.tieuDe.slice(0, 46).padEnd(48)} không có PDF`);
        continue;
      }

      const buf = await get(pdf, "buffer");
      const pages = pdfPages(buf);
      const nLines = pages.reduce((n, p) => n + p.length, 0);
      const chu = pages.flat().join(" ");

      // Số hiệu: ưu tiên chữ trong PDF, rồi tên tệp, rồi HTML trang chi tiết.
      const so = soHieu(chu.slice(0, 4000), decodeURIComponent(pdf), htmlChu);
      const maCq = so ? lib.noticeAuthorityCode(so) : null;
      if (maCq) d.maQuanSat.set(maCq, (d.maQuanSat.get(maCq) ?? 0) + 1);

      /* NGÀY BAN HÀNH, không phải ngày đăng bài.
         Danh mục cho ngày ĐĂNG — muộn hơn ngày ký vài ngày (đo thật: thông báo
         1810/TBHH-CVHHTPHCM ký 17/7 nhưng đăng 20/7). Luồng bồi lắng theo ngày
         ĐO, nên phải lấy ngày ký. Nó nằm ngay trong tiêu đề ("… số
         1810/TBHH-CVHHTPHCM ngày 17/7/2026 Về thông số…"), rồi tới chữ trong
         PDF; ngày đăng chỉ là chỗ dựa cuối. */
      ngay = ngayTuTieuDe(r.tieuDe) || ngayTuChu(chu.slice(0, 3000)) || ngay;

      if (nLines < 5) {
        d.pdfScan++;
        boSot.push({
          so: so ?? "",
          ngay,
          url: r.url,
          lyDo: "PDF ảnh scan — không có lớp chữ, chưa OCR",
        });
        say(`  · ${(so ?? r.tieuDe.slice(0, 30)).padEnd(28)} SCAN (không lớp chữ)`);
        continue;
      }
      if (maHong(chu)) {
        d.maHong++;
        boSot.push({
          so: so ?? "",
          ngay,
          url: r.url,
          lyDo: "PDF có lớp chữ nhưng font không kèm bảng /ToUnicode — chữ bóc ra là mã tuỳ font, không đọc được",
        });
        say(`  · ${r.tieuDe.slice(0, 46).padEnd(48)} BẢNG MÃ HỎNG`);
        continue;
      }
      d.pdfChu++;

      const { pts, tuyen: tuyenMoi, boQua, khuon } = readNotice(pages, lib);
      if (!pts.length && !tuyenMoi.length) {
        d.khongBang++;
        const lyDo = boQua.length ? boQua[0].lyDo : `PDF không cho bảng toạ độ dùng được (${khuon})`;
        boSot.push({ so: so ?? "", ngay, url: r.url, lyDo });
        say(`  · ${(so ?? r.tieuDe.slice(0, 30)).padEnd(28)} 0 điểm — ${lyDo}`);
        continue;
      }

      if (!so || !ngay) {
        boSot.push({
          so: so ?? "",
          ngay,
          url: r.url,
          lyDo: !ngay
            ? "không đọc được ngày ban hành — số đo sâu không ngày là số nguy hiểm"
            : "không đọc được số hiệu — không xác định được cảng vụ ban hành",
        });
        say(`  · ${r.tieuDe.slice(0, 46).padEnd(48)} thiếu ngày/số hiệu — bỏ`);
        continue;
      }

      // Vĩ độ dùng để tách hai cảng vụ viết tắt trùng nhau (Đà Nẵng / Đồng Nai).
      const lat = pts.length ? pts[0].lat : tuyenMoi[0].diem[0][1];
      const iLuong = vungCua(so, lat);
      if (iLuong === null) {
        boSot.push({
          so,
          ngay,
          url: r.url,
          lyDo: `mã cơ quan trong số hiệu không có trong bảng CO_QUAN của soundings.ts — không gán vùng, KHÔNG lấy tên miền thay thế`,
        });
        say(`  · ${so.padEnd(28)} MÃ CƠ QUAN LẠ — bỏ`);
        continue;
      }
      if (maCq && !site.host.includes(luong[iLuong].ma.toLowerCase().replace(/^cvhh/, ""))) {
        // Không phải lỗi — chỉ là thông báo của cảng vụ khác đăng nhờ. Đếm để
        // báo cáo, vùng thì đã gán ĐÚNG theo số hiệu ở trên.
        d.lechMa++;
      }

      const iTb =
        thongBao.push({
          so,
          ngay,
          tieuDe: r.tieuDe,
          url: r.url,
          pdf,
          luong: iLuong,
          // LÝ LỊCH NGUỒN theo schema `Provenance` của src/lib/provenance.ts.
          prov: { origin: { source: "tbhh", at: FETCHED_AT, version: so, url: pdf } },
        }) - 1;

      for (const p of pts) diem.push([round5(p.lon), round5(p.lat), Math.round(p.depthM * 10), iTb]);
      for (const t of tuyenMoi) tuyen.push({ tb: iTb, ten: t.ten, diem: t.diem, sau: t.sau });
      d.diem += pts.length;
      d.tuyen += tuyenMoi.length;
      say(
        `  · ${so.padEnd(28)} ${String(pts.length).padStart(3)} điểm, ` +
          `${String(tuyenMoi.length).padStart(2)} tuyến  (${ngay})`,
      );
    } catch (e) {
      boSot.push({ so: "", ngay: r.ngay, url: r.url, lyDo: `tải/đọc lỗi: ${e.message}` });
      say(`  ! ${r.tieuDe.slice(0, 46).padEnd(48)} ${e.message}`);
    }
    await sleep(POLITE_MS);
  }
}

/* ══ 10. BẢNG DÒ (VIỆC 1) ══════════════════════════════════════════════ */

say(`\n════ BẢNG DÒ ${SITES.length} TRANG CẢNG VỤ ════`);
say(
  [
    "cảng vụ".padEnd(22),
    "sống",
    "TBHH",
    "độ sâu",
    "chữ",
    "scan",
    "mã hỏng",
    "0 bảng",
    "bình đồ",
    "điểm",
    "tuyến",
    "mã cơ quan quan sát được",
  ].join("  "),
);
for (const d of doDuoc) {
  say(
    [
      d.ten.padEnd(22),
      d.song ? " ok " : " -- ",
      String(d.tbhh).padStart(4),
      String(d.doSau).padStart(6),
      String(d.pdfChu).padStart(3),
      String(d.pdfScan).padStart(4),
      String(d.maHong).padStart(7),
      String(d.khongBang).padStart(6),
      String(d.binhDo).padStart(7),
      String(d.diem).padStart(4),
      String(d.tuyen).padStart(5),
      [...d.maQuanSat.keys()].join("/") || "-",
      d.loi ? `! ${d.loi}` : "",
    ].join("  "),
  );
}

if (DRY) {
  say(`\n(--do) chỉ dò, KHÔNG ghi file.`);
  process.exit(0);
}

/* ══ 11. NĂM CỔNG TỰ KIỂM — không qua thì KHÔNG ghi file ═══════════════ */

// (a) CHỦ QUYỀN: không cho lọt ký tự Hán/CJK vào bất kỳ chuỗi nào
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/;
const strings = [
  NHAN,
  ...luong.flatMap((l) => [l.ma, l.ten]),
  ...thongBao.flatMap((t) => [t.so, t.tieuDe, t.url, t.pdf]),
  ...tuyen.map((t) => t.ten ?? ""),
  ...boSot.flatMap((b) => [b.so, b.url, b.lyDo]),
];
const dirty = strings.filter((s) => CJK.test(s));
if (dirty.length) {
  throw new Error(`CHẶN: ${dirty.length} chuỗi còn ký tự Hán/CJK — ${dirty.slice(0, 5).join(" | ")}`);
}

// (b) KHUNG BIỂN VN + DẢI ĐỘ SÂU (chặn luôn bẫy 2: `7,5 10°44'` → 510 độ)
const bad = diem.filter(([lon, lat, dm]) => !lib.inVietnamSea(lat, lon) || !lib.isPlausibleDepth(dm / 10));
if (bad.length) {
  throw new Error(
    `CHẶN: ${bad.length} điểm ngoài khung VN hoặc độ sâu vô lý — ${JSON.stringify(bad.slice(0, 3))}`,
  );
}
const badTuyen = tuyen.filter(
  (t) =>
    t.diem.length < 2 ||
    t.diem.some(([lon, lat]) => !lib.inVietnamSea(lat, lon)) ||
    (t.sau !== null && !lib.isPlausibleRouteDepth(t.sau / 10)),
);
if (badTuyen.length) {
  throw new Error(
    `CHẶN: ${badTuyen.length} tuyến có đỉnh ngoài khung VN hoặc độ sâu khống chế vô lý — ${JSON.stringify(
      badTuyen.slice(0, 2),
    )}`,
  );
}

// (c) MỌI ĐIỂM PHẢI CÓ NGÀY + LÝ LỊCH — hải đồ cũ là hải đồ nguy hiểm
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const noDate = thongBao.filter(
  (t) => !ISO.test(t.ngay) || !t.prov?.origin?.source || !ISO.test(t.prov.origin.at),
);
if (noDate.length) {
  throw new Error(
    `CHẶN: ${noDate.length} thông báo thiếu ngày hoặc lý lịch — ${noDate.slice(0, 3).map((t) => t.so).join(", ")}`,
  );
}

// (c2) NGÀY PHẢI NẰM TRONG KHOẢNG CÓ NGHĨA — chặn kiểu sai đã dính thật: bản
// ký số để trống ngày, bộ đọc vớ phải ngày của một Nghị định trong phần căn cứ
// và ghi một khảo sát 2025 thành 2017. Số đo sâu sai tuổi cũng nguy hiểm như
// sai số: bà con thấy "đo năm ngoái" mà thật ra là chín năm trước.
const somNhat = "2005-01-01";
const xauNgay = thongBao.filter((t) => t.ngay < somNhat || t.ngay > FETCHED_AT);
if (xauNgay.length) {
  throw new Error(
    `CHẶN: ${xauNgay.length} thông báo có ngày ngoài khoảng ${somNhat}…${FETCHED_AT} — ${xauNgay
      .slice(0, 3)
      .map((t) => `${t.so}@${t.ngay}`)
      .join(", ")}`,
  );
}

// (d) BẪY 3 — VÙNG PHẢI SUY RA ĐƯỢC TỪ CHÍNH SỐ HIỆU, không từ tên miền.
// Chạy lại `areaFromNotice` trên đầu ra: mọi thông báo phải trỏ về đúng vùng
// mà số hiệu của nó chỉ tới. Cổng này bắt cả sai sót lập trình (gán nhầm chỉ
// số) lẫn sai sót nguồn (số hiệu bị bóc nhầm).
const viTri = new Map();
for (const [, lat, , ti] of diem) if (!viTri.has(ti)) viTri.set(ti, lat);
for (const t of tuyen) if (!viTri.has(t.tb)) viTri.set(t.tb, t.diem[0][1]);
const lech = thongBao.filter((t, i) => {
  const a = lib.areaFromNotice(t.so, viTri.get(i) ?? null);
  return !a || a.ma !== luong[t.luong]?.ma;
});
if (lech.length) {
  throw new Error(
    `CHẶN: ${lech.length} thông báo có số hiệu không khớp cảng vụ được gán — ${lech
      .slice(0, 3)
      .map((t) => `${t.so}→${luong[t.luong]?.ma}`)
      .join(", ")}`,
  );
}

// (e) TRẦN DUNG LƯỢNG (CLAUDE.md "Dữ liệu bản đồ trong git"): 20 MB/file.
// Không tự cắt dữ liệu cho vừa, không tự nới trần — vượt thì DỪNG, báo Lead.
const TRAN_MB = 20;

/* ══ 12. GHI ═══════════════════════════════════════════════════════════ */

diem.sort((a, b) => a[3] - b[3] || a[1] - b[1] || a[0] - b[0]);
tuyen.sort((a, b) => a.tb - b.tb);

/**
 * MỘT THÔNG BÁO CHỈ ĐƯỢC CÓ MỘT BẢN.
 *
 * Trang cảng vụ đăng lại thông báo của nhau: `969/TBHH-CVHHKG` lấy được ở CẢ
 * trang Kiên Giang lẫn trang Hải Phòng. Không gộp thì cùng một khúc luồng có
 * hai đường chồng lên nhau và bà con thấy hai con số ở cùng một chỗ.
 * Giữ bản nào cũng được — cùng một PDF — nên giữ bản gặp TRƯỚC.
 */
const banDau = new Map();
const doiCho = new Map();
for (const [i, t] of thongBao.entries()) {
  const key = t.so.toUpperCase();
  if (banDau.has(key)) doiCho.set(i, banDau.get(key));
  else {
    banDau.set(key, i);
    doiCho.set(i, i);
  }
}
const giu = thongBao.filter((_, i) => doiCho.get(i) === i);
const soMoi = new Map(giu.map((t, k) => [thongBao.indexOf(t), k]));
const chiSoMoi = (i) => soMoi.get(doiCho.get(i));

/* Bỏ theo BẢN THÔNG BÁO, KHÔNG bỏ theo toạ độ.
   Một bảng có thể ghi hai lần cùng một toạ độ với hai độ sâu khác nhau (hai
   lần đo, hai mục của cùng thông báo). Gộp theo toạ độ là im lặng vứt mất một
   phép đo thật — đo được: gộp kiểu đó ăn mất 19/174 điểm của TP.HCM. Bản trùng
   ở đây là bản của CÙNG MỘT thông báo lấy từ hai trang, nên bỏ nguyên bản là
   đủ và không mất gì. */
const diemGon = diem
  .filter(([, , , ti]) => doiCho.get(ti) === ti)
  .map(([lon, lat, dm, ti]) => [lon, lat, dm, chiSoMoi(ti)]);
const tuyenGon = tuyen
  .filter((t) => doiCho.get(t.tb) === t.tb)
  .map((t) => ({ tb: chiSoMoi(t.tb), ten: t.ten, diem: t.diem, sau: t.sau }));
thongBao.length = 0;
thongBao.push(...giu);
diem.length = 0;
diem.push(...diemGon);
tuyen.length = 0;
tuyen.push(...tuyenGon);

const out = {
  v: 1,
  nguon: "Thông báo hàng hải — trang riêng của các Cảng vụ Hàng hải tỉnh",
  nhan: NHAN,
  layNgay: FETCHED_AT,
  luong,
  thongBao,
  diem,
  tuyen,
  boSot,
};

const text = JSON.stringify(out);
if (text.length > TRAN_MB * 1024 * 1024) {
  throw new Error(
    `CHẶN: đầu ra ${(text.length / 1024 / 1024).toFixed(1)} MB vượt trần ${TRAN_MB} MB — báo Lead, đừng tự cắt`,
  );
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, text);

const ngay = thongBao.map((t) => t.ngay).sort();
const dinh = tuyen.reduce((n, t) => n + t.diem.length, 0);
say(`\n════ KẾT QUẢ ════`);
say(`cảng vụ có dữ liệu     ${luong.length}`);
say(`thông báo bóc được     ${thongBao.length}`);
say(`điểm đo sâu            ${diem.length}`);
say(`tuyến / khu nước       ${tuyen.length} (${dinh} đỉnh)`);
say(`cũ nhất / mới nhất     ${ngay[0] ?? "-"} … ${ngay[ngay.length - 1] ?? "-"}`);
say(`bỏ sót (ghi rõ lý do)  ${boSot.length}`);
for (const [i, l] of luong.entries()) {
  const nTb = thongBao.filter((t) => t.luong === i).length;
  const nD = diem.filter((p) => thongBao[p[3]]?.luong === i).length;
  const nT = tuyen.filter((t) => thongBao[t.tb]?.luong === i).length;
  say(`  ${l.ten.padEnd(38)} ${String(nTb).padStart(3)} thông báo · ${String(nD).padStart(4)} điểm · ${String(nT).padStart(3)} tuyến`);
}
say(`\n${OUT} — ${(text.length / 1024).toFixed(1)} KB`);
