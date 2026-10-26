// KAIROS — CHẶN CỨNG NỘI DUNG CHỐNG PHÁ NHÀ NƯỚC (14 §5b, AC18b — anh Long 2026-10-26: "fix đi luật cho phần
// chống phá"). THUẦN. .mjs vì agent kiểm duyệt (Node trần, scripts/kairos-kiem.mjs) dùng chung — như chu-quyen.mjs.
//
// HAI TẦNG, cái này là tầng CỨNG:
//   1. Cụm từ CHẮC CHẮN là khẩu hiệu/kêu gọi chống phá ⇒ chặn NGAY lúc ghi (route ⇒ 400 `anti_state`) + luật cứng
//      trước mô hình (luat-kiem-duyet.kiemCung). Không có cửa sổ 5 phút chờ agent.
//   2. Mọi thứ tinh vi hơn (xuyên tạc, bôi nhọ lãnh đạo nói vòng, cờ/biểu tượng chế độ cũ…) ⇒ luật `chong-pha` của
//      agent (luat-kiem-duyet LUAT) chấm theo nghĩa.
//
// CHỈ áp cho chữ của BÀ CON / tài khoản đăng trong app (bài, bình luận, tên gọi, câu trả lời trực, bài agent). KHÔNG áp
// cho BÀI BÁO: báo chính thống đưa tin "xét xử tội tuyên truyền chống Nhà nước", "âm mưu lật đổ chính quyền" là tin
// thật — để mô hình chấm.
//
// Nghiêng về CHÍNH XÁC (bắt ít mà chắc) — khác chu-quyen.mjs: chặn ở đây là trả lỗi thẳng vào mặt người đang gõ, chặn
// nhầm câu lành là mất lòng bà con. Thứ lọt lưới tầng này vẫn còn agent + báo xấu + người trực.
//
// ⚠️ BỎ DẤU LÀ BẪY (bài học loc-chu.ts): "cong phi" = "công phí", "dang ban nuoc" = "đang bán nước", "lat do" = "lật
// đồ"… ⇒ dạng KHÔNG DẤU chỉ nhận cụm không thể là chữ lành.
// Thêm cụm: thêm vào đúng nhóm, KÈM ca test cả dương lẫn âm (kairos-chong-pha.test.ts).

/** Ranh giới không dùng lookbehind (Safari < 16.4 chết lúc parse — safari-cu.test.ts). */
const L = "(?:^|[^\\p{L}\\p{N}])";
const R = "(?![\\p{L}\\p{N}])";
/** Đứng trước là ngữ cảnh TIN VỤ ÁN / phê phán kẻ chống phá ⇒ không phải lời kêu gọi. Cho chen tối đa 2 chữ
 *  ("khởi tố đối tượng | tham gia Việt Tân"). KHÔNG có "bọn"/"lũ": "bọn nó phải lật đổ…" là lời kêu gọi. */
const TIN_VU_AN = /(âm\s+mưu|nhằm|toan|tội|bị\s+bắt|bắt\s+giữ|xét\s+xử|truy\s+tố|khởi\s+tố|kết\s+án|tuyên\s+án|chống\s+lại|tổ\s+chức\s+khủng\s+bố|phản\s+động)(?:\s+[\p{L}\p{N}]+){0,2}\s*$/iu;

const w = (s) => s.trim().split(/\s+/).join("\\s+");
const nhom = (...xs) => `(?:${xs.map(w).join("|")})`;

const CHE_DO = nhom("cộng sản", "đảng cộng sản", "đảng", "chế độ", "nhà nước", "chính quyền", "việt cộng", "csvn", "đcsvn", "đảng csvn");

/**
 * @type {{ term: string, re: RegExp, guardBefore?: RegExp, proper?: boolean }[]}
 * `re` so trên chữ ĐÃ CHUẨN BỊ (thường, NFC, gộp chữ lặp, nối chữ bị chấm xen); `proper` = so thêm đuôi tên riêng
 * trên chữ GỐC (cần chữ hoa).
 */
const PATTERNS = [
  // khẩu hiệu đả đảo
  { term: "đả đảo …", re: new RegExp(`${L}đả\\s+đảo\\s+${CHE_DO}${R}`, "u") },
  // kêu gọi lật đổ — bỏ qua khi là tin vụ án ("âm mưu lật đổ chính quyền nhân dân")
  { term: "lật đổ …", re: new RegExp(`${L}lật\\s+đổ\\s+${CHE_DO}${R}`, "u"), guardBefore: TIN_VU_AN },
  // gọi Đảng / Nhà nước bằng từ miệt thị của nhóm chống phá
  { term: "cộng phỉ", re: new RegExp(`${L}${nhom("cộng phỉ", "việt gian cộng sản", "tà quyền cộng sản", "bè lũ cộng sản")}${R}`, "u") },
  {
    term: "… bán nước / độc tài",
    // KHÔNG có "chế độ"/"chính quyền" (chuyện lịch sử nước khác: "chế độ độc tài Hitler") và KHÔNG có "ăn cướp"
    // (than chuyện đất đai với chính quyền địa phương là phản ánh — để agent xét theo nghĩa)
    re: new RegExp(`${L}${nhom("đảng", "đảng cộng sản", "cộng sản", "nhà nước", "csvn", "đcsvn")}\\s+${nhom("bán nước", "độc tài")}${R}`, "u"),
    guardBefore: TIN_VU_AN,
    proper: true,
  },
  // khẩu hiệu chế độ cũ / tổ chức khủng bố
  { term: "… muôn năm (chế độ cũ)", re: new RegExp(`${L}${nhom("vnch", "việt nam cộng hòa", "việt nam cộng hoà", "việt tân")}\\s+muôn\\s+năm${R}`, "u") },
  { term: "ủng hộ Việt Tân", re: new RegExp(`${L}${nhom("ủng hộ", "gia nhập", "tham gia", "theo", "đi theo")}\\s+(?:đảng\\s+|tổ\\s+chức\\s+)?việt\\s+tân${R}`, "u"), guardBefore: TIN_VU_AN },
  // kêu gọi biểu tình / xuống đường chống chế độ
  { term: "xuống đường chống …", re: new RegExp(`${L}${nhom("xuống đường", "biểu tình", "nổi dậy", "vùng lên")}\\s+(?:chống|lật|đánh\\s+đổ)\\s+${CHE_DO}${R}`, "u"), guardBefore: TIN_VU_AN },
];

/** Không dấu — chỉ những cụm KHÔNG THỂ là chữ lành. */
const ASCII = [
  "da dao cong san", "da dao dang cong san", "da dao viet cong", "da dao csvn", "da dao che do",
  "lat do che do", "lat do cong san", "lat do dang cong san",
  "cong san ban nuoc", "dang cong san ban nuoc", "dcsvn ban nuoc", "csvn ban nuoc",
  "vnch muon nam", "viet tan muon nam",
];
const ASCII_RE = ASCII.map((t) => ({ term: t, re: new RegExp(`${L}${w(t)}${R}`, "u") }));

/** Thường, NFC, gộp chữ lặp ≥3 ("đảảảo" ⇒ "đảo"), nối chữ đơn bị chấm/gạch xen ("đ.ả đ.ả.o" ⇒ "đả đảo"). */
function chuan(text) {
  return String(text ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/(\p{L})\1{2,}/gu, "$1")
    .replace(/(^|[^\p{L}\p{N}])(\p{L}(?:[.\-_*]\p{L})+)(?![\p{L}\p{N}])/gu, (_m, pre, x) => pre + x.replace(/[.\-_*]/g, ""));
}

/**
 * Chuỗi có khẩu hiệu / kêu gọi chống phá RÕ RÀNG không. Trả CỤM TRÚNG (ghi lý do, người trực xem) hoặc null.
 * Chỉ dùng cho chữ của người dùng trong app — KHÔNG cho bài báo (xem đầu file).
 * @param {string | null | undefined} text
 * @returns {string | null}
 */
export function chongPhaFlag(text) {
  const goc = String(text ?? "").normalize("NFC");
  if (!goc.trim()) return null;
  const s = chuan(goc);
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, "gu");
    for (const m of s.matchAll(re)) {
      const i = m.index ?? 0;
      if (p.guardBefore && p.guardBefore.test(s.slice(Math.max(0, i - 48), i + 1))) continue;
      // đuôi tên riêng ("nhà nước độc tài Bắc Triều Tiên") — chỉ thấy được trên chữ gốc còn hoa/thường; chữ đã bị
      // chuẩn hoá đổi độ dài thì bỏ qua bước này (nghiêng về chặn — cụm vẫn là cụm chống phá)
      if (p.proper && s.length === goc.length) {
        const sau = goc.slice(i + m[0].length);
        if (/^[ \t]+\p{Lu}/u.test(sau)) continue;
      }
      return p.term;
    }
  }
  for (const a of ASCII_RE) if (a.re.test(s)) return a.term;
  return null;
}

/** Câu cho mã lỗi `anti_state` — một chỗ, app + quản trị dùng chung. */
export const CAU_CHONG_PHA = "Có nội dung chống phá Nhà nước, không đăng được.";
