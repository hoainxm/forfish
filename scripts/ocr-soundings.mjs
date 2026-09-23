// OCR THÔNG BÁO HÀNG HẢI DẠNG ẢNH SCAN — chạy CÓ CHỦ Ý, không phải phản xạ:
//
//   node scripts/ocr-soundings.mjs                     # miền Bắc (mặc định)
//   node scripts/ocr-soundings.mjs --mien tat-ca       # cả nước
//   node scripts/ocr-soundings.mjs --mien bac --max 40 # thử một nhúm
//   node scripts/ocr-soundings.mjs --dpi 300 --lai     # OCR lại, bỏ bản cũ
//
// File này KHÔNG sinh dữ liệu bản đồ. Nó chỉ làm MỘT việc: biến ảnh scan thành
// CHỮ, rồi cất chữ ấy vào kho ngoài repo. `scripts/fetch-soundings.mjs` gặp
// PDF không có lớp chữ thì mở kho này ra dùng, và mọi cổng chặn / mọi bộ đọc
// bảng vẫn là bản DUY NHẤT ở đó. Tách làm hai vì OCR chậm (vài giờ cho cả kho)
// còn bóc bảng thì vài giây — nhập một cục là mỗi lần sửa bộ đọc phải OCR lại.
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// 985/2.261 thông báo trong kho là ẢNH SCAN: không một ký tự nào bóc ra được
// (đã kiểm chéo bằng cách đếm toán tử vẽ chữ trong PDF — đây là bản chất của
// nguồn, không phải lỗi bộ bóc). Đường ống cũ ghi hết vào `boSot` với lý do
// "chưa OCR". Riêng Hải Phòng chiếm 183 bản trong số đó.
//
// Cái giá của việc bỏ qua chúng đo được: điểm đo sâu RỜI của cả kho dừng ở
// Nha Trang 11,88°B. Từ đó ra Bắc chỉ còn 13 đoạn luồng. Hải Phòng đóng góp
// 32% số thông báo mà KHÔNG đóng góp một điểm rời nào. Vì vậy mặc định của
// script là MIỀN BẮC — chỗ trắng nhất, không phải chỗ dễ nhất.
//
// ── CHỌN CÁCH OCR: VÌ SAO EASYOCR + PYPDFIUM2 ─────────────────────────────
// Máy dựng là Windows, KHÔNG có `tesseract`, KHÔNG có Java (đã kiểm). Ba ràng
// buộc quyết định:
//
//   (1) TIẾNG VIỆT CÓ DẤU là bắt buộc. Bộ đọc câu độ sâu tìm chữ "độ sâu …
//       đạt"; OCR trượt dấu là mất trắng khuôn (b) — khuôn ĐA SỐ của kho.
//       `Windows.Media.Ocr` có sẵn trong máy nhưng chỉ cài gói `en-US` → loại.
//   (2) KHÔNG thêm dependency vào `package.json` cho việc chạy vài lần một
//       năm (nguyên tắc 15 bậc 5). Cả hai gói là gói PYTHON, cài trong một
//       venv NGOÀI repo; `package.json` không đổi một dòng.
//   (3) `torch` + CUDA ĐÃ CÓ SẴN trên máy (RTX 3060). EasyOCR dùng lại đúng
//       bản torch ấy nên venv chỉ tốn vài chục MB, và OCR chạy ~4 giây/trang
//       thay vì ~40 giây trên CPU. Đây là lý do chọn EasyOCR thay vì
//       PaddleOCR: cùng chất lượng tiếng Việt, không kéo thêm một khung nền.
//
// Rasterize bằng `pypdfium2` (PDFium, giấy phép Apache/BSD) chứ KHÔNG dùng
// PyMuPDF: PyMuPDF là AGPL. Ở đây nó chỉ là công cụ chạy trên máy người viết
// mã nên chưa đụng tới nghĩa vụ nào, nhưng CLAUDE.md đã dặn tránh copyleft khi
// còn đường khác — và ở đây có đường khác, cùng tốc độ, không mất gì.
//
// ── HAI LƯỢT ĐỌC, VÌ MỘT LƯỢT LÀ ĐỌC SAI SỐ ───────────────────────────────
// Đo thật trên 976/TBHH-CVHHHP: lượt đọc thường cho `độ sâu đạt: 1,Sm` (chữ S
// thay chữ số 5) và `I,Om`. Trong ô toạ độ thì tệ hơn — mô hình không có ký tự
// "độ" trong bảng chữ nên nó đoán ra một chữ số: `20°48'` thành `20948'`.
//
// Nên mỗi trang chạy DÒ KHUNG một lần rồi ĐỌC HAI LƯỢT trên cùng bộ khung:
// lượt chữ (bảng chữ đầy đủ, giữ dấu tiếng Việt) và lượt số (`allowlist` chỉ
// chữ số + dấu ngăn, ép mô hình không được trả về chữ cái). Ô nào trông như ô
// số thì lấy lượt số. Dò khung một lần nên cái giá chỉ là phần đọc, không phải
// gấp đôi cả trang.
//
// Chữ ra rồi vẫn còn phải gột: `repairOcrDigits` + `ocrCoordLine` trong
// `src/lib/soundings.ts` (có test, dùng chung, KHÔNG chép tay sang đây).
//
// ── ẢNH SCAN VÀ FILE TẠM: KHÔNG MỘT BYTE NÀO VÀO REPO ─────────────────────
// CLAUDE.md quy tắc 5. PDF tải về, ảnh rasterize, chữ OCR — tất cả nằm trong
// thư mục tạm của hệ điều hành. PDF dùng CHUNG kho với `fetch-soundings.mjs`
// (cùng cách đặt tên `sha1(url)`) nên hai script không tải trùng nhau.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ──────────────────────────────────────────────
// Script chạy LÚC PHÁT TRIỂN, không chạy trong app của bà con. Không thêm
// request mạng nào lúc mở app, không đụng `public/sw.js`, không đụng khoá
// `forfish.*`, không đè dữ liệu bà con đã tải. Đầu ra là kho chữ ngoài repo.
//
// ## Assumptions
// - Danh sách PDF ảnh scan đọc từ `boSot` của `public/data/soundings.v1.json`
//   (lý do "PDF ảnh scan"). Đó là kết luận của chính đường ống bóc chữ, không
//   phải phán đoán mới. File chưa có thì script dừng và bảo chạy
//   `fetch-soundings.mjs` trước — không tự đi quét lại cả danh mục.
// - "Miền Bắc" = các cơ quan ban hành từ Thừa Thiên Huế trở ra (xem `MIEN_BAC`),
//   tức từ ~16,5°B. Cắt theo CƠ QUAN chứ không theo vĩ độ vì lúc chọn file thì
//   chưa có toạ độ nào để mà cắt.
// - Một trang OCR ra dưới `TOI_THIEU_DONG` dòng thì coi là trang ảnh trắng /
//   sơ đồ, không phải trang chữ — ghi rõ, không im.

import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const HOST = "https://vmsa.vn";
const UA = "SDFish-build/1.0 (fisherman app; nautical depth notices)";
const REQ_TIMEOUT_MS = 60_000;

/* ══ 0. THAM SỐ DÒNG LỆNH ═══════════════════════════════════════════════ */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const MIEN = arg("mien", "bac"); // "bac" | "tat-ca"
const MAX = Number(arg("max", "0")) || Infinity;
const DPI = Number(arg("dpi", "300"));
const LAI = has("lai"); // OCR lại kể cả khi kho đã có
/**
 * DỰNG LẠI DÒNG từ bản OCR THÔ đã có, KHÔNG đọc lại ảnh.
 *
 * Bộ gột chữ (`ocrLineToNoticeLine`) còn sửa nhiều lần, mà đọc lại ảnh cả kho
 * mất hàng giờ GPU trong khi dựng lại dòng mất vài giây. Tách hai bước ra
 * chính là để có cái cờ này.
 */
const DUNG_DONG = has("dung-lai-dong");
const POLITE_MS = Number(arg("nghi", "300"));
const NGUON_JSON = arg("tu", "public/data/soundings.v1.json");
/** Trang OCR ra ít hơn ngần này dòng thì không coi là trang chữ. */
const TOI_THIEU_DONG = 3;

/** Kho PDF — DÙNG CHUNG với `fetch-soundings.mjs`, cùng cách đặt tên. */
const KHO_PDF = arg("kho", join(tmpdir(), "sdfish-soundings-cache"));
/** Kho CHỮ OCR — `fetch-soundings.mjs` đọc đúng thư mục này. */
const KHO_OCR = arg("kho-ocr", join(tmpdir(), "sdfish-ocr-cache"));
/** venv Python có `pypdfium2` + `easyocr`. Ngoài repo, xem đầu file. */
const PY = arg(
  "python",
  process.env.SDFISH_OCR_PYTHON ?? join(tmpdir(), "sdfish-ocrenv", "Scripts", "python.exe"),
);

/* ══ 1. NẠP MÃ THẬT TỪ src/lib/soundings.ts ═════════════════════════════
   Bộ gột chữ OCR phải là MỘT bản duy nhất, dùng chung với app và với test —
   cùng lý do và cùng cách mà `fetch-soundings.mjs` đã làm.                  */

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

const lib = await loadLib("soundings");

/* ══ 2. CHỌN VIỆC — THÔNG BÁO NÀO LÀ ẢNH SCAN, VÙNG NÀO TRƯỚC ══════════ */

/**
 * Cơ quan ban hành từ Thừa Thiên Huế trở ra Bắc (~16,5°B trở lên).
 *
 * `CVHHĐN` (Đà Nẵng) KHÔNG có trong danh sách này dù nó ở 16,1°B: mã đó dùng
 * chung với Cảng vụ Đồng Nai và chỉ tách được bằng VĨ ĐỘ — mà lúc chọn file
 * thì chưa có toạ độ nào. Nó rơi vào lượt `--mien tat-ca`.
 */
const MIEN_BAC = new Set([
  "CVHHQN", // Quảng Ninh
  "CVHHHP", // Hải Phòng
  "CVHHTB", // Thái Bình
  "CVHHTH", // Thanh Hoá
  "CVHHNA", // Nghệ An
  "CVHHHT", // Hà Tĩnh
  "CVHHQT", // Quảng Trị
  "CVHHTTH", // Thừa Thiên Huế
  "TCTBĐATHHMB",
  "TCTBDATHHMB",
  "CTBĐATHHMB",
  "CTBDATHHMB",
]);

const say = (...a) => console.log(...a);

if (!existsSync(NGUON_JSON)) {
  say(`CHẶN: chưa có ${NGUON_JSON}. Chạy \`node scripts/fetch-soundings.mjs\` trước.`);
  process.exit(1);
}
const goc = JSON.parse(readFileSync(NGUON_JSON, "utf8"));
const scan = (goc.boSot ?? []).filter((b) => typeof b.lyDo === "string" && b.lyDo.includes("ảnh scan"));
say(`kho ${NGUON_JSON}: ${(goc.boSot ?? []).length} bỏ sót, ${scan.length} là ảnh scan`);

const viec = scan
  .filter((b) => MIEN !== "bac" || MIEN_BAC.has(lib.noticeAuthorityCode(b.so ?? "") ?? ""))
  .slice(0, MAX);
say(`chọn (mien=${MIEN}): ${viec.length} thông báo\n`);

/* ══ 3. LẤY FILE PDF ════════════════════════════════════════════════════ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const khoFile = (loai, url, duoi) =>
  join(KHO_PDF, loai, createHash("sha1").update(url).digest("hex") + duoi);

/** Tải một lần rồi giữ lại — CÙNG kho, CÙNG cách đặt tên với `fetch-soundings.mjs`. */
async function tai(loai, url, as) {
  const f = khoFile(loai, url, as === "buffer" ? ".bin" : ".txt");
  if (existsSync(f)) return as === "buffer" ? readFileSync(f) : readFileSync(f, "utf8");
  mkdirSync(join(KHO_PDF, loai), { recursive: true });
  const v = await get(url, as);
  writeFileSync(f, v);
  await sleep(POLITE_MS);
  return v;
}

/**
 * `boSot` ghi địa chỉ TRANG (vmsa) hoặc địa chỉ GỐC của bản lưu trữ, không ghi
 * địa chỉ PDF. Hàm này trả về `{ pdfUrl, loai }` để tải, hoặc `null` khi mục đó
 * không đính PDF (chuyện thường với bản cũ, không phải lỗi).
 *
 * Bản lưu trữ: `boSot.url` chính là địa chỉ PDF gốc trên vms-south.vn (đã
 * chết). Hỏi Wayback dấu thời gian gần nhất rồi tải bản NGUYÊN `…id_/…` —
 * cùng cách `fetch-soundings.mjs` làm, và kết quả cache chung một chỗ.
 */
/**
 * Bản lưu trữ: dấu thời gian phải lấy TỪ CHÍNH DANH MỤC CDX mà
 * `fetch-soundings.mjs` dùng, không hỏi API "available".
 *
 * Hai lý do, cả hai đều đo được:
 *   · API "available" trả bản chụp GẦN NHẤT, còn CDX (đã lọc `collapse=urlkey`)
 *     trả bản ĐẦU TIÊN. Hai bên ra hai dấu thời gian khác nhau cho cùng một
 *     file ⇒ hai địa chỉ PDF khác nhau ⇒ bản OCR nằm dưới một cái tên mà
 *     `fetch-soundings.mjs` không bao giờ tra tới. Công cốc mà không ai biết.
 *   · 1.413 PDF lưu trữ ĐÃ nằm trong kho chung dưới tên theo CDX. Hỏi API khác
 *     là tải lại toàn bộ từ Wayback — hàng giờ đập vào một hạ tầng công cộng
 *     miễn phí, để lấy đúng những file đã có sẵn trên đĩa.
 *
 * Danh mục CDX cũng đọc từ kho chung; chưa có thì tải một lần rồi cache.
 */
const WB_CDX =
  "http://web.archive.org/cdx/search/cdx?url=vms-south.vn*&output=json" +
  "&fl=timestamp,original&filter=statuscode:200&collapse=urlkey";

let wbTs = null;
async function napCdx() {
  if (wbTs) return wbTs;
  wbTs = new Map();
  let raw;
  try {
    raw = await tai("cdx", WB_CDX, "text");
  } catch (e) {
    say(`  ! CDX không đọc được (${e.message}) — bản lưu trữ sẽ bị bỏ qua`);
    return wbTs;
  }
  let hang;
  try {
    hang = JSON.parse(raw);
  } catch {
    say("  ! CDX không phải JSON — bản lưu trữ sẽ bị bỏ qua");
    return wbTs;
  }
  // GIỐNG HỆT `quetWayback`: bỏ dòng tiêu đề, chỉ .pdf, ĐẦU TIÊN thắng.
  for (const [ts, org] of hang.slice(1)) {
    if (!/\.pdf(\?|$)/i.test(org)) continue;
    if (!wbTs.has(org)) wbTs.set(org, ts);
  }
  say(`  danh mục CDX: ${wbTs.size} địa chỉ PDF lưu trữ`);
  return wbTs;
}

async function timPdf(url) {
  if (/\.pdf(\?|$)/i.test(url)) {
    const ts = (await napCdx()).get(url);
    if (!ts) return null;
    return { pdfUrl: `https://web.archive.org/web/${ts}id_/${url}`, loai: "wb" };
  }
  const html = await tai("detail", url, "text");
  const href = html.match(/href="(\/baodam\/upload\/files\/[^"]+\.pdf)"/i)?.[1];
  return href ? { pdfUrl: `${HOST}${href}`, loai: "pdf" } : null;
}

/* ══ 4. CHƯƠNG TRÌNH OCR (PYTHON) — VIẾT RA LÚC CHẠY, KHÔNG NẰM TRONG REPO
   Một file, một chủ sở hữu. Chương trình Python dưới đây là RUỘT của bước
   OCR chứ không phải một script dò rời, nên nó ở CÙNG file với phần điều
   phối để không ai sửa một nửa rồi quên nửa kia.                            */

const PY_SRC = String.raw`
import io, json, os, sys, warnings
warnings.filterwarnings("ignore")
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import numpy as np
import pypdfium2 as pdfium
import easyocr

# Chỉ chữ số và dấu ngăn. Ép mô hình KHÔNG được trả về chữ cái, nên ô toạ độ
# không còn ra '2O' hay '1,S'. Ký tự "độ" không có trong bảng chữ của mô hình
# nên nó vẫn ra một chữ số — phần gột nằm ở 'ocrCoordLine' bên Node.
SO = "0123456789.,'\"-"

# Ô nào lấy lượt SỐ: có ít nhất hai chữ số và phần lớn ký tự là số/dấu ngăn.
def la_o_so(txt):
    t = txt.strip()
    if sum(c.isdigit() for c in t) < 2:
        return False
    hop = sum(1 for c in t if c.isdigit() or c in ".,'\"-°oOsSiIlLzZbB")
    return hop >= len(t) * 0.8

viec = json.load(io.open(sys.argv[1], encoding="utf-8"))
dpi = float(sys.argv[2])
rd = easyocr.Reader(["vi", "en"], gpu=True, verbose=False)

for cong in viec:
    ra = cong["ra"]
    try:
        pdf = pdfium.PdfDocument(cong["pdf"])
        trang = []
        for i in range(len(pdf)):
            img = np.array(pdf[i].render(scale=dpi / 72).to_pil().convert("L"))
            ngang, tudo = rd.detect(img)
            hbox, fbox = ngang[0], tudo[0]
            chu = rd.recognize(img, hbox, fbox, detail=1, paragraph=False)
            so = rd.recognize(img, hbox, fbox, detail=1, paragraph=False, allowlist=SO)
            manh = []
            for a, b in zip(chu, so):
                txt = a[1]
                if la_o_so(txt) and b[1].strip():
                    txt = b[1]
                if not txt.strip():
                    continue
                xs = [p[0] for p in a[0]]
                ys = [p[1] for p in a[0]]
                manh.append({"t": txt, "x": float(min(xs)), "y": float(sum(ys) / 4),
                             "c": float(a[2])})
            trang.append(manh)
        json.dump({"dpi": dpi, "trang": trang},
                  io.open(ra, "w", encoding="utf-8"), ensure_ascii=False)
        print("OK " + cong["khoa"] + " " + str(len(trang)), flush=True)
    except Exception as e:
        print("LOI " + cong["khoa"] + " " + str(e).replace("\n", " ")[:160], flush=True)
`;

/* ══ 5. MẢNH CHỮ → DÒNG ═════════════════════════════════════════════════
   Gom về DÒNG y hệt bộ bóc chữ của `fetch-soundings.mjs` (`itemsToLines`):
   gom theo hàng, trong hàng sắp trái→phải, nối bằng MỘT dấu cách. Bảng toạ độ
   là bảng bố cục — đọc theo thứ tự mô hình trả về là ra hàng lộn cột.

   Khác một chỗ và chỉ một chỗ: ngưỡng gom hàng tính theo CHIỀU CAO TRANG chứ
   không phải hằng số 3,2 điểm ảnh của PDF, vì ảnh 300 DPI cao ~3.500 điểm ảnh
   trong khi trang PDF cao ~842. Một dòng chữ 13pt ở 300 DPI cao ~54 px, nên
   1/220 chiều cao trang (~16 px) đủ nhỏ để không dính hai dòng vào nhau và đủ
   lớn để không cắt một dòng hơi nghiêng làm đôi.                            */

function manhToDong(manh, caoTrang) {
  const buoc = Math.max(6, caoTrang / 220);
  const hang = new Map();
  for (const it of manh) {
    const k = Math.round(it.y / buoc);
    if (!hang.has(k)) hang.set(k, []);
    hang.get(k).push(it);
  }
  return [...hang.entries()]
    .sort((a, b) => a[0] - b[0]) // ảnh: y nhỏ = trên đầu trang
    .map(([, r]) =>
      r
        .sort((a, b) => a.x - b.x)
        .map((i) => i.t)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

/* ══ 6. CHẠY ════════════════════════════════════════════════════════════ */

function chayPython(congJson, dpi) {
  return new Promise((ok, hong) => {
    const srcFile = join(KHO_OCR, "_ocr.py");
    writeFileSync(srcFile, PY_SRC);
    const p = spawn(PY, [srcFile, congJson, String(dpi)], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let dong = "";
    p.stdout.setEncoding("utf8");
    p.stdout.on("data", (d) => {
      dong += d;
      const phan = dong.split("\n");
      dong = phan.pop() ?? "";
      for (const l of phan) if (l.trim()) say(`  ${l.trim()}`);
    });
    p.stderr.setEncoding("utf8");
    p.stderr.on("data", (d) => {
      const t = String(d).trim();
      if (t) say(`  ! ${t.slice(0, 300)}`);
    });
    p.on("error", hong);
    p.on("close", (ma) => (ma === 0 ? ok() : hong(new Error(`python thoát ${ma}`))));
  });
}

mkdirSync(KHO_OCR, { recursive: true });

if (!existsSync(PY)) {
  say(`CHẶN: không thấy Python có easyocr ở ${PY}`);
  say(`Dựng một lần (NGOÀI repo):`);
  say(`  python -m venv --system-site-packages <thư-mục-tạm>/ocrenv`);
  say(`  <thư-mục-tạm>/ocrenv/Scripts/python -m pip install pypdfium2 easyocr`);
  say(`rồi chạy lại với --python <đường-dẫn-python>`);
  process.exit(1);
}

const stat = { chon: viec.length, khongPdf: 0, taiLoi: 0, daCo: 0, gui: 0, ocrOk: 0, dong: 0, trangRong: 0 };
const cong = [];
const theoKhoa = new Map();

say("── lấy file PDF");
for (const b of viec) {
  let tim;
  try {
    tim = await timPdf(b.url);
  } catch (e) {
    stat.taiLoi++;
    say(`  ! ${b.so || b.url}: ${e.message}`);
    continue;
  }
  if (!tim) {
    stat.khongPdf++;
    continue;
  }
  /* Đặt tên bản OCR theo địa chỉ nào?
     · vmsa: theo địa chỉ PDF — địa chỉ đó cố định.
     · bản lưu trữ: theo địa chỉ GỐC, KHÔNG theo địa chỉ Wayback. Địa chỉ
       Wayback mang dấu thời gian của bản chụp, mà `fetch-soundings.mjs` lấy
       dấu thời gian ấy từ CDX còn ở đây lấy từ API "available" — hai bên có
       thể ra hai bản chụp khác nhau của cùng một file, và bản OCR sẽ nằm dưới
       một cái tên mà bên kia không bao giờ tra tới. */
  const khoa = createHash("sha1")
    .update(tim.loai === "wb" ? b.url : tim.pdfUrl)
    .digest("hex");
  const ra = join(KHO_OCR, `${khoa}.json`);
  const dongFile = join(KHO_OCR, `${khoa}.dong.json`);
  theoKhoa.set(khoa, { ...b, pdfUrl: tim.pdfUrl, ra, dongFile });
  /* CHẠY LẠI KHÔNG OCR LẠI.
     OCR cả kho mất hàng giờ, và một đợt bị ngắt giữa chừng là chuyện thường.
     Bản OCR THÔ (`ra`) đã có thì bỏ qua bước đọc ảnh — bước dựng dòng ở mục 7
     vẫn chạy cho nó, nên đợt sau tiếp đúng chỗ đợt trước dừng. */
  if (DUNG_DONG || (!LAI && (existsSync(dongFile) || existsSync(ra)))) {
    stat.daCo++;
    continue;
  }
  let f;
  try {
    await tai(tim.loai, tim.pdfUrl, "buffer");
    f = khoFile(tim.loai, tim.pdfUrl, ".bin");
  } catch (e) {
    stat.taiLoi++;
    say(`  ! ${b.so || tim.pdfUrl}: ${e.message}`);
    continue;
  }
  cong.push({ khoa, pdf: f, ra });
}
say(
  `  có PDF ${cong.length + stat.daCo}/${viec.length} · đã OCR sẵn ${stat.daCo} · ` +
    `không đính PDF ${stat.khongPdf} · tải lỗi ${stat.taiLoi}`,
);

if (cong.length) {
  stat.gui = cong.length;
  const congJson = join(KHO_OCR, "_viec.json");
  writeFileSync(congJson, JSON.stringify(cong), "utf8");
  say(`\n── OCR ${cong.length} thông báo ở ${DPI} DPI (easyocr vi+en, GPU)`);
  await chayPython(congJson, DPI);
  rmSync(congJson, { force: true });
}

/* ══ 7. MẢNH CHỮ → DÒNG ĐÃ GỘT, GHI VÀO KHO ════════════════════════════ */

say("\n── dựng dòng + gột chữ OCR");
const mapFile = join(KHO_OCR, "_map.json");
const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : {};

/* `--dung-lai-dong` KHÔNG đi qua danh sách `boSot`.
   Lý do: thông báo nào OCR đã mở khoá thành công thì lần chạy sau nó KHÔNG còn
   nằm trong `boSot` nữa — chọn theo `boSot` là chỉ dựng lại được đúng những
   file VẪN ĐANG HỎNG, tức ngược hẳn ý định. Đi thẳng vào kho chữ. */
if (DUNG_DONG) {
  theoKhoa.clear();
  for (const f of readdirSync(KHO_OCR)) {
    const m = /^([0-9a-f]{40})[.]json$/.exec(f);
    if (!m) continue;
    const khoa = m[1];
    theoKhoa.set(khoa, {
      so: map[khoa]?.so ?? "",
      url: map[khoa]?.url ?? "",
      pdfUrl: map[khoa]?.pdf ?? "",
      ra: join(KHO_OCR, f),
      dongFile: join(KHO_OCR, khoa + ".dong.json"),
    });
  }
  say("  dựng lại toàn kho: " + theoKhoa.size + " bản OCR thô");
}

for (const [khoa, b] of theoKhoa) {
  if (!existsSync(b.ra)) continue;
  if (!LAI && !DUNG_DONG && existsSync(b.dongFile)) {
    map[khoa] = { so: b.so, url: b.url, pdf: b.pdfUrl };
    continue;
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(b.ra, "utf8"));
  } catch {
    continue;
  }
  const cao = (297 / 25.4) * raw.dpi; // A4 dọc — mọi thông báo hàng hải đều A4
  const trang = [];
  for (const manh of raw.trang) {
    const dong = manhToDong(manh, cao).map((l) => lib.ocrLineToNoticeLine(l));
    if (dong.length < TOI_THIEU_DONG) stat.trangRong++;
    trang.push(dong);
    stat.dong += dong.length;
  }
  writeFileSync(b.dongFile, JSON.stringify({ ocr: "easyocr-vi", dpi: raw.dpi, trang }), "utf8");
  map[khoa] = { so: b.so, url: b.url, pdf: b.pdfUrl };
  stat.ocrOk++;
}
writeFileSync(mapFile, JSON.stringify(map, null, 1), "utf8");

say(`\n╭─ OCR THÔNG BÁO HÀNG HẢI ────────────────────────────────`);
say(`│ chọn (mien=${MIEN})        ${String(stat.chon).padStart(6)}`);
say(`│ không đính PDF           ${String(stat.khongPdf).padStart(6)}`);
say(`│ tải lỗi                  ${String(stat.taiLoi).padStart(6)}`);
say(`│ đã có trong kho          ${String(stat.daCo).padStart(6)}`);
say(`│ gửi cho OCR              ${String(stat.gui).padStart(6)}`);
say(`│ dựng dòng xong           ${String(stat.ocrOk).padStart(6)}`);
say(`│ tổng số dòng chữ         ${String(stat.dong).padStart(6)}`);
say(`│ trang ra <${TOI_THIEU_DONG} dòng        ${String(stat.trangRong).padStart(6)}`);
say(`╰─ kho chữ: ${KHO_OCR}`);
say(`\nBước tiếp: node scripts/fetch-soundings.mjs --chi-kho  (đọc kho chữ này)`);
