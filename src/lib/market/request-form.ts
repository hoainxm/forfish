// FORM "ĐẶT MÓN KHÔNG CÓ TRÊN CHỢ" — LỖI THEO Ô + NHÁP (VT-11, rà FB 2026-10-25).
//
// Vì sao có: `validateRequestDraft` (validate.ts) trả MỘT câu cho cả form — đúng
// vai cổng cuối (server là chốt), nhưng vẽ ở trang thì câu "Ghi tên món…" nằm
// trên nút Gửi, cách ô sai nửa màn. FB/Shopee: ô sai đỏ viền + câu ngay dưới +
// cuộn tới. Hàm ở đây chia cùng luật ấy ra TỪNG Ô (câu chép nguyên 11 §3 để một
// lỗi không có hai cách nói); cổng cuối vẫn là `validateRequestDraft` trước khi gửi.
//
// NHÁP: `sessionStorage` (khuôn `list-state`) — gõ dở rồi chạm ‹ hay lỡ sang màn
// khác, quay lại còn chữ. Chỉ MỘT phiên: mở app lần sau là form mới; không đụng
// khoá `forfish.*` nào đang có (khoá riêng). Ghi hỏng thì im: mất nháp không mất
// gì của bà con.
import type { PaymentMethod } from "./types";
import { REQUEST_QTY_MAX } from "./validate";

/** Chữ đang gõ trong form — giữ dạng chuỗi như ô nhập (qty "12", không phải 12). */
export type RequestFormDraft = {
  title: string;
  qty: string;
  unit: string;
  description: string;
  needBy: string;
  pay: PaymentMethod;
};

export type RequestFieldKey = "title" | "qty" | "unit" | "needBy";
export type RequestFieldErrors = Partial<Record<RequestFieldKey, string>>;

/** Thứ tự ô trên màn — ô ĐẦU sai là ô được focus/cuộn tới. */
export const REQUEST_FIELD_ORDER: readonly RequestFieldKey[] = ["title", "qty", "unit", "needBy"];

/** Đủ để bật nút Gửi: có tên món (≥3 chữ sau trim). Các ô khác báo lúc bấm. */
export function duDeGui(title: string): boolean {
  return title.trim().length >= 3;
}

/** Lỗi theo ô — câu CHÉP NGUYÊN từ `validateRequestDraft` (11 §3). Rỗng = không ô nào sai. */
export function loiTungO(d: RequestFormDraft, today: string): RequestFieldErrors {
  const loi: RequestFieldErrors = {};
  const t = d.title.trim().length;
  if (t < 3 || t > 120) loi.title = "Ghi tên món cần đặt (3–120 chữ).";
  const q = /^\d+$/.test(d.qty.trim()) ? Number(d.qty.trim()) : NaN;
  if (!Number.isInteger(q) || q < 1 || q > REQUEST_QTY_MAX) loi.qty = "Số lượng từ 1 đến 9999.";
  const u = d.unit.trim().length;
  if (u < 1 || u > 20) loi.unit = "Ghi đơn vị (cái, bộ, thùng…).";
  if (d.needBy !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(d.needBy) || d.needBy < today)) {
    loi.needBy = "Ngày cần hàng không được trước hôm nay.";
  }
  return loi;
}

/** Ô đầu tiên (theo thứ tự màn) đang sai, hoặc null. */
export function oDauSai(loi: RequestFieldErrors): RequestFieldKey | null {
  return REQUEST_FIELD_ORDER.find((k) => loi[k]) ?? null;
}

/** Đã gõ gì khác bản đầu chưa — để ‹ hỏi "Bỏ phần đang ghi?" đúng lúc. */
export function coChuMoi(d: RequestFormDraft, goc: RequestFormDraft): boolean {
  return (Object.keys(goc) as (keyof RequestFormDraft)[]).some((k) => d[k] !== goc[k]);
}

const KHOA = "forfish.yeucau-nhap.v1";

function kho(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // Safari riêng tư có thể ném ngay khi chạm
  }
}

/** Ghi nháp. `false` khi máy không giữ được — nơi gọi không cần báo. */
export function luuNhapYeuCau(d: RequestFormDraft): boolean {
  const s = kho();
  if (!s) return false;
  try {
    s.setItem(KHOA, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

const PAY: readonly PaymentMethod[] = ["cod", "chuyen_khoan"];

/** Đọc nháp còn trong phiên; hỏng/thiếu trường ⇒ null (không nhả bản méo vào form). */
export function docNhapYeuCau(): RequestFormDraft | null {
  const s = kho();
  if (!s) return null;
  try {
    const raw = s.getItem(KHOA);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Record<keyof RequestFormDraft, unknown>> | null;
    if (!v || typeof v !== "object") return null;
    const chuoi = (x: unknown) => (typeof x === "string" ? x : null);
    const title = chuoi(v.title), qty = chuoi(v.qty), unit = chuoi(v.unit), description = chuoi(v.description), needBy = chuoi(v.needBy);
    if (title == null || qty == null || unit == null || description == null || needBy == null) return null;
    const pay = PAY.includes(v.pay as PaymentMethod) ? (v.pay as PaymentMethod) : "cod";
    return { title, qty, unit, description, needBy, pay };
  } catch {
    return null;
  }
}

/** Xoá nháp — gửi xong, hay bà con chọn Bỏ. */
export function xoaNhapYeuCau(): void {
  const s = kho();
  if (!s) return;
  try {
    s.removeItem(KHOA);
  } catch {
    /* không xoá được thì thôi — chỉ sống trong phiên */
  }
}
