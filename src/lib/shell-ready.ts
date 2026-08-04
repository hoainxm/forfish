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
 * /ngu-truong hoặc thiếu JS của nó) · **chunk đã cài nhưng sau đó bị dọn khỏi
 * kho** · trình duyệt không có Cache Storage.
 * Trả `true` là thật sự đã qua cửa install, KHÔNG phải "có vẻ ổn".
 *
 * KIỂM LẠI TỪNG URL (2026-08-02, audit A7/K5): dấu suông chỉ chứng minh "một
 * lần install nào đó trong quá khứ đã xong". Ba đường làm nó nói dối: install
 * hỏng nửa chừng, `trimCache` đuổi chunk khung sườn, chunk mất do khe
 * `delete`/`put`. Nay service worker ghi kèm danh sách URL của vỏ sống-còn và
 * chunk của nó; ở đây hỏi lại kho từng cái. Thiếu MỘT là chưa sẵn sàng — bà con
 * cần câu trả lời thật trước khi nhổ neo, không cần câu trả lời dễ chịu.
 */
export async function isShellReady(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const mark = await caches.match(SHELL_READY_MARK);
    if (!mark) return false;
    const body = (await mark.json().catch(() => null)) as {
      urls?: unknown;
    } | null;
    const urls = Array.isArray(body?.urls) ? (body.urls as unknown[]) : null;
    // Dấu đời cũ (chỉ có `at`) → giữ nguyên nghĩa cũ, đừng báo động oan cho máy
    // chưa kịp cài lại service worker bản mới.
    if (!urls) return true;
    /*  Hỏi SONG SONG (2026-08-02b): danh sách hiện ~34 URL, mỗi `caches.match`
        quét cả 6 kho. Hỏi tuần tự thì màn "chuẩn bị đi biển" gọi lại mỗi lần
        đổi bước là mấy chục lượt quét nối đuôi nhau trên máy rẻ. */
    const hits = await Promise.all(
      urls
        .filter((u): u is string => typeof u === "string")
        .map((u) => caches.match(u)),
    );
    return hits.every((h) => h != null);
  } catch {
    return false;
  }
}
