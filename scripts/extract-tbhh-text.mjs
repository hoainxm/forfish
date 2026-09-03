// ĐỌC NỐT KHO PDF — phần CÓ LỚP CHỮ mà `scripts/ocr-soundings.mjs` cố ý bỏ qua.
//
//   node scripts/extract-tbhh-text.mjs            # đọc nốt phần chưa đọc
//   node scripts/extract-tbhh-text.mjs --lai      # đọc lại cả kho
//   node scripts/extract-tbhh-text.mjs --max 50   # thử một nhúm
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// Kho Thông báo hàng hải đã nằm sẵn trên đĩa (ngoài repo): 2.556 PDF, trong đó
// 917 đã có bản chữ trong kho OCR. 1.639 file còn lại KHÔNG phải ảnh scan —
// chúng CÓ lớp chữ, nên `ocr-soundings.mjs` (chỉ lo ảnh scan) bỏ qua đúng như
// thiết kế. Kết quả là chưa ai đọc chúng bằng đường lớp-chữ cả.
//
// Đây là đường rẻ nhất còn lại để lấp báo hiệu miền Nam: KHÔNG một request
// mạng mới, băng thông đã trả rồi. Script này chỉ ĐỌC kho PDF và GHI kho chữ,
// cả hai đều nằm ngoài repo (CLAUDE.md quy tắc 5).
//
// ── KHÔNG SINH DỮ LIỆU BẢN ĐỒ ─────────────────────────────────────────────
// Giống `ocr-soundings.mjs`: file này chỉ biến PDF thành CHỮ rồi cất vào kho.
// Việc hiểu chữ đó thành báo hiệu là của `scripts/generate-vn-aids.mjs`, và
// mọi cổng chặn vẫn là bản DUY NHẤT ở đó. Tách làm hai vì bóc chữ cả kho mất
// vài phút còn sửa bộ đọc bảng thì chạy lại vài giây.
//
// ── KHOÁ KHO PHẢI TRÙNG VỚI KHO OCR ───────────────────────────────────────
// Kho chữ khoá theo `sha1(<địa chỉ CÔNG BỐ>)`, không phải địa chỉ tải về:
//   · vmsa      → sha1(địa chỉ PDF)      = ĐÚNG tên file trong kho `pdf/`
//   · lưu trữ   → sha1(địa chỉ GỐC)      ≠ tên file trong kho `wb/`, vì tên
//                 file ở đó là sha1(địa chỉ Wayback) MANG DẤU THỜI GIAN
// Đặt sai khoá thì `lyLichThongBao()` của generate-vn-aids không tra ra NĂM
// của thông báo, và tin nào không có năm sẽ bị cổng tuổi (10 năm / 3 năm cho
// phao chuyên dùng) coi là 99 tuổi rồi vứt hết. Nên với kho `wb/` phải dựng
// lại bảng sha1(Wayback) → địa chỉ gốc từ chính danh mục CDX đã tải.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ──────────────────────────────────────────────
// Script chạy LÚC PHÁT TRIỂN, không chạy trong app của bà con. Không thêm
// request mạng nào (không có một lời gọi mạng nào trong file này), không đụng
// `public/sw.js`, không đụng khoá `forfish.*`, không đè dữ liệu bà con đã tải.
//
// ## Assumptions
// - Ngưỡng "có lớp chữ" = TỔNG số dòng bóc ra ≥ 5, cùng con số
//   `fetch-soundings.mjs` đang dùng để quyết định "file này là ảnh scan, phải
//   hỏi kho OCR". Một bản duy nhất của ngưỡng, không đẻ con số thứ hai.
// - File đã có bản chữ trong kho OCR thì BỎ QUA: bản OCR đã đi qua bộ gột
//   `ocrLineToNoticeLine` và đang được dùng; ghi đè bằng bản lớp-chữ là đổi
//   dữ liệu dưới chân một đường ống đang chạy. Muốn đọc lại thì `--lai`.
// - Kho chữ lớp-text để RIÊNG (`sdfish-tbhh-text`), không trộn vào kho OCR:
//   hai bộ có chất lượng và cách sai khác nhau, trộn chung là mất khả năng
//   nói "con số này đến từ đường nào".

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { pdfPages } from "./lib/pdf-text.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const LAI = has("lai");
const MAX = Number(arg("max", "0")) || Infinity;

/** Kho PDF — DÙNG CHUNG với `fetch-soundings.mjs` / `ocr-soundings.mjs`. */
const KHO_PDF = arg("kho", join(tmpdir(), "sdfish-soundings-cache"));
/** Kho chữ OCR — chỉ ĐỌC, để biết file nào đã có bản chữ rồi. */
const KHO_OCR = arg("kho-ocr", join(tmpdir(), "sdfish-ocr-cache"));
/** Kho chữ bóc từ LỚP CHỮ — đầu ra của script này. */
const KHO_CHU = arg("kho-chu", join(tmpdir(), "sdfish-tbhh-text"));

/** Tổng số dòng tối thiểu để coi là "PDF có lớp chữ" — xem ## Assumptions. */
const TOI_THIEU_DONG = 5;

const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const say = (...a) => console.log(...a);

/* ── BẢNG sha1(địa chỉ Wayback) → địa chỉ GỐC ─────────────────────────────
 * Dựng từ danh mục CDX đã tải, KHÔNG hỏi mạng. Công thức địa chỉ Wayback phải
 * khớp từng ký tự với `quetWayback()` trong fetch-soundings.mjs, nếu không thì
 * không một file `wb/` nào tra ra tên. */
function bangWayback() {
  const map = new Map();
  const d = join(KHO_PDF, "cdx");
  if (!existsSync(d)) return map;
  for (const f of readdirSync(d)) {
    let rows;
    try {
      rows = JSON.parse(readFileSync(join(d, f), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(rows)) continue;
    for (const r of rows.slice(1)) {
      const ts = r?.[0];
      const org = r?.[1];
      if (typeof org !== "string" || typeof ts !== "string") continue;
      map.set(sha1(`https://web.archive.org/web/${ts}id_/${org}`), org);
    }
  }
  return map;
}

/* ── ĐỌC KHO ──────────────────────────────────────────────────────────────*/

const wbMap = bangWayback();
mkdirSync(KHO_CHU, { recursive: true });

const stat = {
  tong: 0,
  daCoOcr: 0,
  daCoChu: 0,
  khongTraRaDiaChi: 0,
  hongKhongMo: 0,
  anhScan: 0,
  coChu: 0,
  dong: 0,
};
/** Vài ví dụ cho mỗi nhóm — báo cáo không có ví dụ là báo cáo không tra lại được. */
const viDu = { anhScan: [], hong: [], khongTraRa: [] };

for (const loai of ["pdf", "wb"]) {
  const dir = join(KHO_PDF, loai);
  if (!existsSync(dir)) {
    say(`! kho "${loai}" không có ở ${dir}`);
    continue;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".bin"));
  say(`\n── kho ${loai}: ${files.length} file`);
  let n = 0;
  for (const f of files) {
    if (stat.coChu >= MAX) break;
    const ten = f.replace(/[.]bin$/, "");
    stat.tong++;
    // Khoá công bố: vmsa dùng luôn tên file; bản lưu trữ phải tra ngược ra
    // địa chỉ gốc (xem đầu file).
    const congBo = loai === "pdf" ? ten : wbMap.get(ten);
    if (!congBo) {
      // Bản lưu trữ có trong kho mà KHÔNG có trong danh mục CDX đã tải: không
      // dựng được khoá công bố ⇒ generate-vn-aids không tra ra NĂM ⇒ tin bị
      // cổng tuổi vứt. Bỏ ở đây và ĐếM, không bóc rồi để nó chết lặng sau.
      stat.khongTraRaDiaChi++;
      if (viDu.khongTraRa.length < 5) viDu.khongTraRa.push(ten);
      continue;
    }
    const k = loai === "pdf" ? congBo : sha1(congBo);

    if (!LAI && existsSync(join(KHO_OCR, `${k}.dong.json`))) {
      stat.daCoOcr++;
      continue;
    }
    if (!LAI && existsSync(join(KHO_CHU, `${k}.dong.json`))) {
      stat.daCoChu++;
      continue;
    }

    let trang;
    try {
      trang = pdfPages(readFileSync(join(dir, f)));
    } catch (e) {
      stat.hongKhongMo++;
      if (viDu.hong.length < 5) viDu.hong.push(`${loai}/${ten}: ${e.message}`);
      continue;
    }
    const soDong = trang.reduce((a, t) => a + t.length, 0);
    if (soDong < TOI_THIEU_DONG) {
      // KHÔNG phải lỗi: đây là ảnh scan, và đường của nó là `ocr-soundings.mjs`.
      stat.anhScan++;
      if (viDu.anhScan.length < 5) viDu.anhScan.push(`${loai}/${ten} (${soDong} dòng)`);
      continue;
    }
    stat.coChu++;
    stat.dong += soDong;
    writeFileSync(
      join(KHO_CHU, `${k}.dong.json`),
      JSON.stringify({ nguon: "lop-chu", trang }),
      "utf8",
    );
    if (++n % 200 === 0) say(`   … ${n}/${files.length}`);
  }
}

/* ── BÁO CÁO ──────────────────────────────────────────────────────────────*/

say(`\n┌─ ĐỌC KHO PDF BẰNG LỚP CHỮ`);
say(`│ file trong kho              ${String(stat.tong).padStart(6)}`);
say(`│ đã có bản chữ OCR (bỏ qua)  ${String(stat.daCoOcr).padStart(6)}`);
say(`│ đã bóc lần trước (bỏ qua)   ${String(stat.daCoChu).padStart(6)}`);
say(`│ không tra ra địa chỉ gốc    ${String(stat.khongTraRaDiaChi).padStart(6)}`);
say(`│ PDF không mở được           ${String(stat.hongKhongMo).padStart(6)}`);
say(`│ ảnh scan (đường OCR lo)     ${String(stat.anhScan).padStart(6)}`);
say(`│ BÓC ĐƯỢC CHỮ                ${String(stat.coChu).padStart(6)}  → ${stat.dong} dòng`);
say(`└─ kho chữ: ${KHO_CHU}`);
if (viDu.anhScan.length) say(`  ví dụ ảnh scan: ${viDu.anhScan.join(" · ")}`);
if (viDu.hong.length) say(`  ví dụ không mở được: ${viDu.hong.join(" · ")}`);
if (viDu.khongTraRa.length) say(`  ví dụ không tra ra địa chỉ: ${viDu.khongTraRa.join(" · ")}`);
