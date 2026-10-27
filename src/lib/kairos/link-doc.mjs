// KAIROS — DÒ LINK ĐỘC (2026-10-27, anh Long quảng bá: "link báo trên kairos đc kiểm duyệt virus, link đểu, spam, hack"
// ⇒ chọn "thêm dò link độc thật"). THUẦN, dùng chung máy chủ (chặn NGAY lúc đăng — validate.contentFlag) và máy GPU
// (agent kiểm duyệt kairos-kiem: đối chiếu danh sách lừa đảo, ẩn mục trúng).
//
// HAI LỚP:
//   1. `loiLinkNhanh` — luật cứng, không cần danh sách: link trỏ thẳng IP, link tải file cài (.apk/.exe…), tên miền
//      chữ giả (punycode xn--), tên miền GIẢ cổng nhà nước (có "gov"/"dichvucong" mà không đuôi .gov.vn) hoặc GIẢ ngân
//      hàng (có tên ngân hàng mà không phải tên miền thật), link rút gọn (giấu đích). Đúng các kiểu lừa "tải app nhận
//      hỗ trợ ngư dân" / "cập nhật VNeID" hay gặp.
//   2. `khopDanhSach` — tên miền / link nằm trong danh sách lừa đảo công khai (Phishing.Database, giấy phép MIT —
//      URLhaus KHÔNG dùng: đòi khoá + có thể thu phí khi dùng thương mại). Máy GPU tải mỗi ngày, máy chủ không gánh 11 MB.

/** Link http(s) và "www." trong chữ — bỏ dấu câu dính đuôi. */
export function cacLink(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"'()]+/gi)) {
    const u = m[0].replace(/[.,;:!?…»”’)\]]+$/u, "");
    out.push(/^www\./i.test(u) ? `http://${u}` : u);
  }
  return out;
}

/** Tên máy chủ chữ thường, bỏ "www." và dấu chấm cuối; hỏng ⇒ null. */
export function tenMayChu(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return null;
  }
}

/** Đuôi hai tầng của Việt Nam ("com.vn", "gov.vn"…) ⇒ tên miền đăng ký lấy ba nhãn cuối. */
const HAI_TANG = /^(com|net|org|gov|edu|info|biz|name|pro|health|ac|int)\.(vn)$/;
export function tenMienDangKy(host) {
  const p = String(host ?? "").split(".").filter(Boolean);
  if (p.length <= 2) return p.join(".");
  return HAI_TANG.test(p.slice(-2).join(".")) ? p.slice(-3).join(".") : p.slice(-2).join(".");
}

const DUOI_CAI_DAT = /\.(apk|apks|xapk|aab|exe|msi|bat|cmd|scr|jar|vbs|ps1|dmg|pkg|ipa)$/i;
/** Dịch vụ rút gọn link — giấu đích thật (lừa đảo hay dùng); bà con dán link gốc là được. */
const RUT_GON = new Set(["bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "shorturl.at", "t.ly", "is.gd", "ow.ly", "rebrand.ly", "tiny.cc", "s.id", "shorten.asia", "bitly.com", "v.gd", "short.gy"]);
/** Ngân hàng hay bị giả ⇒ tên miền đăng ký THẬT. Tên có chữ ngân hàng mà khác bảng này là giả. */
const NGAN_HANG = {
  vietcombank: ["vietcombank.com.vn"],
  techcombank: ["techcombank.com", "techcombank.com.vn"],
  agribank: ["agribank.com.vn"],
  bidv: ["bidv.com.vn"],
  vietinbank: ["vietinbank.vn"],
  mbbank: ["mbbank.com.vn", "mb.com.vn"],
  sacombank: ["sacombank.com", "sacombank.com.vn"],
  acb: ["acb.com.vn"],
  vpbank: ["vpbank.com.vn"],
  tpbank: ["tpb.vn", "tpbank.com.vn"],
};

/**
 * Luật cứng cho MỘT link. Trúng ⇒ mã ("ip" | "tai-app" | "punycode" | "gia-nha-nuoc" | "gia-ngan-hang" | "rut-gon"),
 * không ⇒ null. Link hỏng (không phân tích được) ⇒ null (không chặn oan chữ thường).
 */
export function loiLinkNhanh(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return "ip";
  if (DUOI_CAI_DAT.test(decodeURIComponent(u.pathname))) return "tai-app";
  if (host.split(".").some((l) => l.startsWith("xn--"))) return "punycode";
  if (RUT_GON.has(host)) return "rut-gon";
  const goc = tenMienDangKy(host);
  // giả cổng nhà nước: có nhãn/cụm "gov" hay "dichvucong" mà không phải *.gov.vn
  // (cổng chính phủ thật: đuôi ".gov" hoặc ".gov.<mã nước>" — noaa.gov, gov.vn, gov.uk — không bắt)
  if (!/(^|\.)gov(\.[a-z]{2})?$/.test(host) && /(^|[.-])(gov|govvn|chinhphu-vn)([.-]|\d|$)|dichvucong/.test(host)) return "gia-nha-nuoc";
  for (const [ten, that] of Object.entries(NGAN_HANG)) {
    if (host.includes(ten) && !that.includes(goc)) return "gia-ngan-hang";
  }
  return null;
}

/** Link ĐẦU TIÊN trong chữ trúng luật cứng ⇒ { url, ma }; không ⇒ null. */
export function linkNguyHiem(text) {
  for (const url of cacLink(text)) {
    const ma = loiLinkNhanh(url);
    if (ma) return { url, ma };
  }
  return null;
}

/** Chuẩn hoá link để so danh sách: bỏ giao thức, "www.", "/" cuối, chữ thường phần máy chủ. */
export function chuanLink(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return String(url ?? "").trim().toLowerCase();
  }
}

/**
 * Link trong DANH SÁCH lừa đảo: tên máy chủ hoặc một tên miền cha của nó có trong `tenMien`, hoặc link (chuẩn hoá)
 * có trong `link`. Ví dụ "a.b.lua-dao.xyz" trúng nếu danh sách có "lua-dao.xyz".
 * @param {string} url
 * @param {{ tenMien?: Set<string>, link?: Set<string> }} ds
 */
export function khopDanhSach(url, ds) {
  const host = tenMayChu(url);
  if (!host) return false;
  if (ds.tenMien) {
    const p = host.split(".");
    for (let i = 0; i < p.length - 1; i++) if (ds.tenMien.has(p.slice(i).join("."))) return true;
  }
  return !!ds.link?.has(chuanLink(url));
}

/** Danh sách văn bản (mỗi dòng một tên miền / link, "#" là chú thích) ⇒ Set đã chuẩn hoá. */
export function docDanhSach(text, laLink = false) {
  const s = new Set();
  for (const dong of String(text ?? "").split(/\r?\n/)) {
    const x = dong.trim();
    if (!x || x.startsWith("#")) continue;
    s.add(laLink ? chuanLink(/^https?:\/\//i.test(x) ? x : `http://${x}`) : x.toLowerCase().replace(/^www\./, "").replace(/\.$/, ""));
  }
  return s;
}

/** Câu cho bà con khi chặn lúc đăng (theo mã luật cứng). */
export function cauLinkNguyHiem(ma) {
  if (ma === "rut-gon") return "Link rút gọn giấu đích thật — bà con dán link gốc giúp.";
  if (ma === "tai-app") return "Link tải file cài đặt không được đăng — kẻ gian hay dụ tải app lạ để chiếm tài khoản.";
  return "Link này có dấu hiệu lừa đảo (giả cơ quan, ngân hàng hoặc trang lạ) — không đăng được.";
}
