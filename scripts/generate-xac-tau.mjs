// Sinh LỚP XÁC TÀU + CHƯỚNG NGẠI VẬT từ kho Thông báo hàng hải trên đĩa —
// chạy CÓ CHỦ Ý, KHÔNG một request mạng nào:
//   node scripts/generate-xac-tau.mjs           # đọc kho, ghi public/data/xac-tau.v1.json
//   node scripts/generate-xac-tau.mjs --thu     # chạy thử, KHÔNG ghi file
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// Thước đo `npm run kiem:phu` khung Vũng Tàu: ta vượt Navionics ở số đo sâu
// và báo hiệu, thua đúng MỘT lớp — xác tàu (0 vs 2). Ảnh Navionics vẽ
// "WK 7.8MT": xác tàu kèm ĐỘ SÂU VƯỢT QUA. Với tàu cá đây là thông tin tính
// mạng: lưới quét qua xác tàu là mất lưới, đêm tối chạy qua xác cạn là thủng
// vỏ. Lớp `reef-hazard` hiện có vài chấm wreck từ OSM nhưng OSM chưa từng
// theo dõi biển VN (42/42 điểm wreck nằm ở Hồng Kông – Trung Quốc – Malaysia,
// 0 điểm ở dải bờ VN) — muốn có thật thì phải đọc nguồn thật sự quản lý
// chúng: Thông báo hàng hải của các Cảng vụ / Tổng công ty BĐATHH.
//
// ── NGUỒN: HAI HỌ VĂN BẢN TRONG CÙNG KHO CHỮ (ngoài repo) ─────────────────
//   (a) THÔNG BÁO HÀNG HẢI của Cảng vụ/TCTBĐATHH: "Về chướng ngại vật nguy
//       hiểm mới phát hiện: xác tàu Việt Anh 26" — kèm bảng toạ độ VN-2000 +
//       WGS-84; và tin GỠ: "hoàn thành trục vớt…", "đã được khắc phục",
//       "không còn tồn tại" (thường dẫn chiếu số hiệu tin cũ).
//   (b) THÔNG BÁO NGƯỜI ĐI BIỂN (hiệu chỉnh hải đồ, song ngữ): dòng
//       "Chèn Wk VL-11311 10°38'50.5"N 106°45'42.4"E" / "Xóa Wk …" — mỗi dòng
//       là một SỰ KIỆN chèn/xoá ký hiệu xác tàu trên hải đồ nhà nước.
//
// XÁC TÀU LÀ SỰ KIỆN, không phải sổ đăng ký: tin sau có thể "đã trục vớt".
// Nên phải xếp theo thời gian rồi để bản GỠ xoá mục — cùng khuôn LẬP/GỠ của
// `generate-vn-aids.mjs` (nguồn B). Gộp "gỡ" vào "giữ" là vẽ một xác tàu đã
// trục vớt; bỏ sót bản gỡ thì bà con tránh một chỗ không còn gì — lỗi thứ
// nhất tệ hơn (mất lòng tin cả lớp), nên bản GỠ khớp tên/số hiệu được áp
// KHÔNG CẦN NGÀY (văn bản gỡ theo định nghĩa ra sau văn bản lập).
//
// ── BỘ ĐỌC TOẠ ĐỘ: CÙNG LUẬT VỚI generate-vn-aids.mjs ─────────────────────
// Các hàm capToaDo/cachDocDo dưới đây theo ĐÚNG luật của bản trong
// `generate-vn-aids.mjs` (bắt buộc dấu độ thật; nhóm ĐỘ hở trái thì liệt kê
// mọi cách đọc và chỉ nhận khi có đúng MỘT cặp trong khung biển VN). Không
// import được vì file đó thuộc nhóm khác đang giữ (không sửa để export) —
// bản này là bản CHÉP CÓ GHI CHÚ, test so hành vi hai bản qua các ca bẫy đã
// thành án lệ (toạ độ tách chữ, cột tên thành số, hai hệ datum lệch).
//
// ⚠️ GIẤY PHÉP: văn bản hành chính nhà nước VN — Điều 15 Luật SHTT, giấy phép
// `vn-official` đã đăng ký trong `src/lib/provenance.ts` (nguồn `tbhh`).
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ──────────────────────────────────────────────
// Script chạy LÚC PHÁT TRIỂN. Không request mạng, không đụng sw.js, không
// đụng khoá forfish.*. File đầu ra là asset tĩnh — Lead nối lớp + precache.

import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const argOf = (ten, mac) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
};
const THU = process.argv.includes("--thu");
const CHO_PHEP_GIAM = process.argv.includes("--cho-phep-giam");

/** Kho chữ — DÙNG CHUNG với generate-vn-aids.mjs, chỉ ĐỌC. */
const KHO_OCR = argOf("kho-ocr", join(tmpdir(), "sdfish-ocr-cache"));
const KHO_CHU = argOf("kho-chu", join(tmpdir(), "sdfish-tbhh-text"));
const KHO_TBHH = argOf("kho-tbhh", join(tmpdir(), "sdfish-soundings-cache"));
/** Kho bản tin chỉnh lý hải đồ giấy hằng tuần (OCR sẵn, ngoài repo) — nguồn (c). */
const KHO_BANTIN = argOf("kho-ban-tin", join(tmpdir(), "sdfish-ban-tin-tuan"));

/** Khung biển VN (Nam, Tây, Bắc, Đông) — GIỐNG generate-vn-aids.mjs. */
const VN_BBOX = [4.0, 102.0, 24.0, 118.0];
const ROUND = 5; // ~1 m
const BUDGET_KB = 40;
/** Tuổi tối đa của tin LẬP còn giữ (năm) — cùng trần 10 năm của vn-aids. */
const TUOI_TOI_DA = 10;
/** Bản GỠ khớp theo TOẠ ĐỘ (không tên, không số hiệu) chỉ với ngưỡng hẹp. */
const GO_THEO_CHO_KM = 0.5;
/** Hai hệ toạ độ của CÙNG một điểm lệch ~200 m; quá ngưỡng là dòng loạn. */
const LECH_HE_KM = 2;

const FETCHED_AT = new Date().toISOString().slice(0, 10);
const NAM_NAY = Number(FETCHED_AT.slice(0, 4));

const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const r = (v) => Number(v.toFixed(ROUND));
const RAD = (d) => (d * Math.PI) / 180;
export function kmGiua(aLon, aLat, bLon, bLat) {
  const dLat = RAD(bLat - aLat);
  const dLon = RAD(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(RAD(aLat)) * Math.cos(RAD(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Bỏ MỌI khoảng trắng + thường hoá — kho lớp-chữ chẻ "chư ớ ng ng ạ i". */
export const nen = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

/* ══ BỘ ĐỌC TOẠ ĐỘ — cùng luật với generate-vn-aids.mjs (xem đầu file) ═════ */

const SO3 = String.raw`(\d(?:[ \t]{0,2}\d){0,2})`;
const SO2 = String.raw`(\d(?:[ \t]{0,2}\d)?)`;
const SO_GIAY = String.raw`(\d(?:[ \t]{0,2}\d)?(?:[ \t]*[.,][ \t]*\d(?:[ \t]{0,2}\d)?)?)?`;
const DAU_DO = String.raw`[ \t]*°[ \t]*`;
const DAU_PHUT = String.raw`[ \t]*['’][ \t]*`;
const DAU_GIAY = String.raw`[ \t]*(?:["”″]|''|’’|′′)?`;

/** MỘT CẶP toạ độ độ-phút-giây — BẮT BUỘC dấu độ THẬT (`°`). */
const PAIR = new RegExp(
  SO3 + DAU_DO + SO2 + DAU_PHUT + SO_GIAY + DAU_GIAY + String.raw`[ \t]*[Nn]?[\s,;]*` +
    SO3 + DAU_DO + SO2 + DAU_PHUT + SO_GIAY + DAU_GIAY + String.raw`[ \t]*[Ee]?`,
  "g",
);

const gopSo = (raw) => String(raw ?? "").replace(/[ \t]+/g, "");
const toNum = (s) => Number(String(s).replace(",", "."));

/** Mọi cách đọc của nhóm ĐỘ (chữ số có thể bị chẻ), kèm vị trí bắt đầu. */
export function cachDocDo(raw) {
  const s = String(raw ?? "");
  const out = [];
  const thay = new Set();
  for (const m of [...s.matchAll(/\d/g)]) {
    const i = m.index;
    if (i > 0 && /\d/.test(s[i - 1])) continue;
    const n = Number(s.slice(i).replace(/[ \t]+/g, ""));
    if (!Number.isFinite(n) || thay.has(n)) continue;
    thay.add(n);
    out.push({ val: n, off: i });
  }
  return out;
}

/**
 * PHÚT LẺ THẬP PHÂN — khuôn của Thông báo người đi biển: "10°19.314' N
 * 107°02.494' E" (KHÔNG có giây). Dấu chấm nằm TRONG nhóm phút trước dấu
 * phút, nên không lẫn với khuôn độ-phút-giây được. Nhóm phút bắt buộc có
 * phần lẻ — "10°19'" trơn thuộc khuôn DMS, không rơi vào đây.
 */
const SO_PHUT_LE = String.raw`(\d(?:[ \t]{0,2}\d)?[ \t]*[.,][ \t]*\d(?:[ \t]{0,2}\d){0,2})`;
const PAIR_PHUT_LE = new RegExp(
  SO3 + DAU_DO + SO_PHUT_LE + DAU_PHUT + String.raw`[Nn]?[\s,;]*` +
    SO3 + DAU_DO + SO_PHUT_LE + DAU_PHUT + String.raw`[Ee]?`,
  "g",
);

/**
 * Mọi cặp toạ độ HỢP LỆ trên một dòng (độ-phút-giây HOẶC độ-phút lẻ), kèm vị
 * trí ký tự bắt đầu. ≥2 cách đọc cùng rơi vào khung ⇒ MẬP MỜ: bỏ hàng,
 * không đoán.
 */
export function capToaDo(dong, log) {
  const out = [];
  const [S, W, N, E] = VN_BBOX;
  PAIR.lastIndex = 0;
  let m;
  while ((m = PAIR.exec(dong))) {
    const p = Number(gopSo(m[2]));
    const g = m[3] ? toNum(gopSo(m[3])) : 0;
    const p2 = Number(gopSo(m[5]));
    const g2 = m[6] ? toNum(gopSo(m[6])) : 0;
    if (!(p < 60) || !(g < 60) || !(p2 < 60) || !(g2 < 60)) continue;
    const hop = [];
    for (const dLat of cachDocDo(m[1])) {
      for (const dLon of cachDocDo(m[4])) {
        const lat = dLat.val + p / 60 + g / 3600;
        const lon = dLon.val + p2 / 60 + g2 / 3600;
        if (lat < S || lat > N || lon < W || lon > E) continue;
        hop.push({ lon, lat, at: m.index + dLat.off });
      }
    }
    if (hop.length > 1) {
      if (log) log.mapMo++;
      continue;
    }
    if (!hop.length) continue;
    out.push(hop[0]);
  }
  PAIR_PHUT_LE.lastIndex = 0;
  while ((m = PAIR_PHUT_LE.exec(dong))) {
    const p = toNum(gopSo(m[2]));
    const p2 = toNum(gopSo(m[4]));
    if (!(p < 60) || !(p2 < 60)) continue;
    const hop = [];
    for (const dLat of cachDocDo(m[1])) {
      for (const dLon of cachDocDo(m[3])) {
        const lat = dLat.val + p / 60;
        const lon = dLon.val + p2 / 60;
        if (lat < S || lat > N || lon < W || lon > E) continue;
        hop.push({ lon, lat, at: m.index + dLat.off });
      }
    }
    if (hop.length > 1) {
      if (log) log.mapMo++;
      continue;
    }
    if (!hop.length) continue;
    out.push(hop[0]);
  }
  return out;
}

/**
 * ĐƯỜNG LÙI cho khuôn vỡ cột của kho lớp-chữ: dấu `°` bị đẩy lên một DÒNG
 * RIÊNG, dòng số chỉ còn `11 03'52.7" 108 56'50.6"` (đã thấy thật ở tin tàu cá
 * BĐ-83019 TS). Chỉ nhận khi ĐỦ dấu phút VÀ giây (hai mỏ neo thật), và độ
 * đứng TÁCH RIÊNG bằng khoảng trắng — cùng tinh thần "còn hai cách đọc thì
 * bỏ": khuôn này chỉ có đúng một cách đọc vì phút/giây đã bị kẹp giữa dấu.
 */
const PAIR_KHONG_DO = new RegExp(
  String.raw`(\d{1,2})[ \t]+` + SO2 + DAU_PHUT + SO_GIAY + String.raw`(?:["”″]|''|’’)` +
    String.raw`[ \t]*[Nn]?[\s,;]*` +
    String.raw`(\d{2,3})[ \t]+` + SO2 + DAU_PHUT + SO_GIAY + String.raw`(?:["”″]|''|’’)` +
    String.raw`[ \t]*[Ee]?`,
  "g",
);
export function capToaDoKhongDo(dong) {
  const out = [];
  PAIR_KHONG_DO.lastIndex = 0;
  let m;
  while ((m = PAIR_KHONG_DO.exec(dong))) {
    const [S, W, N, E] = VN_BBOX;
    const lat = Number(m[1]) + Number(gopSo(m[2])) / 60 + (m[3] ? toNum(gopSo(m[3])) : 0) / 3600;
    const lon = Number(m[4]) + Number(gopSo(m[5])) / 60 + (m[6] ? toNum(gopSo(m[6])) : 0) / 3600;
    if (lat < S || lat > N || lon < W || lon > E) continue;
    out.push({ lon, lat, at: m.index });
  }
  return out;
}

/* ══ PHÂN LOẠI TIN ════════════════════════════════════════════════════════ */

/**
 * Việc mà một thông báo xác tàu/chướng ngại làm. THỨ TỰ CÓ Ý NGHĨA: tin
 * "hoàn thành trục vớt xác tàu X" chứa cả hai cụm — xét GỠ trước.
 * Trả null cho tin không thuộc lớp này (độ sâu luồng, phao, khu neo…).
 */
export function viecCuaTin(dau) {
  const s = nen(dau);
  // GỠ: nguồn tuyên bố vật không còn.
  if (
    /ho[àa]nth[àa]nh(?:vi[êệ]c)?(?:c[ôo]ngt[áa]c)?tr[ụu]cv[óớo]t|ho[àa]nth[àa]nhthanhth[ảa]i|đ[ãa]đ[ưu][ơợ]ckh[ắăa]cph[ụu]c|kh[ôo]ngc[òo]nt[ồo]nt[ạa][ịi]|đ[ãa]đ[ưu][ơợ]ctr[ụu]cv[óớo]t/.test(s)
  )
    return "GỠ";
  // LẬP: chướng ngại vật / xác tàu / phương tiện chìm-đắm-mắc cạn.
  if (
    /ch[ưứ][ơớo]ngng[ạa][ịỉi]?v[ậa]t|x[áa]ct[àa]u|v[ậa]tth[êể]ch[ìi]m|b[ịi][_\s]?ch[ìi]m|t[àa]uch[ìi]m|s[àa]lanch[ìi]m|m[ắăa]cc[ạa]n|t[àa]uđ[ắăa]m/.test(s)
  )
    return "LẬP";
  return null;
}

/**
 * Loại đối tượng — đúng ba giá trị của khuôn dữ liệu. Câu tiêu đề nào nói
 * tới tàu/sà lan/phương tiện chìm-đắm thì là xác tàu; "vật thể chìm" giữ
 * riêng (bà con cần biết đó KHÔNG phải một con tàu tra được số hiệu);
 * còn lại là chướng ngại vật (đá ngầm, container, cọc, phương tiện mắc cạn).
 */
export function loaiCuaTin(dau) {
  const s = nen(dau);
  if (/x[áa]ct[àa]u|t[àa]u.{0,40}?(?:b[ịi][_\s]?)?ch[ìi]m|t[àa]uđ[ắăa]m|s[àa]lan.{0,25}?ch[ìi]m|ph[ưu][ơo]ngti[êệ]n.{0,30}?(?:ch[ìi]m|đ[ắăa]m)/.test(s))
    return "xac-tau";
  if (/v[ậa]tth[êể]ch[ìi]m/.test(s)) return "vat-chim";
  return "chuong-ngai";
}

/** Vật TRÔI (container trôi nổi, "chưa xác định được vị trí") — KHÔNG vẽ:
 *  một chấm đứng yên cho một vật đang trôi là lời hứa sai chỗ. */
export function laVatTroi(toanVan) {
  return /tr[ôo][ịi]?n[ổỗo][ịi]|tr[ôo][ịi]?d[ạa]t|ch[ưu]ax[áa]cđ[ịi]nhđ[ưu][ơợ]cv[ịi]tr[íi]/.test(nen(toanVan));
}

/**
 * TÊN/SỐ HIỆU phương tiện từ câu tiêu đề — là ĐỊNH DANH để bản GỠ tìm lại
 * đúng mục, và để bà con tra ngược. Không đọc ra thì trả null, KHÔNG bịa.
 *
 * Ưu tiên cụm "số hiệu XX-NNNN" (chuẩn đăng ký phương tiện); rồi tới cụm
 * đứng sau từ khoá loại tàu, cắt tại động từ ("bị", "chìm", "đắm", "tại"…).
 * BẪY cột-tên-thành-số (án lệ `BL.1` → 81,1 m) chạy ngược ở đây: mảnh toạ độ
 * trôi vào tên — nên tên phải còn chữ cái hoặc khuôn số hiệu thật.
 */
/**
 * Kho lớp-chữ chẻ từ có dấu thành từng ký tự ("Đ ạ i H ả i Phát", "b ị
 * chìm") — dán ký tự THƯỜNG đơn lẻ vào từ đứng trước, lặp tới khi hết.
 * Chữ hoa đơn lẻ không dán (số hiệu thật "SG 7190" phải giữ nguyên khe).
 */
function danChuLe(chuoi) {
  let s = String(chuoi).replace(/\s+/g, " ");
  let truoc;
  do {
    truoc = s;
    s = s.replace(/(\p{L}) ([\p{Ll}])(?= |$)/gu, "$1$2");
  } while (s !== truoc);
  return s;
}

export function tenPhuongTien(dau) {
  const s = danChuLe(dau);
  let m =
    /s[ốô] hi[êệ]u[:\s]+([A-ZĐ]{1,4}[-\s]?\d{2,6}(?:[-\s]?[A-ZĐ]{1,3})?)/iu.exec(s) ??
    /bi[êể]n ki[êể]m so[áa]t[:\s]+([A-ZĐ]{1,4}[-\s]?\d{2,6}(?:[-\s]?[A-ZĐ]{1,3})?)/iu.exec(s);
  if (m) return chuanTen(m[1]);
  m =
    /(?:x[áa]c t[àa]u|t[àa]u c[áa]|t[àa]u k[ée]o|t[àa]u h[úu]t c[áa]t|s[àa] lan|ph[ưu][ơo]ng ti[êệ]n(?: th[uủ][yỷ])?|t[àa]u)\s+((?:[A-ZĐÀ-Ỹ][\w.À-ỹ-]*|\d[\w.-]*)(?:\s+(?:[A-ZĐÀ-Ỹ][\w.À-ỹ-]*|\d[\w.-]*|-)){0,4})/u.exec(
      s,
    );
  if (!m) return null;
  // Cắt tại động từ/giới từ nếu chúng lọt vào đuôi cụm bắt được.
  let ten = m[1]
    .replace(
      /\s+(?:b[ịi]|ch[ìi]m|đ[ắăa]m|m[ắăa]c|t[ạa]i|tr[êe]n|kh[ôo]ng|đ[ãa]|v[àa]|c[óo]|S[ôo]ng|Lu[ồô]ng)\b.*$/iu,
      "",
    )
    .trim();
  return chuanTen(ten);
}

function chuanTen(ten) {
  let s = danChuLe(String(ten ?? "").replace(/["“”'’()]/g, " ")).trim();
  s = s.replace(/\.docx?$/i, ""); // tên file .doc ở chân trang lẻn vào
  s = s.replace(/\s*-\s*/g, "-"); // "BĐ - 83019" → "BĐ-83019"
  s = s.replace(/\s+\p{Ll}$/u, ""); // "HP-3605 b" — mẩu "bị" OCR bỏ rơi
  s = s.replace(/[.,;:-]+$/, "");
  if (!s || s.length < 2 || s.length > 30) return null;
  if (/[°′″]/.test(s)) return null; // mảnh toạ độ
  if (/TBHH|CVHH/i.test(s)) return null; // số hiệu THÔNG BÁO lẻn vào cột tên
  if (/^\d{1,3}$/.test(s)) return null; // 1–3 chữ số trơn = mảnh toạ độ/số trang
  if (/\d{5,}/.test(s) && !/[A-ZĐ]/i.test(s.replace(/\d/g, ""))) return null; // chuỗi số dài trơ trọi
  // Phải có chữ số (số hiệu/số thân) hoặc ít nhất hai chữ viết hoa (tên riêng).
  if (!/\d/.test(s) && (s.match(/\p{Lu}/gu) ?? []).length < 2) return null;
  // Từ mô tả tràn vào — không phải định danh.
  if (/nguy hi[êể]m|m[ơớ]i ph[áa]t|v[ùu]ng bi[êể]n|khu v[ựư]c/iu.test(s)) return null;
  return s;
}

/** Khoá so khớp tên: bỏ dấu cách/gạch/chấm, viết hoa — "TG - 14319" ≡ "TG-14319". */
export const khoaTen = (ten) =>
  String(ten ?? "")
    .toUpperCase()
    .replace(/[\s.·–—-]+/g, "");

/**
 * ĐỘ SÂU VƯỢT QUA (mét, số 0 hải đồ) — CHỈ khi nguồn nói thẳng đó là điểm
 * cạn nhất trên vật ("điểm cạn nhất trên xác tàu … có độ sâu 6,8 m") hoặc
 * "độ sâu vượt qua". "Nằm ở độ sâu khoảng 40 m" là ĐỘ SÂU NƠI VẬT NẰM, không
 * phải nước còn lại bên trên — ghi nhầm là hứa một con số nguồn không hứa.
 */
export function docDoSauVuotQua(toanVan) {
  const s = String(toanVan).replace(/\s+/g, " ");
  const m =
    /đi[êể]m c[ạa]n nh[âấ]t[^.]{0,80}?đ[ộô] s[âa]u[^\d]{0,12}(\d{1,2}(?:[.,]\d{1,2})?)\s*m/iu.exec(s) ??
    /đ[ộô] s[âa]u v[ưu][ơợ]t qua[^\d]{0,12}(\d{1,2}(?:[.,]\d{1,2})?)\s*m/iu.exec(s);
  if (!m) return null;
  const v = toNum(m[1]);
  return Number.isFinite(v) && v > 0 && v < 100 ? v : null;
}

/** BÁN KÍNH CẤM (mét) quanh vật — chỉ khi có chữ "bán kính" đi kèm số. */
export function docBanKinh(toanVan) {
  const s = String(toanVan).replace(/\s+/g, " ");
  const m = /b[áa]n k[íi]nh[^\d]{0,20}(\d{1,4}(?:[.,]\d{1,2})?)\s*(m(?:[ée]t)?\b|h[ảa]i l[ýy]|km)/iu.exec(s);
  if (!m) return null;
  let v = toNum(m[1]);
  const dv = m[2].toLowerCase();
  if (/h[ảa]i/.test(dv)) v *= 1852;
  else if (dv === "km") v *= 1000;
  v = Math.round(v);
  return v > 0 && v <= 5000 ? v : null;
}

/** Số hiệu thông báo bị DẪN CHIẾU trong bản GỠ ("Thông báo … số 159/TBHH-X …
 *  hết hiệu lực") — đường về đúng mục cần xoá khi tên không đọc ra. */
export function soDanChieu(toanVan) {
  const out = [];
  const s = String(toanVan).replace(/\s+/g, " ");
  for (const m of s.matchAll(/s[ốô]\s*:?\s*(\d{1,5})\s*\/?\s*TBHH\s*[-–—]\s*([A-ZĐ]{2,20})/giu)) {
    out.push(`${m[1]}/TBHH-${m[2].toUpperCase()}`);
  }
  return [...new Set(out)];
}

/* ══ THÔNG BÁO NGƯỜI ĐI BIỂN — dòng Chèn/Xóa Wk ═══════════════════════════ */

/**
 * Một dòng sự kiện hải đồ: "Chèn Wk VL-11311 10°38'50.5"N 106°45'42.4"E".
 * `wkGan` = dòng này hoặc 1–2 dòng kề sau có mã "Wk" đứng riêng (khuôn PDF
 * hay đẩy ký hiệu xuống dòng). KHÔNG nhận "Chèn Độ sâu…", "Chèn Cọc…", phao —
 * các lớp đó thuộc đường ống khác (soundings / vn-aids).
 */
export function docDongNtM(dong, wkGan) {
  // ÉP về một-khoảng-trắng TRƯỚC rồi mới đọc toạ độ: `cap.at` là chỉ số ký tự
  // trong chuỗi đã đọc — đọc trên bản thô rồi cắt tên trên bản ép là lệch chỉ
  // số mỗi khi dòng gốc có hai khoảng trắng liền nhau.
  const s = String(dong).trim().replace(/\s+/g, " ");
  const m = /^(Ch[èe]n|X[óo][aá])\b\s*(Wk\b)?\s*(.*)$/iu.exec(s);
  if (!m) return null;
  const viec = /^ch/i.test(m[1]) ? "LẬP" : "GỠ";
  const laWk = Boolean(m[2]) || /\bWk\b/.test(s) || wkGan === true;
  if (!laWk) return null;
  if (/đ[ộô]\s*s[âa]u|c[ọo]c|phao|ti[êe]u/iu.test(m[3])) return null;
  const caps = capToaDo(s);
  if (!caps.length) return null;
  const cap = caps[0];
  const ten = chuanTen(s.slice(m[1].length + (m[2] ? 4 : 0), cap.at).replace(/\bWk\b/g, " "));
  return { viec, ten, lon: cap.lon, lat: cap.lat };
}

/**
 * XÁC TÀU NEO THEO PHAO — trường hợp tin "thông số kỹ thuật luồng" tả một
 * xác tàu KHÔNG kèm toạ độ mà kèm mốc phao: "Tại khu vực thượng lưu phao số 5
 * khoảng 10m tồn tại chướng ngại vật là xác tàu QNg 98087 TS đắm … điểm cạn
 * nhất trên xác tàu đắm có độ sâu 6.8m" (luồng Cửa Gianh). Đây là mục DUY
 * NHẤT trong kho mang độ sâu vượt qua thật — đúng con số "WK 7.8MT" mà
 * Navionics vẽ được còn ta thì thiếu. Vị trí lấy THEO PHAO trong
 * `vn-aids.v1.json` (cùng nguồn nhà nước): độ lệch 10–20 m nhỏ hơn hẳn việc
 * mất cả xác tàu; tin nào dùng đường này đều mang ghi chú "vị trí theo phao"
 * trong `notices[].ghi` — không hứa hơn cái nguồn hứa.
 */
export function docXacTauTheoPhao(toanVan) {
  const s = danChuLe(toanVan);
  const n = nen(toanVan);
  if (!/t[ồo]nt[ạa][ịi]ch[ưứ][ơớo]ngng[ạa][ịi]v[ậa]tl[àa](?:x[áa]c)?t[àa]u/.test(n)) return null;
  // Tên luồng đọc trên bản CÒN XUỐNG DÒNG — bản một-dòng làm [^\n] nuốt cả câu.
  const luong = (/T[êe]n lu[ồô]ng\s*:?\s*([^\n]{3,60})/iu.exec(toanVan)?.[1] ?? "")
    .replace(/C[ăa]n c[ứu].*$/iu, "")
    .replace(/[.,;:\s]+$/, "")
    .trim();
  /* Mốc phao phải là cái NEO SÁT câu "tồn tại chướng ngại vật" — văn bản còn
     mấy câu "phao số 9 khoảng 70m" khác (mô tả đoạn luồng), vớ câu đầu tiên
     là neo xác tàu vào nhầm phao. OCR hay đọc chữ số thành chữ cái
     ("khoảnglOm") nên nhóm khoảng-cách chịu cả l/O/i. */
  const phao = /phaos[ốô](\d{1,2})kho[ảa]ng([\dloi]{1,4})mt[ồo]nt[ạa][ịi]/iu.exec(n);
  const ten = tenPhuongTien(
    /ch[ưứ][ơớo]ng ng[ạa][ịi] v[ậa]t l[àa][^.]{0,80}/iu.exec(s)?.[0] ?? "",
  );
  /* Độ sâu phải neo vào câu "trên xác tàu": tin thông số Cửa Gianh tả HAI vật
     — xác tàu (6,8 m) VÀ một chướng ngại vật (1,1 m) — trong hai câu "điểm
     cạn nhất" khác nhau. Vớ câu đầu tiên của cả văn bản là dán độ sâu của
     vật này lên vật kia (đã dính thật 2026-09-02, bản tin chỉnh lý hải đồ
     40/2025 vẽ hai ký hiệu riêng Wk + Obstn mới lộ ra). */
  const mDs = /đi[êể]m c[ạa]n nh[âấ]t tr[êe]n x[áa]c t[àa]u[^\d]{0,40}?(\d{1,2}(?:[.,]\d{1,2})?)\s*m/iu.exec(s);
  const doSau = mDs ? toNum(mDs[1]) : null;
  if (!luong || !phao || !ten) return null;
  const cachM = Number(phao[2].replace(/[lI]/gi, "1").replace(/o/gi, "0"));
  return { ten, luong, phaoSo: Number(phao[1]), cachM, doSau };
}

/** Trung vị của một mảng số. */
const trungVi = (arr) => [...arr].sort((a, b) => a - b)[arr.length >> 1];

/**
 * Vị trí đại diện của một tin từ các hàng toạ độ đã đọc — xem chú thích tại
 * chỗ gọi. Trả null khi không còn hàng nào đứng vững.
 */
export function chonViTri(caps, log) {
  if (!caps.length) return null;
  /* ≤2 hàng: lấy hàng ĐẦU — bảng toạ độ chính đứng trước phần chân trang, và
     hai hàng thì "trung vị" chỉ là bốc thăm giữa hai hàng (đã đo: tin dải đá
     ngầm Phú Quốc bị kéo 52 km về một mảnh số lạc ở cuối văn bản). */
  if (caps.length <= 2) return caps[0];
  const mLon = trungVi(caps.map((c) => c.lon));
  const mLat = trungVi(caps.map((c) => c.lat));
  const gan = caps.filter((c) => kmGiua(mLon, mLat, c.lon, c.lat) <= 60);
  if (!gan.length) return null;
  if (gan.length < caps.length && log) log.xaCum += caps.length - gan.length;
  return { lon: trungVi(gan.map((c) => c.lon)), lat: trungVi(gan.map((c) => c.lat)) };
}

/* ══ NGUỒN (c): BẢN TIN CHỈNH LÝ HẢI ĐỒ GIẤY HẰNG TUẦN (vmsa.vn) ═══════════
 *
 * 160 bản tin 2024–2026, khuôn Notices to Mariners song ngữ, đã OCR sẵn ở kho
 * NGOÀI repo (`--kho-ban-tin`, mặc định <tmp>/sdfish-ban-tin-tuan — mỗi file
 * một tuần, {dpi, trang:[[{t,x,y}]]}). Kho vắng thì nguồn (c) bỏ qua.
 *
 * Toạ độ bản tin là ĐỘ + PHÚT THẬP PHÂN (`17°56.19'`) — KHÁC khuôn
 * độ-phút-giây của bảng TBHH. Bộ tách `ddmCandidates`/`coordsInLine` dưới đây
 * CHÉP NGUYÊN từ bộ của teammate bản tin tuần (phan-tich.mjs, ngoài repo) —
 * không viết bản thứ hai; chép vào đây vì thư mục tạm của phiên không sống
 * qua máy khác, còn luật tách thì phải đi cùng script sinh. Ba dạng OCR thật
 * đã gặp: `17056.19'1` (ký tự độ thành 0/9 + chữ số nhiễu dính sau dấu phút)
 * · `107902.395` (RỚT dấu phút) · `18947.83N` (chữ bán cầu). Mỗi cụm số chỉ
 * nhận cách tách DUY NHẤT rơi vào khung biển VN — hai cách trở lên thì bỏ.
 */
function ddmCandidates(run, frac) {
  const out = [];
  const [S, W, N, E] = VN_BBOX;
  for (const nDeg of [2, 3]) {
    const nJunk = run.length - nDeg - 2;
    if (nJunk < 0 || nJunk > 2) continue;
    const deg = Number(run.slice(0, nDeg));
    const min = Number(run.slice(nDeg + nJunk)) + Number(`0.${frac}`);
    if (!Number.isFinite(deg) || min >= 60) continue;
    const v = deg + min / 60;
    if (nDeg === 2 && v >= S && v <= N) out.push({ kind: "lat", v });
    if (nDeg === 3 && v >= W && v <= E) out.push({ kind: "lon", v });
  }
  return out;
}
const BT_TOK = /(?<![\d.])(\d{4,7})[.](\d{1,2})(?:\s*['’′´]\d{0,2}|\s*([NSEW])|\d?(?=[\s,;)]|$))/g;
export function coordsInLine(line) {
  BT_TOK.lastIndex = 0;
  const toks = [];
  let m;
  while ((m = BT_TOK.exec(line)) !== null) {
    let c = ddmCandidates(m[1], m[2]);
    if (m[3]) c = c.filter((x) => (m[3] === "N" || m[3] === "S" ? x.kind === "lat" : x.kind === "lon"));
    toks.push(c);
  }
  const pairs = [];
  for (let i = 0; i + 1 < toks.length; i += 2) {
    const las = toks[i].filter((c) => c.kind === "lat");
    const los = toks[i + 1].filter((c) => c.kind === "lon");
    if (las.length === 1 && los.length === 1) pairs.push({ lat: las[0].v, lon: los[0].v });
  }
  return pairs;
}

/** Dựng DÒNG từ mảnh OCR — cùng thuật toán `manhToDong` của kho bản tin. */
function banTinDong(d) {
  const cao = (297 / 25.4) * (d.dpi || 300);
  const buoc = Math.max(6, cao / 220);
  return (d.trang ?? []).flatMap((trang) => {
    const hang = new Map();
    for (const it of trang) {
      const k = Math.round(it.y / buoc);
      if (!hang.has(k)) hang.set(k, []);
      hang.get(k).push(it);
    }
    return [...hang.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, r]) => r.sort((a, b) => a.x - b.x).map((i) => i.t).join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  });
}

/** Dòng tiêu đề mục bản tin: `NNN(T)?/YYYY VIET NAM …`. */
const BT_HDR = /^\s*(\d{1,3})\s*(\(?[PT1lI]\)?)?\s*[\/l]\s*(202\d)\b/;

/**
 * Đọc kho bản tin → sự kiện LẬP/GỠ cho lớp này.
 *
 * Luật rà (đúng các ca đã rà tay 2026-09-02):
 * - chỉ mục có tiêu đề Wreck/Tàu đắm/Obstruction/Chướng ngại; các dòng
 *   Replace/Thay độ sâu thuộc đường ống soundings — bỏ;
 * - động từ có thể đứng dòng TRÊN dòng toạ độ ("Insert Obstn" ↵ "17°42.52'…")
 *   — nhớ động từ trong 2 dòng;
 * - mỗi mục in HAI NỬA Anh + Việt: khử trùng theo (việc, ô ~10 m);
 * - CÙNG một vị trí trong CÙNG mục mà nửa Anh nói Delete, nửa Việt nói Chèn
 *   (đã gặp thật: 106/2025 Cửa Gianh) ⇒ MÂU THUẪN OCR: bỏ cả hai chiều, đếm
 *   — không bốc thăm chuyện một chướng ngại còn hay mất;
 * - "Replace Wk with Wk" là cập nhật ký hiệu sẵn có — đếm làm đối chứng,
 *   không đẻ mục mới (không có tên, không rõ vật nào).
 */
export function docBanTin(lines, tenFile, log) {
  const out = [];
  let muc = null; // { id, loai, so, nam }
  let viecGan = null; // động từ thấy gần nhất (giữ 2 dòng)
  let viecTuoi = 0;
  const thayViec = (v) => {
    viecGan = v;
    viecTuoi = 0;
  };
  for (const dong of lines) {
    const h = BT_HDR.exec(dong);
    if (h && /VI[ỆE]?T\s*NAM/i.test(dong)) {
      const nhan = nen(dong);
      let loai = null;
      if (/wreck|t[àa]uđ[ắăa]m|x[áa]ct[àa]u|ch[ìi]m/.test(nhan)) loai = "xac-tau";
      else if (/obstruction|obstn|ch[ưứ][ơớo]ngng[ạa][ịi]/.test(nhan)) loai = "chuong-ngai";
      muc = { id: `${h[1]}/${h[3]}`, loai, so: "", nam: Number(h[3]) };
      viecGan = null;
      continue;
    }
    if (!muc) continue;
    // Tiêu đề hay gãy dòng ("… HAI PHONG" ↵ "Wreck."): dòng NGẮN ngay sau
    // header vẫn được xét loại.
    if (!muc.loai && nen(dong).length <= 40) {
      const nhan = nen(dong);
      if (/wreck|t[àa]uđ[ắăa]m|x[áa]ct[àa]u/.test(nhan)) muc.loai = "xac-tau";
      else if (/obstruction|obstn|ch[ưứ][ơớo]ngng[ạa][ịi]/.test(nhan)) muc.loai = "chuong-ngai";
    }
    if (!muc.so) {
      const tm = /(\d{1,4})(?:\s*\/\s*20\d{2})?\s*\/\s*TBHH[\s_-]*([A-ZĐ]{2,15})/iu.exec(dong);
      if (tm) muc.so = `${tm[1]}/TBHH-${tm[2].toUpperCase()}`;
    }
    if (!muc.loai) continue;

    const ep = nen(dong);
    // Dòng độ sâu (Replace depth/Thay độ sâu) → của soundings, không của lớp này.
    const laDoSau = /depth|đ[ộô]s[âa]u|độsâu|sâu,/.test(ep);
    if (/delete|xo[áa]/.test(ep) && !laDoSau) thayViec("GỠ");
    else if (/insert|ch[èe]n/.test(ep) && !laDoSau) thayViec("LẬP");
    else if (/move|d[ờo]i(?!.*bi[êể]n)|chuy[ểê]nt[ơớ]i/.test(ep) && !laDoSau) thayViec("DỜI");
    if (/wreckexists|t[àa]uđ[ắăa]mđ[ưu][ơợ]cx[áa]cđ[ịi]nh/.test(ep)) thayViec("LẬP");
    // "Replace Wk with Wk" — cập nhật ký hiệu sẵn có, chỉ đếm đối chứng.
    if (/replace.*wk|wk.*with|thaywk|wkwk/.test(ep)) {
      thayViec(null);
      if (log) log.banTinWkThay++;
    }

    const caps = laDoSau ? [] : coordsInLine(dong);
    if (caps.length && viecGan) {
      for (const c of caps) {
        out.push({
          mucId: muc.id,
          viec: viecGan === "DỜI" ? "GỠ" : viecGan, // DỜI = gỡ chỗ cũ; chỗ mới cần tin LẬP riêng
          loai: muc.loai,
          lon: c.lon,
          lat: c.lat,
          so: muc.so,
          nam: muc.nam,
          file: tenFile,
        });
      }
    }
    if (viecTuoi++ >= 2) viecGan = null; // động từ chỉ với xa 2 dòng
  }

  /* Khử trùng hai nửa Anh–Việt + cổng mâu thuẫn (xem chú thích trên). */
  const theoO = new Map(); // ô ~100 m → Set các việc
  for (const e of out) {
    const k = `${e.mucId}|${e.lat.toFixed(3)},${e.lon.toFixed(3)}`;
    if (!theoO.has(k)) theoO.set(k, new Set());
    theoO.get(k).add(e.viec);
  }
  const sach = [];
  const daLay = new Set();
  for (const e of out) {
    const k = `${e.mucId}|${e.lat.toFixed(3)},${e.lon.toFixed(3)}`;
    if (theoO.get(k).size > 1) {
      if (log && !daLay.has(`x${k}`)) {
        log.banTinMauThuan.push(`${e.mucId} @${e.lat.toFixed(3)},${e.lon.toFixed(3)}`);
        daLay.add(`x${k}`);
      }
      continue; // nửa Anh nói Delete, nửa Việt nói Chèn — không bốc thăm
    }
    const kv = `${e.viec}|${k}`;
    if (daLay.has(kv)) continue; // bản Anh + bản Việt của cùng một dòng
    daLay.add(kv);
    sach.push(e);
  }
  return sach;
}

/* ══ LÝ LỊCH THÔNG BÁO — sha1(URL công bố) → { url, nam, thang } ═══════════
 * Cùng cách dựng với generate-vn-aids.mjs (đọc kho detail + cdx, không mạng). */
function lyLichThongBao() {
  const idx = new Map();
  const them = (url, meta) => {
    if (!url) return;
    idx.set(sha1(url), { url, ...meta });
  };
  const dDetail = join(KHO_TBHH, "detail");
  if (existsSync(dDetail)) {
    for (const f of readdirSync(dDetail)) {
      let h;
      try {
        h = readFileSync(join(dDetail, f), "utf8");
      } catch {
        continue;
      }
      for (const m of h.matchAll(/href="([^"]*\.pdf)"/gi)) {
        let u = m[1];
        if (u.startsWith("/")) u = `https://vmsa.vn${u}`;
        else if (!/^https?:/i.test(u)) u = `https://vmsa.vn/${u}`;
        const nam = /TBHH(\d{4})\//.exec(u)?.[1] ?? /\/(\d{4})\/\d{1,2}\//.exec(u)?.[1];
        them(u, { nam: nam ? Number(nam) : null, thang: null });
      }
    }
  }
  const dCdx = join(KHO_TBHH, "cdx");
  if (existsSync(dCdx)) {
    for (const f of readdirSync(dCdx)) {
      let rows;
      try {
        rows = JSON.parse(readFileSync(join(dCdx, f), "utf8"));
      } catch {
        continue;
      }
      if (!Array.isArray(rows)) continue;
      for (const row of rows.slice(1)) {
        const org = row?.[1];
        if (typeof org !== "string") continue;
        const u = /\/uploads\/(\d{4})\/(\d{2})\//.exec(org);
        them(org, {
          nam: u ? Number(u[1]) : Number(String(row[0]).slice(0, 4)) || null,
          thang: u ? Number(u[2]) : null,
        });
      }
    }
  }
  return idx;
}

/* ══ LƯỚI ĐỘ SÂU — cổng hợp lý cho "độ sâu vượt qua" ═══════════════════════
 * "Độ sâu vượt qua 82 m" ở nơi nước < 12 m là cột tên lẻn vào (án lệ BL.1).
 * Hằng số PHẢI khớp DEPTH_META của src/lib/depth-grid.ts — test nhập cả hai
 * bên và bắt lệch, nên không thể trôi. */
export const DEPTH_META = {
  lat0: 5 + 1 / 480,
  lon0: 102 + 1 / 480,
  step: 1 / 240,
  nLat: 4441,
  nLon: 3841,
};
function lopDoSauTai(grid, lat, lon) {
  if (!grid) return null;
  const { lat0, lon0, step, nLat, nLon } = DEPTH_META;
  const i = Math.round((lat - lat0) / step);
  const j = Math.round((lon - lon0) / step);
  if (i < 0 || i >= nLat || j < 0 || j >= nLon) return null;
  const k = i * nLon + j;
  return (grid[k >> 2] >> ((k & 3) * 2)) & 3;
}

/* ══ CHẠY ═════════════════════════════════════════════════════════════════ */

async function chay() {
  const log = {
    mapMo: 0,
    dongLoan: 0,
    vatTroi: 0,
    khongCoBang: 0,
    goKhongKhopAi: 0,
    quaCu: 0,
    khongNam: 0,
    doSauVoLy: [],
    trenDat: [],
    ntmDong: 0,
    trungCho: 0,
    tinVePhao: 0,
    banTinDoc: 0,
    banTinWkThay: 0,
    banTinMauThuan: [],
    banTinGo: [],
    xaCum: 0,
    neoKhongTraDuoc: 0,
  };

  const khoCo = [KHO_OCR, KHO_CHU].filter((d) => existsSync(d));
  if (!khoCo.length) {
    console.error(`Không có kho chữ nào ở ${KHO_OCR} / ${KHO_CHU} — không có gì để đọc.`);
    process.exitCode = 1;
    return;
  }
  const lyLich = lyLichThongBao();

  // MỘT thông báo = MỘT bản chữ; kho OCR đứng trước thắng (cùng luật vn-aids).
  const chon = new Map();
  for (const kho of khoCo) {
    for (const f of readdirSync(kho)) {
      if (!f.endsWith(".dong.json") || chon.has(f)) continue;
      chon.set(f, kho);
    }
  }

  /** Sự kiện: {viec, loai, ten, lon, lat, doSau, banKinh, nam, thang, so, url, refSo, duong} */
  const suKien = [];
  /** Số hiệu thông báo → tên phương tiện đọc được từ chính tin đó — để bản tin
   *  tuần (chỉ mang số tham chiếu) tra ra tên. Ghi CẢ tin bị bỏ vì mất toạ độ:
   *  tin 993/TBHH-CVHHHP mất bảng toạ độ vào tay OCR nhưng tên "Việt Anh 26"
   *  trong tiêu đề vẫn đọc được — bản tin tuần mang toạ độ, tin gốc mang tên. */
  const tenTheoSo = new Map();

  for (const [f, kho] of chon) {
    let d;
    try {
      d = JSON.parse(readFileSync(join(kho, f), "utf8"));
    } catch {
      continue;
    }
    const lines = (d.trang ?? []).flat().filter((x) => typeof x === "string");
    if (!lines.length) continue;
    const toanVan = lines.join("\n");
    const meta = lyLich.get(f.replace(".dong.json", "")) ?? {};

    /* ── Họ (b): Thông báo người đi biển — dòng Chèn/Xóa Wk ───────────────
       Nhận diện FILE bằng dấu vân "Hải đồ ảnh hưởng / Chart affected": file
       NtM tuyệt đối KHÔNG rơi xuống họ (a) — khuôn của nó khác hẳn (tiêu đề
       "…– Tàu đắm" sẽ bị họ (a) đọc nhầm thành một tin lập không tên. Một
       file gói nhiều tin, mỗi tin hai bản Việt + Anh — bản Anh Insert/Delete
       BỎ QUA để không đếm một xác tàu thành hai. Mã "Wk" hay bị khuôn PDF
       đẩy sang dòng RIÊNG, trước hoặc sau dòng toạ độ; và có tin mất hẳn mã
       — khi đó tiêu đề tin gần nhất phía trên ("– Tàu đắm/chìm") làm chứng. */
    const laNtM = /h[ảa]iđ[ồo][ảa]nhh[ưu][ơở]ng|chartaffected/.test(nen(toanVan));
    let tieuDeWk = false; // tiêu đề tin NtM gần nhất có nói tàu đắm/chìm không
    for (let i = 0; i < lines.length; i++) {
      if (laNtM && /vi[êệ]tnam[–-]/.test(nen(lines[i]) + nen(lines[i + 1] ?? ""))) {
        tieuDeWk = /t[àa]uđ[ắăa]m|t[àa]uch[ìi]m|s[àa]lanch[ìi]m|x[áa]ct[àa]u|t[àa]um[ắăa]cc[ạa]n/.test(
          nen(lines[i]) + nen(lines[i + 1] ?? "") + nen(lines[i + 2] ?? ""),
        );
      }
      const wkGan =
        [-2, -1, 1, 2].some((k) => /^\s*Wk\s*$/.test(lines[i + k] ?? "")) ||
        (laNtM && tieuDeWk);
      const ev = docDongNtM(lines[i], wkGan);
      if (!ev) continue;
      log.ntmDong++;
      /* Số hiệu TBHH gốc + ngày: dòng "thông báo số N/TBHH-CQ" và "cập nhật
         Ngày … năm YYYY" gần nhất phía trên. Soi trên bản ĐÃ ÉP HẾT khoảng
         trắng: kho lớp-chữ chẻ "số" thành "s ố" nên khớp trên dòng thô là
         trượt cả kho (đã đo: mọi tin NtM mất số hiệu). */
      let so = "";
      let nam = null;
      let thang = null;
      for (let j = i; j >= 0 && j > i - 25 && (!so || nam === null); j--) {
        // Ghép cả dòng KẾ TIẾP: khuôn PDF bẻ "số 143/TBHH -" và tên cơ quan
        // thành hai dòng — soi từng dòng riêng là mất số hiệu của cả kho NtM.
        const ep = (String(lines[j]) + String(lines[j + 1] ?? "")).replace(/\s+/g, "");
        if (!so) {
          const m = /s[ốô]:?(\d{1,5})\/?TBHH[-–—]?([A-ZĐ]{2,20})/iu.exec(ep);
          if (m) so = `${m[1]}/TBHH-${m[2].toUpperCase()}`;
        }
        if (nam === null) {
          const mNgay = /ng[àa]y(?:\d{1,2})?th[áa]ng(\d{1,2})năm(20\d{2})/iu.exec(ep);
          if (mNgay) {
            nam = Number(mNgay[2]);
            thang = Number(mNgay[1]);
          }
        }
      }
      if (nam === null) {
        nam = meta.nam ?? null;
        thang = meta.thang ?? null;
      }
      suKien.push({
        viec: ev.viec,
        loai: "xac-tau", // dòng mang mã Wk = ký hiệu xác tàu của hải đồ
        ten: ev.ten,
        lon: ev.lon,
        lat: ev.lat,
        doSau: null,
        banKinh: null,
        nam,
        thang,
        so,
        url: meta.url ?? "",
        refSo: [],
        duong: kho === KHO_OCR ? "ocr" : "lop-chu",
      });
    }
    if (laNtM) continue;

    /* ── Họ (a): Thông báo hàng hải thường — phân loại theo KHỐI TIÊU ĐỀ ──
       Tiêu đề = mấy dòng NGAY SAU chữ "THÔNG BÁO HÀNG HẢI", dừng ở "Vùng
       biển"/"Căn cứ". Phân loại trên cả khối đầu văn bản thì dính bẫy đã đo
       được: một tin THÔNG SỐ ĐỘ SÂU mang câu bồi "rà quét chướng ngại vật"
       + một hàng toạ độ OCR đọc `°` thành `9` (10°23' → 109°23') = một
       "chướng ngại vật" nằm giữa biển khơi cách chỗ thật 250 km. */
    let iTieuDe = -1;
    for (let i = 0; i < Math.min(lines.length, 60); i++) {
      if (/th[ôo]ngb[áa]oh[àa]ngh[ảa]i/.test(nen(lines[i]))) {
        iTieuDe = i;
        break;
      }
    }
    let dau;
    if (iTieuDe >= 0) {
      const khoi = [];
      for (let i = iTieuDe + 1; i < Math.min(lines.length, iTieuDe + 9); i++) {
        if (/^(v[ùu]ngbi[ểêe]n|c[ăa]nc[ứu]|t[êe]nlu[ồô]ng|x[ée]tđ[ơo]n)/.test(nen(lines[i]))) break;
        khoi.push(lines[i]);
      }
      dau = khoi.join("\n");
    } else {
      const het = toanVan.search(/C[ăa]n c[ứu]|X[ée]t [Đđ]ơn|Th[ừư]a [ủu]y quy[ềê]n|C\s*ă\s*n\s*c\s*[ứu]/);
      dau = toanVan.slice(0, het > 200 ? het : 3000);
    }
    // Chỉ nhận tin mà TIÊU ĐỀ là chướng ngại/xác tàu — "thanh thải" trong phần
    // căn cứ pháp lý của một tin nạo vét không được kéo tin đó vào lớp này.
    if (!/ch[ưứ][ơớo]ngng[ạa][ịỉi]?v[ậa]t|x[áa]ct[àa]u|ch[ìi]m|đ[ắăa]m|m[ắăa]cc[ạa]n|v[ậa]tth[êể]/.test(nen(dau))) {
      // …trừ tin thông số luồng mang khối "Lưu ý: tồn tại chướng ngại vật là
      // xác tàu … phao số N" — xem docXacTauTheoPhao.
      const neo = docXacTauTheoPhao(toanVan);
      if (neo) {
        const metaNgay = /ng[àa]y\s*\d{1,2}\s*th[áa]ng\s*(\d{1,2})\s*năm\s*(\d{4})/iu.exec(
          toanVan.replace(/\s+/g, " "),
        );
        const namNeo = meta.nam ?? (metaNgay ? Number(metaNgay[2]) : null);
        suKien.push({
          viec: "LẬP",
          loai: "xac-tau",
          ten: neo.ten,
          lon: null,
          lat: null,
          neo,
          doSau: neo.doSau,
          banKinh: null,
          nam: namNeo,
          thang: metaNgay && Number(metaNgay[2]) === namNeo ? Number(metaNgay[1]) : (meta.thang ?? null),
          so: (() => {
            const m = /S[ốô]:?(\d{1,5})[\/I|]?TBHH[-–—]?([A-ZĐ]{2,20})/iu.exec(
              toanVan.replace(/\s+/g, ""),
            );
            return m ? `${m[1]}/TBHH-${m[2].toUpperCase()}` : "";
          })(),
          url: meta.url ?? "",
          refSo: [],
          duong: kho === KHO_OCR ? "ocr" : "lop-chu",
        });
      }
      continue;
    }
    /* Tin VỀ PHAO ("Thiết lập mới 02 phao báo hiệu … khu vực trục vớt tàu X",
       "tạm ngừng hoạt động phao báo hiệu chướng ngại vật"): toạ độ trong tin
       là toạ độ CÁI PHAO, thuộc đường ống vn-aids. Đọc nó thành chướng ngại
       là đặt một xác tàu lên đầu một cái phao — và đếm trùng với lớp báo hiệu. */
    if (/phaob[áa]ohi[êệ]u|thi[êế]tl[ậa]pm[ơớ]i\d{0,2}phao/.test(nen(dau))) {
      log.tinVePhao++;
      continue;
    }
    const viec = viecCuaTin(dau);
    if (!viec) continue;

    if (viec === "LẬP" && laVatTroi(toanVan)) {
      log.vatTroi++;
      continue;
    }

    // Ngày + số hiệu — cùng luật ưu tiên của vn-aids (năm đường dẫn thắng).
    const ngayVan = /ng[àa]y\s*(\d{1,2})\s*th[áa]ng\s*(\d{1,2})\s*năm\s*(\d{4})/iu.exec(
      toanVan.replace(/\s+/g, " "),
    );
    const nam = meta.nam ?? (ngayVan ? Number(ngayVan[3]) : null);
    const thang =
      ngayVan && Number(ngayVan[3]) === nam ? Number(ngayVan[2]) : (meta.thang ?? null);
    const gon = toanVan.replace(/\s+/g, " ");
    const coQuan = /TBHH\s*[-–—]\s*([A-ZÀ-Ỹ][A-ZÀ-Ỹa-zà-ỹ]{2,19})/.exec(gon)?.[1] ?? "";
    const soVan = /S[ốô]\s*:?\s*(\d{1,5})\s*[\/I|]?\s*TBHH/iu.exec(gon)?.[1] ?? "";
    const url0 = meta.url ?? "";
    const soUrl =
      /\/(\d{1,5})[-_]TBHH/i.exec(url0)?.[1] ?? /\/TBHH\d{4}\/(\d{1,5})\.pdf/i.exec(url0)?.[1] ?? "";
    const soHieu = soVan || soUrl;
    const so = soHieu && coQuan ? `${soHieu}/TBHH-${coQuan.toUpperCase()}` : soHieu;

    // Toạ độ: đường chính (bắt buộc °) trước, đường lùi vỡ-cột sau.
    const caps = [];
    for (const l of lines) {
      let c = capToaDo(l, log);
      if (!c.length) c = capToaDoKhongDo(l);
      if (!c.length) continue;
      if (c.length === 1) caps.push(c[0]);
      else {
        // Hai cặp một dòng = một điểm ở hai hệ toạ độ; lệch xa là dòng loạn.
        const a = c[0];
        const b = c[c.length - 1];
        if (kmGiua(a.lon, a.lat, b.lon, b.lat) > LECH_HE_KM) {
          log.dongLoan++;
          continue;
        }
        // VN-2000 đứng trước trong bảng ⇒ cặp SAU là WGS-84 (hệ của GPS bà con).
        const iVn = gon.search(/VN\s*-?\s*2000/i);
        const iWgs = gon.search(/WGS\s*-?\s*84/i);
        caps.push(iVn >= 0 && iWgs >= 0 && iVn < iWgs ? b : a);
      }
    }
    /* VỊ TRÍ = TRUNG VỊ của mọi hàng toạ độ, sau khi bỏ hàng xa cụm > 60 km.
       Vì sao không lấy hàng ĐẦU: đã đo được một tin thật (4570/TBHH-CVHHTPHCM,
       sụt lún cầu cảng Vietsovpetro) mà hàng đầu bị OCR trộn cột thành một
       điểm giữa biển khơi cách chỗ thật 250 km — các hàng sau đúng cả. Tin
       nhiều hàng là các đỉnh một VÙNG giới hạn, trung vị là tâm hợp lý; hàng
       loạn đơn lẻ không kéo nổi trung vị. */
    const cap = chonViTri(caps, log);
    const tenTin = tenPhuongTien(dau) ?? tenPhuongTien(gon.slice(0, 2500));
    if (so && tenTin && !tenTheoSo.has(so.toUpperCase()))
      tenTheoSo.set(so.toUpperCase(), { ten: tenTin, url: url0 });
    if (viec === "LẬP" && !cap) {
      log.khongCoBang++;
      continue;
    }

    suKien.push({
      viec,
      /* Tiêu đề nhiều tin chỉ nói "chướng ngại vật nguy hiểm mới phát hiện";
         con tàu nằm trong CÂU CÔNG BỐ sau phần căn cứ ("thông báo tồn tại …
         (tàu cá BĐ-83019 TS bị chìm)"). Soi cả câu đó để không dán nhãn
         "chướng ngại" lên một xác tàu tra được số hiệu. */
      loai: loaiCuaTin(
        dau + " " + (/th[ôo]ng b[áa]o t[ồo]n t[ạa][ịi][^\n]{0,220}/iu.exec(gon)?.[0] ?? ""),
      ),
      ten: tenTin,
      lon: cap ? cap.lon : null,
      lat: cap ? cap.lat : null,
      doSau: viec === "LẬP" ? docDoSauVuotQua(toanVan) : null,
      banKinh: viec === "LẬP" ? docBanKinh(toanVan) : null,
      nam,
      thang,
      so,
      url: url0,
      refSo: viec === "GỠ" ? soDanChieu(toanVan).filter((x) => x !== so) : [],
      duong: kho === KHO_OCR ? "ocr" : "lop-chu",
    });
  }

  /* ── GỘP SỰ KIỆN: LẬP theo thời gian, GỠ áp sau cùng ─────────────────────
     Bản GỠ áp KHÔNG CẦN NGÀY khi khớp TÊN hoặc SỐ HIỆU dẫn chiếu (văn bản gỡ
     theo định nghĩa ra sau văn bản lập của đúng vật đó). GỠ chỉ-có-toạ-độ thì
     ngặt hơn: < 500 m VÀ không cũ hơn bản lập — hai sà lan chìm cách nhau
     2 km trên cùng luồng là chuyện đã thấy thật, xoá nhầm hàng xóm là mất
     một xác tàu đang nằm đó. */
  /* ── NGUỒN (c): bản tin chỉnh lý hải đồ tuần — xem docBanTin ─────────────
     Tên phương tiện: bản tin chỉ mang SỐ THAM CHIẾU TBHH; tra `tenTheoSo` để
     lấy tên từ chính tin gốc trong kho (993/TBHH-CVHHHP → "Việt Anh 26"). */
  if (existsSync(KHO_BANTIN)) {
    for (const f of readdirSync(KHO_BANTIN)) {
      if (!f.endsWith(".json") || /SUMMARY_OF_NOTICES/i.test(f)) continue;
      let d;
      try {
        d = JSON.parse(readFileSync(join(KHO_BANTIN, f), "utf8"));
      } catch {
        continue;
      }
      const lines = banTinDong(d);
      if (lines.length < 3) continue;
      log.banTinDoc++;
      for (const e of docBanTin(lines, f, log)) {
        const goc = e.so ? tenTheoSo.get(e.so.toUpperCase()) : undefined;
        suKien.push({
          viec: e.viec,
          loai: e.loai,
          ten: goc?.ten ?? null,
          lon: e.lon,
          lat: e.lat,
          doSau: null,
          banKinh: null,
          nam: e.nam,
          thang: null,
          so: e.so,
          url: goc?.url ?? "",
          refSo: e.viec === "GỠ" && e.so ? [e.so] : [],
          duong: "ban-tin",
          banTinId: e.mucId,
        });
      }
    }
  } else {
    log.banTinKhoVang = KHO_BANTIN;
  }

  /* Tra vị trí cho sự kiện NEO THEO PHAO (xem docXacTauTheoPhao): phao lấy
     từ vn-aids.v1.json — cùng nguồn nhà nước, cùng repo. Không tra ra phao
     thì BỎ sự kiện và ĐẾM: không toạ độ thì không đặt chấm. */
  if (suKien.some((e) => e.neo)) {
    let aids = null;
    try {
      aids = JSON.parse(readFileSync("public/data/vn-aids.v1.json", "utf8"));
    } catch {
      aids = null;
    }
    for (const e of suKien) {
      if (!e.neo) continue;
      let vt = null;
      if (aids) {
        const khoaLuong = nen(e.neo.luong).replace(/^lu[ồô]ng(h[àa]ngh[ảa]i)?/, "");
        for (const m of aids.marks ?? []) {
          const rt = aids.routes?.[m[9]];
          if (!rt || !khoaLuong || !nen(rt.ten).includes(khoaLuong)) continue;
          if (aids.names?.[m[10]] === `Phao ${e.neo.phaoSo}`) {
            vt = m;
            break;
          }
        }
      }
      if (vt) {
        e.lon = vt[0];
        e.lat = vt[1];
        e.ghi =
          `Vị trí theo Phao ${e.neo.phaoSo} luồng ${e.neo.luong} ` +
          `(tin tả xác tàu cách phao ~${e.neo.cachM} m, không công bố toạ độ riêng)`;
      } else {
        log.neoKhongTraDuoc++;
        e.viec = "BỎ";
      }
    }
  }

  const lap = suKien.filter((e) => e.viec === "LẬP");
  const go = suKien.filter((e) => e.viec === "GỠ");
  lap.sort((a, b) => (a.nam ?? 0) - (b.nam ?? 0) || (a.thang ?? 0) - (b.thang ?? 0));

  const soTay = new Map(); // khoá → sự kiện LẬP mới nhất
  const nhanCua = (x) => (x.duong === "ban-tin" ? `bản tin ${x.banTinId ?? x.so}` : x.so);
  for (const e of lap) {
    const key = e.ten ? `n:${khoaTen(e.ten)}` : `v:${e.lon.toFixed(3)},${e.lat.toFixed(3)}`;
    const cu = soTay.get(key);
    /* Cùng khoá mà đến từ HAI HỌ nguồn khác nhau (tin TBHH ↔ bản tin chỉnh lý
       hải đồ) = một vật được hai nguồn độc lập xác nhận — ghi đối chứng và vá
       phần thiếu, đừng ghi đè im lặng. Cùng họ thì là tin cập nhật thường,
       bản mới thay bản cũ như trước. */
    if (cu && (cu.duong === "ban-tin") !== (e.duong === "ban-tin")) {
      const nhan = nhanCua(cu);
      e.doiChung = [...new Set([...(cu.doiChung ?? []), ...(e.doiChung ?? []), ...(nhan ? [nhan] : [])])];
      if (!e.url && cu.url) e.url = cu.url;
      if (!e.so && cu.so) e.so = cu.so;
      if (e.thang === null && cu.thang !== null && cu.nam === e.nam) e.thang = cu.thang;
      if (e.doSau === null && cu.doSau !== null) e.doSau = cu.doSau;
      if (e.banKinh === null && cu.banKinh !== null) e.banKinh = cu.banKinh;
      // hải đồ vẽ ký hiệu Wk = xác tàu — cụ thể hơn "chướng ngại vật" chung
      if ((cu.loai === "xac-tau") !== (e.loai === "xac-tau")) e.loai = "xac-tau";
    }
    soTay.set(key, e);
  }
  const ghiGo = (e, v) => {
    if (e.duong === "ban-tin")
      log.banTinGo.push(`${e.banTinId ?? e.so}: gỡ ${v.ten ?? v.so ?? "(không tên)"} [${r(v.lon)},${r(v.lat)}]`);
  };
  for (const e of go) {
    let khop = false;
    if (e.ten) {
      const k = `n:${khoaTen(e.ten)}`;
      const v = soTay.get(k);
      if (v && soTay.delete(k)) {
        khop = true;
        ghiGo(e, v);
      }
    }
    // Tin LẬP nói về HAI vật một lúc ("sà lan SG 7190 và SG 7191 bị chìm")
    // thì khoá tên là chuỗi ghép — bản GỠ nêu một trong hai vẫn phải tìm ra.
    if (e.ten && khoaTen(e.ten).length >= 4) {
      const kGo = khoaTen(e.ten);
      for (const [k] of soTay) {
        if (k.startsWith("n:") && k.slice(2).includes(kGo)) {
          soTay.delete(k);
          khop = true;
        }
      }
    }
    for (const ref of e.refSo) {
      for (const [k, v] of soTay) {
        if (v.so && v.so.toUpperCase() === ref.toUpperCase()) {
          soTay.delete(k);
          khop = true;
          ghiGo(e, v);
        }
      }
    }
    if (e.lon !== null && e.lat !== null) {
      for (const [k, v] of soTay) {
        if (
          kmGiua(e.lon, e.lat, v.lon, v.lat) <= GO_THEO_CHO_KM &&
          (e.nam === null || v.nam === null || e.nam >= v.nam)
        ) {
          soTay.delete(k);
          khop = true;
          ghiGo(e, v);
        }
      }
    }
    if (!khop) log.goKhongKhopAi++;
  }

  // Tuổi: tin LẬP không năm hoặc quá 10 năm thì bỏ — kho không đủ dày để
  // chắc bản gỡ của một tin già đã nằm trong tay.
  const giu = [];
  for (const e of soTay.values()) {
    if (e.nam === null) {
      log.khongNam++;
      continue;
    }
    if (NAM_NAY - e.nam > TUOI_TOI_DA) {
      log.quaCu++;
      continue;
    }
    giu.push(e);
  }

  /* GỘP TRÙNG CHỖ: cùng một vật được hai tin nói tới — một tin có tên, một
     tin không (hoặc OCR làm tên lệch một ký tự: "LA 08086 b" / "LA 08086").
     < 150 m coi là MỘT vật (cùng ngưỡng nhường-chỗ của vn-aids): giữ bản
     MỚI hơn, nhưng vá tên/độ sâu/bán kính từ bản kia nếu bản giữ thiếu —
     một tin có thể mang toạ độ, tin kia mang số hiệu. */
  giu.sort((a, b) => (b.nam ?? 0) - (a.nam ?? 0) || (b.thang ?? 0) - (a.thang ?? 0));
  const gon2 = [];
  for (const e of giu) {
    const trung = gon2.find((g) => kmGiua(g.lon, g.lat, e.lon, e.lat) <= 0.15);
    if (!trung) {
      gon2.push(e);
      continue;
    }
    log.trungCho++;
    /* ĐỐI CHỨNG: hai nguồn độc lập (tin TBHH gốc + bản tin chỉnh lý hải đồ)
       cùng chỉ một chỗ — ghi vào `doiChung` của mục giữ lại thay vì nhân đôi.
       Ưu tiên giữ bản CÓ lý lịch dày hơn (số hiệu + URL) làm gốc. */
    if ((e.url && !trung.url) || (e.so && !trung.so)) {
      // bản kia mang lý lịch dày hơn — hoán vai: nó làm gốc, bản đang giữ
      // thành đối chứng (giữ toạ độ + ngày của bản mới hơn khi nó là gốc).
      const nhan = trung.duong === "ban-tin" ? (trung.banTinId ?? trung.so) : trung.so;
      const dc = trung.doiChung ?? [];
      for (const kfield of ["so", "url", "nam", "thang", "duong", "banTinId", "ghi"]) {
        if (e[kfield] !== undefined && e[kfield] !== null && e[kfield] !== "") trung[kfield] = e[kfield];
      }
      trung.doiChung = [...dc, ...(nhan ? [`bản tin ${nhan}`] : [])].filter(Boolean);
    } else {
      const nhan = e.duong === "ban-tin" ? (e.banTinId ?? e.so) : e.so;
      if (nhan) trung.doiChung = [...(trung.doiChung ?? []), e.duong === "ban-tin" ? `bản tin ${nhan}` : nhan];
      // Số hiệu cụt (OCR mất cơ quan: "875") mà nguồn đối chứng mang bản đầy
      // đủ cùng số ("875/TBHH-CVHHNA") → nhận bản đầy đủ, tra ngược mới trọn.
      if (e.so && /TBHH/.test(e.so) && trung.so && !/TBHH/.test(trung.so) && e.so.startsWith(trung.so + "/"))
        trung.so = e.so;
    }
    if (!trung.ten && e.ten) trung.ten = e.ten;
    // Hải đồ vẽ ký hiệu Wk cho vật này = xác tàu — cụ thể hơn nhãn chung.
    if (trung.loai === "chuong-ngai" && e.loai === "xac-tau") trung.loai = "xac-tau";
    // Hai tin cùng một vật mà hai độ sâu vượt qua (khảo sát hai đợt): lấy số
    // CẠN HƠN — hứa nhiều nước hơn thực tế là kiểu sai giết người, chiều
    // ngược lại chỉ làm bà con tránh rộng thêm vài mét.
    if (e.doSau !== null) trung.doSau = trung.doSau === null ? e.doSau : Math.min(trung.doSau, e.doSau);
    if (trung.banKinh === null && e.banKinh !== null) trung.banKinh = e.banKinh;
  }
  giu.length = 0;
  giu.push(...gon2);

  // Cổng lưới độ sâu cho "độ sâu vượt qua" — xem chú thích DEPTH_META.
  let grid = null;
  const binPath = "public/data/depth-grid.v1.bin";
  if (existsSync(binPath)) grid = new Uint8Array(readFileSync(binPath));
  for (const e of giu) {
    const lop = lopDoSauTai(grid, e.lat, e.lon);
    if (e.doSau !== null && e.doSau > 12 && lop !== null && lop >= 1 && lop <= 2) {
      log.doSauVoLy.push(`${e.ten ?? e.so ?? "?"}: ${e.doSau} m ở nước lớp ${lop}`);
      e.doSau = null; // giữ vật, bỏ con số — con số sai nguy hiểm hơn không có
    }
    if (lop === 0) log.trenDat.push(`${e.ten ?? e.so ?? "?"} [${r(e.lon)},${r(e.lat)}]`);
  }

  // Đối chứng OSM (chỉ ĐỌC reef-shapes; OSM là manh mối, không phải nguồn).
  let osmWk = [];
  try {
    const rs = JSON.parse(readFileSync("public/data/reef-shapes.v1.json", "utf8"));
    osmWk = (rs.features ?? [])
      .filter((f) => f?.properties?.kind === "wreck" && f.geometry?.type === "Point")
      .map((f) => f.geometry.coordinates);
  } catch {
    /* thiếu file thì bỏ đối chứng — không phải lỗi của lớp này */
  }

  /* ── BẢNG TRA + HÀNG SỐ ─────────────────────────────────────────────────*/
  const LOAIS = ["xac-tau", "chuong-ngai", "vat-chim"];
  const names = [];
  const nameIdx = new Map();
  const notices = [];
  const noticeIdx = new Map();
  const items = [];
  giu.sort((a, b) => a.lat - b.lat || a.lon - b.lon);
  for (const e of giu) {
    let ni = -1;
    if (e.ten) {
      ni = nameIdx.get(e.ten) ?? (nameIdx.set(e.ten, names.length), names.push(e.ten) - 1);
    }
    const nk = `${e.so}|${e.nam}|${e.url}`;
    let ti = noticeIdx.get(nk);
    if (ti === undefined) {
      ti = notices.length;
      noticeIdx.set(nk, ti);
      notices.push({
        so: e.so || "",
        nam: e.nam,
        thang: e.thang,
        ...(e.url ? { url: e.url } : {}),
        ...(e.ghi ? { ghi: e.ghi } : {}),
        ...(e.doiChung?.length ? { doiChung: [...new Set(e.doiChung)] } : {}),
        duong: e.duong,
      });
    }
    const gan = osmWk.some(([lo, la]) => kmGiua(lo, la, e.lon, e.lat) <= 0.5);
    items.push([
      r(e.lon),
      r(e.lat),
      LOAIS.indexOf(e.loai),
      ni,
      e.doSau ?? -1,
      e.banKinh ?? -1,
      ti,
      gan ? 1 : 0,
    ]);
  }

  const out = {
    v: 1,
    nguon:
      "Thông báo hàng hải + Thông báo người đi biển — Tổng công ty Bảo đảm " +
      "an toàn hàng hải và các Cảng vụ Hàng hải",
    nhan: "Tham khảo — phải đối chiếu Thông báo hàng hải trước khi dùng để lái tàu",
    layNgay: FETCHED_AT,
    giayPhep: {
      trangThai: "công bố công khai bởi cơ quan nhà nước Việt Nam",
      giayPhepId: "vn-official",
      ghiChu:
        "Văn bản hành chính nhà nước — Điều 15 Luật SHTT. Mỗi mục mang số hiệu " +
        "thông báo trong `notices` để tra ngược tận gốc.",
    },
    loais: LOAIS,
    names,
    notices,
    items,
  };
  const json = JSON.stringify(out);

  /* ── CỔNG TỰ KIỂM (cùng bộ với vn-aids) ─────────────────────────────────*/
  const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;
  if (!CJK.test(String.fromCodePoint(0x6d77))) {
    throw new Error("CHẶN: cổng CJK hỏng — không nhận ra cả ký tự Hán mẫu.");
  }
  if (CJK.test(json)) {
    throw new Error(
      `CHẶN: dữ liệu còn ký tự Hán/CJK — ${names.filter((s) => CJK.test(s)).slice(0, 5).join(", ")}`,
    );
  }
  const [S, W, N, E] = VN_BBOX;
  const ngoai = items.filter((m) => m[1] < S || m[1] > N || m[0] < W || m[0] > E);
  if (ngoai.length) {
    throw new Error(`CHẶN: ${ngoai.length} mục ngoài khung biển VN.`);
  }
  // Dấu vân tay trùng-toạ-độ: hai vật KHÁC TÊN không thể trùng khít tới ~1 m.
  {
    const vanTay = new Map();
    for (const m of items) {
      const k = `${m[0]},${m[1]}`;
      if (!vanTay.has(k)) vanTay.set(k, []);
      vanTay.get(k).push(m);
    }
    const rac = [...vanTay.values()].filter(
      (ds) => ds.length >= 2 && new Set(ds.map((m) => m[3])).size >= 2,
    );
    if (rac.length) {
      throw new Error(
        `CHẶN: ${rac.length} toạ độ tái dùng cho các vật khác tên — ` +
          rac
            .slice(0, 6)
            .map(
              (ds) =>
                `[${ds[0][0]},${ds[0][1]}] ` +
                ds.map((m) => (m[3] >= 0 ? names[m[3]] : "(không tên)")).join(" / "),
            )
            .join(" · "),
      );
    }
  }
  const kb = Math.round(json.length / 1024);
  if (kb > BUDGET_KB) throw new Error(`CHẶN: ${kb} KB > ngân sách ${BUDGET_KB} KB.`);

  // Chống xoá nhầm: chạy trên máy thiếu kho chữ mà vẫn ghi đè là mất cả lớp.
  const DICH = "public/data/xac-tau.v1.json";
  if (existsSync(DICH) && !CHO_PHEP_GIAM && !THU) {
    let cu = null;
    try {
      cu = JSON.parse(readFileSync(DICH, "utf8"));
    } catch {
      cu = null;
    }
    if (cu && Array.isArray(cu.items) && items.length < cu.items.length * 0.8) {
      throw new Error(
        `CHẶN: số mục tụt từ ${cu.items.length} xuống ${items.length}. ` +
          `Kho chữ có đủ chưa? Cố ý cắt bớt thì thêm --cho-phep-giam.`,
      );
    }
  }

  if (!THU) {
    mkdirSync("public/data", { recursive: true });
    writeFileSync(DICH, json);
  }

  /* ── BÁO CÁO ────────────────────────────────────────────────────────────*/
  const nam15 = items.filter((m) => m[1] < 15).length;
  const coDoSau = items.filter((m) => m[4] > 0).length;
  const coBanKinh = items.filter((m) => m[5] > 0).length;
  const coOsm = items.filter((m) => m[7] === 1).length;
  console.log(
    `sự kiện đọc được: ${lap.length} LẬP · ${go.length} GỠ (${log.ntmDong} dòng Chèn/Xóa Wk)`,
  );
  console.log(
    `bỏ: ${log.vatTroi} vật trôi nổi · ${log.khongCoBang} tin LẬP không đọc ra toạ độ · ` +
      `${log.khongNam} không năm · ${log.quaCu} quá ${TUOI_TOI_DA} năm · ` +
      `${log.mapMo} hàng chữ số chẻ mập mờ · ${log.dongLoan} dòng hai hệ lệch nhau · ${log.trungCho} tin trùng chỗ đã gộp · ${log.xaCum} hàng xa cụm của tin (OCR trộn cột)`,
  );
  console.log(`GỠ không khớp mục nào đang giữ: ${log.goKhongKhopAi} (tin gỡ của vật ta chưa từng lập)`);
  console.log(
    `bản tin tuần: ${log.banTinDoc} bản đọc được` +
      (log.banTinKhoVang ? ` ⚠️ KHÔNG có kho ở "${log.banTinKhoVang}"` : "") +
      ` · ${suKien.filter((e) => e.duong === "ban-tin").length} sự kiện` +
      ` · ${log.banTinWkThay} dòng thay-ký-hiệu-Wk (đối chứng, không đẻ mục)` +
      ` · mâu thuẫn Anh–Việt (bỏ cả hai chiều): ${log.banTinMauThuan.length}` +
      (log.banTinMauThuan.length ? ` — ${log.banTinMauThuan.join(" · ")}` : ""),
  );
  if (log.banTinGo.length)
    console.log(`bản tin GỠ mục đang giữ: ${log.banTinGo.join(" · ")}`);
  else console.log("bản tin GỠ mục đang giữ: 0 (không mục cũ nào bị Delete/Move)");
  if (log.doSauVoLy.length)
    console.log(`độ sâu vượt qua VÔ LÝ so với lưới độ sâu (đã bỏ số, giữ vật): ${log.doSauVoLy.join(" · ")}`);
  if (log.trenDat.length) console.log(`⚠️ mục rơi vào ô ĐẤT của lưới độ sâu (soi tay): ${log.trenDat.join(" · ")}`);
  console.log(
    `giữ: ${items.length} mục — nam 15°B ${nam15} · bắc ${items.length - nam15} · ` +
      `có độ sâu vượt qua ${coDoSau} · có bán kính cấm ${coBanKinh} · ` +
      `có chấm OSM đối chứng <500 m ${coOsm}/${osmWk.length} điểm OSM`,
  );
  console.log(
    `OK: ${DICH} — ${items.length} mục, ${kb} KB (ngân sách ${BUDGET_KB} KB)` +
      (THU ? " [--thu: KHÔNG ghi]" : ""),
  );
}

/* CHỈ CHẠY KHI ĐƯỢC GỌI THẲNG — bộ test nhập các cổng ở trên (viecCuaTin,
   tenPhuongTien, docDoSauVuotQua, docDongNtM…) thay vì chép bản thứ hai. */
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await chay();
}

/* ── ## Assumptions ────────────────────────────────────────────────────────
 * - "Độ sâu vượt qua" CHỈ lấy khi nguồn nói thẳng ("điểm cạn nhất … độ sâu
 *   X m", "độ sâu vượt qua X m"). "Nằm ở độ sâu khoảng 40 m" là chỗ vật nằm,
 *   không phải nước còn lại bên trên — không ghi. Không có thì -1 (null).
 * - Vật TRÔI (container trôi nổi, "chưa xác định được vị trí") KHÔNG vào lớp:
 *   chấm đứng yên cho vật đang trôi là lời hứa sai chỗ.
 * - Bản GỠ khớp TÊN hoặc SỐ HIỆU dẫn chiếu được áp không cần ngày; GỠ chỉ có
 *   toạ độ thì cần < 500 m và không cũ hơn bản lập (hai sà lan chìm cách nhau
 *   2 km trên cùng luồng là chuyện thật — xoá nhầm hàng xóm là mất một xác
 *   tàu đang nằm đó).
 * - Tin LẬP không đọc ra NĂM thì bỏ (đếm ở `khongNam`): không có năm thì
 *   không biết bản gỡ đã ra chưa — thà thiếu còn hơn vẽ một vật đã trục vớt.
 * - Dòng NtM tiếng Anh (Insert/Delete) BỎ QUA — mỗi tin song ngữ, đọc cả hai
 *   là đếm một xác tàu thành hai.
 * - "Chèn Cọc bê tông" của NtM không vào lớp này (cọc là báo hiệu/công trình,
 *   thuộc đường ống vn-aids); "Chèn Độ sâu" thuộc đường ống soundings.
 * - Xác tàu trong tin "thông số kỹ thuật luồng" mà KHÔNG có bảng toạ độ riêng
 *   (vd xác tàu QNg 98087 TS ở luồng Cửa Gianh, chỉ tả "cách biên phải luồng
 *   17 m") đành bỏ — không có toạ độ thì không đặt chấm, không suy diễn.
 */
export {};
