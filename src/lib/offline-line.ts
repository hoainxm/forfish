/*
  MỘT CÂU MẤT SÓNG CHO TOÀN APP (rà FB 2026-10-25, VO-APP-08: 25 biến thể "Mất sóng…" ở 36 chỗ).
  Khuôn chuẩn lấy từ Kairos: "Mất sóng — bản lúc HH:MM dd/MM" khi có bản lưu; không có ⇒ "Mất sóng — có sóng sẽ tải".
  Giờ theo máy (như `kairos/feed-client savedAtLabel`) — bản lưu là việc của máy này, không phải giờ dự báo.
*/

const pad = (n: number) => String(n).padStart(2, "0");

/** epoch ms → "HH:MM dd/MM" giờ máy. */
export function gioLuu(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/**
 * Câu mất sóng. `savedAt` = epoch ms hoặc chuỗi ISO; hỏng/rỗng/ở tương lai (máy đặt sai giờ) ⇒ câu không bản lưu —
 * thà nói ít hơn là nói giờ sai.
 */
export function cauMatSong(savedAt?: number | string | null, now: number = Date.now()): string {
  const t = typeof savedAt === "string" ? Date.parse(savedAt) : savedAt;
  if (typeof t === "number" && Number.isFinite(t) && t > 0 && t <= now) return `Mất sóng — bản lúc ${gioLuu(t)}`;
  return "Mất sóng — có sóng sẽ tải";
}
