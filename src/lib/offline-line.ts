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
 *
 * `mangYeu` (2026-10-26, anh Long: "toàn bị ko có sóng ko down đc… trong khi vẫn online"): máy VẪN báo có mạng mà
 * tải không được ⇒ đó là MẠNG YẾU / máy chủ chậm, KHÔNG phải mất sóng — nói "Mất sóng" khi đang cầm máy 5G là nói dối,
 * bà con mất tin app. Chỉ `navigator.onLine === false` mới được gọi là mất sóng (lib/use-online).
 */
/**
 * Câu cho màn TRỐNG vì tải lỗi: máy báo mất mạng ⇒ câu mất sóng riêng của màn; máy VẪN có mạng ⇒ "Mạng yếu, chưa
 * tải được — <thuLai>." (2026-10-26 — không gọi mạng chậm là mất sóng).
 */
export function cauChuaTai(online: boolean, matSong: string, thuLai = "thử lại sau"): string {
  return online ? `Mạng yếu, chưa tải được — ${thuLai}.` : matSong;
}

export function cauMatSong(savedAt?: number | string | null, now: number = Date.now(), mangYeu = false): string {
  const t = typeof savedAt === "string" ? Date.parse(savedAt) : savedAt;
  const coBan = typeof t === "number" && Number.isFinite(t) && t > 0 && t <= now;
  if (mangYeu) return coBan ? `Mạng yếu — đang xem bản lúc ${gioLuu(t as number)}` : "Mạng yếu — chưa tải được, thử lại sau";
  if (coBan) return `Mất sóng — bản lúc ${gioLuu(t as number)}`;
  return "Mất sóng — có sóng sẽ tải";
}
