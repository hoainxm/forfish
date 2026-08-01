"use client";

// "VỎ APP ĐÃ ĐỦ CHƯA" — đọc thẳng dấu do service worker ghi khi cài xong.
//
// VÌ SAO CẦN (2026-08-01): app đang có HAI khái niệm rời nhau về chữ "sẵn sàng
// đi biển". Một là DỮ LIỆU (`savedCoverage()` đếm localStorage). Hai là VỎ APP
// (HTML + JS + nền bản đồ do service worker cất) — và cái thứ hai thì KHÔNG AI
// ĐỌC. Hậu quả: chip có thể báo "đã lưu đủ dự báo" trên một cái vỏ rỗng, bà con
// yên tâm nhổ neo rồi ra khơi mở app thấy trắng màn. Dữ liệu đủ mà vỏ thiếu thì
// vẫn là không dùng được.
//
// Cách đọc: service worker ghi một entry đánh dấu vào kho vỏ SAU KHI đã qua hết
// cửa install (vỏ sống-còn + JS của nó). Cửa sổ trình duyệt đọc được Cache
// Storage cùng origin nên chỉ cần `caches.match` — không postMessage, không bắt
// tay, không phụ thuộc service worker đang "controlling" hay chưa.

/** Dấu do sw.js ghi — GIỮ ĐỒNG BỘ với hằng SHELL_READY_MARK trong public/sw.js */
export const SHELL_READY_MARK = "/__sdfish-shell-ready";

/**
 * Vỏ app đã cài đủ chưa.
 *
 * `false` khi: chưa cài service worker · install hỏng giữa chừng (thiếu
 * /ngu-truong hoặc thiếu JS của nó) · trình duyệt không có Cache Storage.
 * Trả `true` là thật sự đã qua cửa install, KHÔNG phải "có vẻ ổn".
 */
export async function isShellReady(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    return (await caches.match(SHELL_READY_MARK)) != null;
  } catch {
    return false;
  }
}
