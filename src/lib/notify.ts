/**
 * NHỊP TỰ TẮT của dòng báo nổi (chốt 2026-08-18, chính sách thông báo tầng 4):
 *  · câu MỘT dòng  → 3 giây (NOTIFY_HIDE_MS)
 *  · câu HAI dòng  → 8 giây (NOTIFY_HIDE_LONG_MS) — người 50 tuổi đọc chưa
 *    xong 2 dòng trong 5 giây (audit M9)
 * Nói lại CHỈ khi câu đổi. Mọi chỗ báo nổi trên bản đồ / banner bão dùng chung
 * hai hằng này để tắt cùng một nhịp — không tự bịa số.
 *
 * 5s → 3s (user 2026-08-24: "các phần float kia đang giữ 5s thì chỉnh lại 3s
 * cho đỡ bị rối mắt") — về lại nhịp 3s như trước bản S12. CHỈ đổi vế MỘT dòng;
 * vế HAI dòng giữ 8s vì lý do đọc-kịp ở trên vẫn còn nguyên.
 */
export const NOTIFY_HIDE_MS = 3000;
export const NOTIFY_HIDE_LONG_MS = 8000;
