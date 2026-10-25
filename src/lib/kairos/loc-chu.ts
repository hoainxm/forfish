// KAIROS — LỌC CHỮ BẬY (14 §3.10, AC15). THUẦN, chạy Ở ROUTE khi ghi bài/bình luận/tên
// gọi ⇒ 400 `bad_words` (ghi chú báo xấu KHÔNG lọc: người báo cần trích chữ bậy). Lọc ở client chỉ để báo sớm — gọi thẳng route
// (bỏ qua app) vẫn bị chặn ở đây (bài học Forlife: lọc chỉ ở client là không lọc).
//
// Danh sách TỐI THIỂU — chửi tục rõ ràng, không phải bộ kiểm duyệt. Chuyện xúc phạm,
// lừa đảo, sai sự thật là việc của báo xấu + agent kiểm duyệt + người trực.
//
// ⚠️ BỎ DẤU LÀ BẪY: "lồn" bỏ dấu = "lon" (lon bia), "cặc" = "các", "đéo" = "đeo". Nên:
//   - từ CÓ DẤU so đúng dấu (không phân biệt hoa);
//   - dạng KHÔNG DẤU chỉ nhận những cụm không thể là chữ lành ("dit me", "vcl", "dcm"…).
// Cố ý KHÔNG có: "óc chó" (hạt óc chó), "chó đẻ" (chó đẻ con) — chữ lành trong đời sống.
// Thêm từ: thêm vào đúng nhóm, kèm ca test cả dương lẫn âm.

/** Từ có dấu — so trên chữ thường NFC, theo ranh giới từ. */
const ACCENTED = [
  "địt", "đụ", "đéo", "lồn", "cặc", "buồi", "đĩ", "đm", "đcm", "đmm", "đkm", "vãi lồn", "vãi l",
  "đù má", "đụ má", "địt mẹ", "đéo mẹ", "mẹ kiếp", "con đĩ",
];

/** Cụm KHÔNG DẤU chắc chắn bậy — so trên chữ như người gõ (không bỏ dấu hộ), nên "cái lớn"
 *  có dấu không bao giờ thành "cai lon". */
const ASCII = [
  "dit me", "dit con me", "du ma", "deo me", "con cac", "vai lon", "dcm", "dcmm", "dmm", "dkm", "vcl", "vkl", "clm", "cmm",
];

// Ranh giới trái KHÔNG dùng lookbehind: Safari < 16.4 ném lỗi lúc parse, chết cả chunk
// (cổng safari-cu.test.ts). Ăn luôn ký tự đứng trước — chỉ dùng để test(), không cần vị trí.
const L = "(?:^|[^\\p{L}\\p{N}])";
const R = "(?![\\p{L}\\p{N}])";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
const ACCENTED_RE = ACCENTED.map((w) => ({ w, re: new RegExp(`${L}${esc(w)}${R}`, "u") }));
const ASCII_RE = ASCII.map((w) => ({ w, re: new RegExp(`${L}${esc(w)}${R}`, "u") }));

/**
 * Chuẩn bị chữ: thường, NFC, gộp chữ lặp ≥3 ("lồnnn" ⇒ "lồn"), nối chuỗi chữ đơn bị
 * chấm/gạch xen ("đ.ị.t", "d-c-m" ⇒ "địt", "dcm").
 */
function prepare(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/(\p{L})\1{2,}/gu, "$1")
    .replace(/(^|[^\p{L}\p{N}])(\p{L}(?:[.\-_*]\p{L})+)(?![\p{L}\p{N}])/gu, (_m, pre: string, w: string) => pre + w.replace(/[.\-_*]/g, ""));
}

/** Cụm bậy đầu tiên trúng (để ghi audit), hoặc null khi sạch. */
export function badWordHit(text: string | null | undefined): string | null {
  const s = prepare(String(text ?? ""));
  if (!s.trim()) return null;
  for (const { w, re } of ACCENTED_RE) if (re.test(s)) return w;
  for (const { w, re } of ASCII_RE) if (re.test(s)) return w;
  return null;
}

export function hasBadWords(text: string | null | undefined): boolean {
  return badWordHit(text) !== null;
}
