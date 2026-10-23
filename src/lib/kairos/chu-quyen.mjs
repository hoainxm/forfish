// KAIROS — CHẶN CHUỖI XUYÊN TẠC CHỦ QUYỀN (14 §5, AC18). THUẦN.
//
// Kiểm ở BA chỗ, cùng một hàm: bài báo VÀO (tiêu đề + mô tả RSS, máy thu tin), bản tóm tắt
// RA (AI có thể tự chêm "South China Sea"), và bài/bình luận/tên của bà con (route ⇒ 400
// `sovereignty`). Trúng ⇒ bài không lên dòng tin, ghi `kairos_seen` (loai-chu-quyen + cụm).
//
// .mjs vì máy thu tin (Node trần) dùng chung — xem lien-ket.mjs.
//
// Nghiêng về CHẶN NHẦM hơn để lọt: mất một bài báo là chuyện nhỏ, một dòng "Xisha Islands"
// trên app của doanh nghiệp Việt Nam là chuyện lớn. Ngoại lệ chỉ mở cho tên riêng trong nước
// có thật ("phường Nam Hải", "nam Hải Phòng", "Tây Sa Pa"…).

/** Ranh giới từ cho chữ có dấu — `\b` của JS không hiểu chữ Việt. */
/** Ranh giới trái KHÔNG dùng lookbehind (Safari < 16.4 chết lúc parse — safari-cu.test.ts): ăn
 *  luôn ký tự đứng trước; `m.index` khi đó trỏ vào ký tự đó, đoạn "đứng trước" vẫn đúng. */
const L = "(?:^|[^\\p{L}\\p{N}])";
const R = "(?![\\p{L}\\p{N}])";
/** Từ sau viết hoa ⇒ đang là một phần tên riêng dài hơn (Nam Hải Phòng, Tây Sa Pa). */
const NOT_PROPER_TAIL = "(?![ \\t]+\\p{Lu})";

/** Đơn vị hành chính / tổ chức đứng trước ⇒ "Nam Hải" là tên riêng trong nước. "thành phố" KHÔNG
 *  tính: "thành phố Tam Sa" chính là đơn vị Trung Quốc đặt trái phép. */
/** "thành phố" đứng trước ⇒ KHÔNG phải tên riêng trong nước (bỏ qua ADMIN_BEFORE). */
const CITY_BEFORE = /thành\s+phố\s*$/iu;
const ADMIN_BEFORE =
  /(phường|xã|thôn|làng|ấp|khu|khóm|tổ|đường|phố|chùa|đình|cầu|công ty|cty|tập đoàn|hợp tác xã|htx|trường|khách sạn|nhà hàng|thị trấn|cụm|cảng|bến|chợ|hội)\s*$/iu;

/** @type {{ term: string, re: RegExp, guardBefore?: RegExp }[]} */
const PATTERNS = [
  { term: "South China Sea", re: new RegExp(`${L}south[\\s-]+china[\\s-]+sea${R}`, "iu") },
  { term: "Biển Nam Trung Hoa", re: new RegExp(`${L}biển\\s+nam\\s+trung\\s+hoa${R}`, "iu") },
  { term: "Biển Hoa Nam", re: new RegExp(`${L}biển\\s+hoa\\s+nam${R}`, "iu") },
  // "Nam Hải" viết hoa, không bị nối tiếp bởi chữ hoa, không có đơn vị hành chính đứng trước.
  // Không so không dấu: "năm hai" bỏ dấu cũng ra "nam hai".
  {
    term: "Nam Hải",
    re: new RegExp(`${L}(Nam Hải|NAM HẢI)${NOT_PROPER_TAIL}${R}`, "u"),
    guardBefore: ADMIN_BEFORE,
  },
  { term: "Tây Sa", re: new RegExp(`${L}(Tây Sa|TÂY SA)${NOT_PROPER_TAIL}${R}(?![ \\t]+mạc)`, "u"), guardBefore: ADMIN_BEFORE },
  { term: "Nam Sa", re: new RegExp(`${L}(Nam Sa|NAM SA)${NOT_PROPER_TAIL}${R}(?![ \\t]+mạc)`, "u"), guardBefore: ADMIN_BEFORE },
  { term: "Tam Sa", re: new RegExp(`${L}(Tam Sa|TAM SA)${NOT_PROPER_TAIL}${R}`, "u"), guardBefore: ADMIN_BEFORE },
  { term: "Xisha", re: new RegExp(`${L}(xisha|xi sha|xīshā)${R}`, "iu") },
  { term: "Nansha", re: new RegExp(`${L}(nansha|nan sha|nánshā)${R}`, "iu") },
  { term: "Sansha", re: new RegExp(`${L}(sansha|sānshā)${R}`, "iu") },
  { term: "Zhongsha", re: new RegExp(`${L}zhongsha${R}`, "iu") },
];

/** Paracel/Spratly/Hoàng Sa/Trường Sa gắn với Trung Quốc theo nghĩa SỞ HỮU — xét trong một câu. */
const POSSESSIVE = [
  /(china|chinese|prc|beijing)(['’]s)?\s+(paracels?|spratlys?)/iu,
  /(paracels?|spratlys?)(\s+islands?)?\s*(,\s*|\s+(of|in|belonging\s+to|under)\s+)(the\s+)?(china|prc|people['’]s\s+republic)/iu,
  /(hoàng\s+sa|trường\s+sa|paracels?|spratlys?)(\s+islands?)?\s*(\(\s*|\s+(của|thuộc|thuộc\s+về)\s+)(trung\s+quốc|tq|china)/iu,
  // Không bắt "Hoàng Sa, Trung Quốc …": câu kiểu "tàu bị tấn công ở Hoàng Sa, Trung Quốc lên tiếng" là tin thật.
];

/**
 * Chuỗi có xuyên tạc chủ quyền không. Trả CỤM TRÚNG (để ghi `flag_term`, người trực xem) hoặc
 * null khi sạch. "Hoàng Sa", "Trường Sa", "Biển Đông", "Paracel Islands of Vietnam" ⇒ null.
 * @param {string | null | undefined} text
 * @returns {string | null}
 */
export function chuQuyenFlag(text) {
  const s = String(text ?? "").normalize("NFC");
  if (!s.trim()) return null;
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    for (const m of s.matchAll(re)) {
      const before = s.slice(Math.max(0, (m.index ?? 0) - 24), (m.index ?? 0) + 1);
      if (p.guardBefore && p.guardBefore.test(before) && !CITY_BEFORE.test(before)) continue;
      return p.term;
    }
  }
  for (const sentence of s.split(/[.!?;\n]+/)) {
    for (const re of POSSESSIVE) {
      const m = sentence.match(re);
      if (m) return m[0].trim().slice(0, 100);
    }
  }
  return null;
}

/**
 * Kiểm nhiều trường một lượt (tiêu đề + mô tả + tóm tắt). Trường nào trúng trước trả trước.
 * @param {...(string | null | undefined)} parts
 * @returns {string | null}
 */
export function chuQuyenFlagAll(...parts) {
  for (const p of parts) {
    const f = chuQuyenFlag(p);
    if (f) return f;
  }
  return null;
}

/**
 * Câu BẮT BUỘC chèn vào prompt tóm tắt (máy thu tin). Test giữ hai cụm "Biển Đông" và
 * "quần đảo Hoàng Sa, Trường Sa của Việt Nam" — sửa câu thì giữ nguyên hai cụm đó.
 */
export const CHU_QUYEN_PROMPT =
  "Luật chủ quyền, bắt buộc: luôn gọi vùng biển là \"Biển Đông\", không bao giờ viết \"South China Sea\" hay \"Nam Hải\". " +
  "Luôn viết \"quần đảo Hoàng Sa, Trường Sa của Việt Nam\"; không dùng tên Trung Quốc đặt (Tây Sa, Nam Sa, Tam Sa, Xisha, Nansha). " +
  "Bài nào gọi khác thì vẫn tóm tắt nhưng dùng đúng tên Việt Nam.";
