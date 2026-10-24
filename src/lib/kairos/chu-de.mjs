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
  "tau ca", "ngu dan", "cam bien", "cuu nan", "iuu", "the vang", "khai thac thuy san",
  "ngu truong", "hai san", "thuy san", "cang ca", "danh bat", "giam sat hanh trinh",
  // KHÔNG có "chuyen bien" (bỏ dấu trùng "chuyển biến") và "tau thuyen" (tin Hormuz, tàu hàng)
  // — đo trên RSS thật 2026-10-23, hai từ này kéo tin thế giới/kinh tế sang Nghề cá.
  "kiem ngu", "tau vo sat", "nghe ca", "ngu nghiep", "ben ca",
  "tranh tru bao", "nuoi bien", "ca ngu", "muc xa", "tom hum",
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
  return hasFishKeyword(text) ? "nghe-ca" : base;
}
