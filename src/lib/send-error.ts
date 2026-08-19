// PHÂN LOẠI "GỬI KHÔNG ĐƯỢC" cho các form để-lại-yêu-cầu — THUẦN, có test
// (audit 2026-08-18 G2). Trước đây SĐT sai / mất sóng / hết giờ / máy chủ lỗi
// đều đổ về một câu "Nhập đúng số điện thoại rồi thử lại" — đổ tội sai cho bà
// con đang mất sóng, và không nói cần gọi ai.

export type SendFailure = "sdt" | "mang" | "may-chu";

/**
 * Kết luận vì sao chưa gửi được.
 *  · `sdt`     — số điện thoại chưa đủ (chưa gửi đi)
 *  · `mang`    — fetch ném / máy đang báo mất sóng / hết giờ chờ
 *  · `may-chu` — có phản hồi nhưng không phải `ok:true`
 */
export function classifySendFailure(a: {
  phoneDigits: string;
  /** fetch có ném không (mất sóng, hết giờ) */
  threw: boolean;
  /** `navigator.onLine === false` lúc gửi */
  offline: boolean;
  /** phản hồi có `ok:true` không (chỉ xét khi không ném) */
  ok: boolean;
}): SendFailure | null {
  if (a.phoneDigits.replace(/\D/g, "").length < 9) return "sdt";
  if (a.threw || a.offline) return "mang";
  if (!a.ok) return "may-chu";
  return null;
}

/** Câu nói với bà con — `unit` là tên đơn vị nhận yêu cầu ("SDVICO" hay tên
 *  đơn vị ngoài); có hotline thì nhắc gọi thẳng. */
export function sendFailureText(kind: SendFailure, unit: string): string {
  switch (kind) {
    case "sdt":
      return "Nhập đúng số điện thoại (ít nhất 9 số) để được gọi lại.";
    case "mang":
      return `Chưa gửi được — máy chưa có sóng. Thử lại lúc có sóng, hoặc gọi thẳng ${unit}.`;
    case "may-chu":
      return `Chưa gửi được lúc này — bên nhận đang trục trặc. Bà con thử lại sau ít phút, hoặc gọi thẳng ${unit}.`;
  }
}
