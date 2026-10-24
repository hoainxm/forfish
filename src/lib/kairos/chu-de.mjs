// KAIROS — GẮN CHỦ ĐỀ (14 §9 bước 3). THUẦN. .mjs vì máy thu tin dùng chung (xem lien-ket.mjs).
//
// Chủ đề theo MỤC RSS của báo, rồi từ khoá nghề cá NÂNG bài lên "nghe-ca" dù nằm ở mục
// nào (tin cấm biển trong mục Thời sự vẫn là chuyện của bà con). Tên hiển thị của chủ đề
// nằm ở labels.ts — ở đây chỉ có mã.

import { foldVi } from "./lien-ket.mjs";

/** Mã chủ đề — khớp check của cột `topic` trong 0065. Thứ tự = thứ tự chip sau các chip cố định. */
export const TOPICS = /** @type {const} */ ([
  "nghe-ca",
  "thoi-su",
  "phap-luat",
  "doi-song",
  "the-thao",
  "giai-tri",
  "kinh-te",
]);

/** @typedef {(typeof TOPICS)[number]} Topic */

/** Mục RSS ⇒ chủ đề. Mục lạ ⇒ thoi-su. */
const SECTION_TOPIC = {
  "thuy-san": "nghe-ca",
  "bien-dao": "nghe-ca",
  "nghe-ca": "nghe-ca",
  "thoi-su": "thoi-su",
  "the-gioi": "thoi-su",
  "phap-luat": "phap-luat",
  "the-thao": "the-thao",
  "giai-tri": "giai-tri",
  "suc-khoe": "doi-song",
  "doi-song": "doi-song",
  "kinh-doanh": "kinh-te",
  "kinh-te": "kinh-te",
};

/** Từ khoá nghề cá (đã bỏ dấu, so theo ranh giới từ). */
const FISH_KEYWORDS = [
  // "cuu nan" đứng một mình BỎ (2026-10-24): kéo tin động đất Tây Tạng "tìm kiếm cứu nạn" sang Nghề cá
  "tau ca", "ngu dan", "cam bien", "cuu nan tren bien", "cuu ho hang hai", "iuu", "the vang", "khai thac thuy san",
  "ngu truong", "hai san", "thuy san", "cang ca", "danh bat", "giam sat hanh trinh",
  // KHÔNG có "chuyen bien" (bỏ dấu trùng "chuyển biến") và "tau thuyen" (tin Hormuz, tàu hàng)
  // — đo trên RSS thật 2026-10-23, hai từ này kéo tin thế giới/kinh tế sang Nghề cá.
  "kiem ngu", "tau vo sat", "nghe ca", "ngu nghiep", "ben ca",
  "tranh tru bao", "nuoi bien", "ca ngu", "muc xa", "tom hum",
];

/**
 * CHUYỆN BIỂN rộng hơn nghề cá (anh Long 2026-10-24: "tỷ lệ tin liên quan biển và nghề thuỷ sản phải chiếm 85%"):
 * thời tiết biển, bão, biển đảo, lực lượng trên biển, kinh tế biển, nuôi trồng thuỷ sản. Dùng để (1) lọc feed CHUNG
 * của báo (`chiTinBien`) và (2) nâng chủ đề lên nghe-ca để tin bão/biển đảo được tính là tin biển (phan-phoi.laTinBien).
 *
 * HAI danh sách: SEA_KEYWORDS so trên chữ ĐÃ BỎ DẤU (từ không trùng nghĩa khi bỏ dấu); SEA_KEYWORDS_DAU so trên chữ
 * CÒN DẤU (thường hoá) cho từ bỏ dấu là trùng: "biển đông"≠"biến động", "bão"≠"báo"/"bảo", "hải quân"≠"hải quan".
 */
const SEA_KEYWORDS = [
  "hoang sa", "truong sa", "ap thap nhiet doi", "thoi tiet bien", "trieu cuong",
  "canh sat bien", "bien phong", "kiem ngu", "cang bien", "kinh te bien", "hang hai",
  "nuoi trong thuy san", "nuoi tom", "xuat khau thuy san", "tom the", "ca tra",
];
const SEA_KEYWORDS_DAU = [
  "biển đông", "biển đảo", "vùng biển", "ngoài khơi", "trên biển", "tàu biển", "sóng lớn", "gió mạnh trên biển",
  "bão", "siêu bão", "áp thấp", "hải quân",
];

/**
 * @param {unknown} t
 * @returns {t is (typeof TOPICS)[number]}
 */
export function isTopic(t) {
  return typeof t === "string" && /** @type {readonly string[]} */ (TOPICS).includes(t);
}

/**
 * Chữ có nhắc chuyện nghề cá không.
 * @param {string} text
 * @returns {boolean}
 */
export function hasFishKeyword(text) {
  const f = ` ${foldVi(text)} `;
  return FISH_KEYWORDS.some((k) => f.includes(` ${k} `));
}

/**
 * Chủ đề của một bài báo: mục RSS, rồi nâng lên nghe-ca nếu tiêu đề/mô tả có từ khoá.
 * Thể thao/Giải trí KHÔNG nâng ("đội tuyển ngư dân" không phải tin nghề cá).
 * @param {string} section
 * @param {string} text  tiêu đề + mô tả
 * @returns {(typeof TOPICS)[number]}
 */
export function topicFor(section, text) {
  const base = /** @type {(typeof TOPICS)[number]} */ (SECTION_TOPIC[/** @type {keyof typeof SECTION_TOPIC} */ (section)] ?? "thoi-su");
  if (base === "nghe-ca" || base === "the-thao" || base === "giai-tri") return base;
  return laChuyenBien(text) ? "nghe-ca" : base;
}

/**
 * Chữ có nói chuyện biển / nghề thuỷ sản không (nghề cá + SEA_KEYWORDS).
 * @param {string} text
 * @returns {boolean}
 */
export function laChuyenBien(text) {
  if (hasFishKeyword(text)) return true;
  const f = ` ${foldVi(text)} `;
  if (SEA_KEYWORDS.some((k) => f.includes(` ${k} `))) return true;
  // còn dấu: thường hoá + dấu câu thành khoảng trắng (ranh giới từ như foldVi)
  const d = ` ${String(text ?? "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  return SEA_KEYWORDS_DAU.some((k) => d.includes(` ${k} `));
}
