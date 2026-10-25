// MÁY TRẠNG THÁI ĐƠN của Chợ vật tư — THUẦN, nguồn DUY NHẤT của luật chuyển
// và tác dụng phụ (11 §4). Adapter chỉ ghi patch do đây dựng; route chỉ gọi.
import type { OrderPatch } from "./store";
import type {
  Actor, Order, OrderStatus, PaymentMethod, PaymentStatus, TimelineBy,
} from "./types";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "cho_xac_nhan", "da_xac_nhan", "dang_giao", "da_giao", "hoan_thanh", "da_huy",
] as const;
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  cho_xac_nhan: "Chờ xác nhận",
  da_xac_nhan: "Đã xác nhận",
  dang_giao: "Đang giao",
  da_giao: "Đã giao",
  hoan_thanh: "Hoàn thành",
  da_huy: "Đã huỷ",
};
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  chua_thanh_toan: "Chưa thanh toán",
  bao_da_chuyen: "Đã báo chuyển — chờ shop xác nhận",
  da_thanh_toan: "Đã thanh toán",
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: "Trả tiền khi nhận hàng",
  chuyen_khoan: "Chuyển khoản",
};
/** Chip theo 03 §"Đặt hàng": cặp token nền/chữ — KHÔNG hex. */
export const ORDER_STATUS_CHIP: Record<OrderStatus, { bg: string; fg: string }> = {
  cho_xac_nhan: { bg: "var(--field)", fg: "var(--navy)" },
  da_xac_nhan: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  dang_giao: { bg: "var(--sea)", fg: "var(--card)" },
  da_giao: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  hoan_thanh: { bg: "var(--ok)", fg: "var(--card)" },
  da_huy: { bg: "var(--danger-bg)", fg: "var(--danger)" },
};
export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}
export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return v === "chua_thanh_toan" || v === "bao_da_chuyen" || v === "da_thanh_toan";
}
export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "cod" || v === "chuyen_khoan";
}

/** Đơn đã KẾT THÚC — không còn việc gì để làm (huỷ hoặc xong). */
export const ENDED_STATUSES: readonly OrderStatus[] = ["da_huy", "hoan_thanh"] as const;
export function isEnded(status: OrderStatus): boolean {
  return (ENDED_STATUSES as readonly string[]).includes(status);
}
/**
 * "BÁO ĐÃ CK" — tiền khách nói đã chuyển mà shop chưa xác nhận, đơn còn sống (BH-08, 2026-10-25).
 * MỘT hàm cho cả ô đếm ở Tổng quan lẫn lọc danh sách `?tt=bao_da_chuyen` — trước đây hai chỗ hai
 * điều kiện nên "ô nói 2 mà tab mở ra trống".
 */
export function choXacNhanTien(o: Pick<Order, "paymentMethod" | "paymentStatus" | "status">): boolean {
  return o.paymentMethod === "chuyen_khoan" && o.paymentStatus === "bao_da_chuyen" && !isEnded(o.status);
}

/** Bảng chuyển hợp lệ theo ACTOR (một chiều, không quay lui) — 11 §4.1. Admin = mọi việc seller làm được + huỷ tới dang_giao (LEAD §4 #2). */
export const TRANSITIONS: Record<OrderStatus, Partial<Record<Actor, OrderStatus[]>>> = {
  // system: TỰ HUỶ khi shop không xác nhận sau AUTO_CANCEL_MS (kiểu Shopee, 2026-10-18)
  cho_xac_nhan: { seller: ["da_xac_nhan", "da_huy"], admin: ["da_xac_nhan", "da_huy"], buyer: ["da_huy"], system: ["da_huy"] },
  da_xac_nhan:  { seller: ["dang_giao", "da_huy"],   admin: ["dang_giao", "da_huy"] },
  dang_giao:    { seller: ["da_giao"],               admin: ["da_giao", "da_huy"] },
  da_giao:      { buyer: ["hoan_thanh"],             admin: ["hoan_thanh"], system: ["hoan_thanh"] },
  hoan_thanh:   {},
  da_huy:       {},
};
export function canTransitionOrder(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return (TRANSITIONS[from]?.[actor] ?? []).includes(to);
}
/** Huỷ cần lý do khi actor là seller/admin (buyer không bắt buộc). */
export function cancelNeedsReason(actor: Actor): boolean {
  return actor === "seller" || actor === "admin";
}

/** Chuyển thanh toán (11 §4.1 P1–P3):
 *  buyer:  chua_thanh_toan → bao_da_chuyen   (chỉ chuyen_khoan; status ∉ {da_huy, hoan_thanh})
 *  seller/admin: bao_da_chuyen → da_thanh_toan (P2 "Đã nhận tiền") · chua_thanh_toan → da_thanh_toan (nhận tiền không qua báo)
 *                bao_da_chuyen → chua_thanh_toan (P3 "Chưa thấy tiền", note BẮT BUỘC 5..200)
 *  COD: buyer KHÔNG bấm gì; da_thanh_toan tự đặt khi hoan_thanh. */
export function canTransitionPayment(
  o: Pick<Order, "paymentMethod" | "paymentStatus" | "status">,
  to: PaymentStatus,
  actor: Actor,
): boolean {
  if (o.status === "da_huy" || o.status === "hoan_thanh") return false;
  const from = o.paymentStatus;
  if (actor === "buyer") {
    return o.paymentMethod === "chuyen_khoan" && from === "chua_thanh_toan" && to === "bao_da_chuyen";
  }
  if (actor === "seller" || actor === "admin") {
    if (to === "da_thanh_toan") return from === "bao_da_chuyen" || from === "chua_thanh_toan";
    if (to === "chua_thanh_toan") return from === "bao_da_chuyen";
    return false;
  }
  return false;
}

/** Nhãn `by` cho timeline: admin ⇒ `admin:<sđt>` (LEAD §4 #2), còn lại = actor. */
export function timelineBy(actor: Actor, actorPhone?: string): TimelineBy {
  return actor === "admin" ? `admin:${actorPhone ?? ""}` : actor;
}

/**
 * Dựng OrderPatch cho một cú chuyển TRẠNG THÁI ĐƠN — NGUỒN DUY NHẤT của tác dụng phụ:
 *  · da_giao    ⇒ deliveredAt = nowIso
 *  · hoan_thanh ⇒ completedAt = nowIso; paymentMethod=cod ⇒ paymentStatus = da_thanh_toan
 *  · da_huy     ⇒ cancelBy = actor, cancelReason = note (bắt buộc khi cancelNeedsReason);
 *                 needsRefund = paymentMethod=chuyen_khoan ∧ paymentStatus ∈ {bao_da_chuyen, da_thanh_toan} (LEAD §4 #7 — KHÔNG phụ thuộc actor)
 *  · luôn timelineAppend {status:to, at:nowIso, by:timelineBy(actor, actorPhone), note}
 * KHÔNG đụng soldCount (cộng lúc đặt, trừ khi hoàn kho — §2). Trả null khi không được phép.
 */
export function applyTransition(
  o: Order,
  to: OrderStatus,
  actor: Actor,
  note: string | undefined,
  nowIso: string,
  actorPhone?: string,
): OrderPatch | null {
  if (!canTransitionOrder(o.status, to, actor)) return null;
  const n = note?.trim() || undefined;
  const patch: OrderPatch = {
    status: to,
    timelineAppend: { status: to, at: nowIso, by: timelineBy(actor, actorPhone), ...(n ? { note: n } : {}) },
  };
  if (to === "da_giao") patch.deliveredAt = nowIso;
  if (to === "hoan_thanh") {
    patch.completedAt = nowIso;
    if (o.paymentMethod === "cod") patch.paymentStatus = "da_thanh_toan";
  }
  if (to === "da_huy") {
    if (cancelNeedsReason(actor) && !n) return null;
    patch.cancelBy = actor;
    if (n) patch.cancelReason = n;
    patch.needsRefund =
      o.paymentMethod === "chuyen_khoan" &&
      (o.paymentStatus === "bao_da_chuyen" || o.paymentStatus === "da_thanh_toan");
  }
  return patch;
}

/** Như trên cho THANH TOÁN: patch {paymentStatus, timelineAppend{status:to,…}}; P3 thiếu note ⇒ null. */
export function applyPaymentTransition(
  o: Order,
  to: PaymentStatus,
  actor: Actor,
  note: string | undefined,
  nowIso: string,
  actorPhone?: string,
): OrderPatch | null {
  if (!canTransitionPayment(o, to, actor)) return null;
  const n = note?.trim() || undefined;
  // P3 "Chưa thấy tiền": bao_da_chuyen → chua_thanh_toan bắt buộc lý do
  if (to === "chua_thanh_toan" && o.paymentStatus === "bao_da_chuyen" && !n) return null;
  return {
    paymentStatus: to,
    timelineAppend: { status: to, at: nowIso, by: timelineBy(actor, actorPhone), ...(n ? { note: n } : {}) },
  };
}

/** Buyer được đánh giá món này? = đơn hoan_thanh + món có trong items + chưa có review (reviewedProductIds do route đưa). */
export function canReview(o: Order, productId: string, reviewedProductIds: string[]): boolean {
  if (o.status !== "hoan_thanh") return false;
  if (!o.items.some((l) => l.productId === productId)) return false;
  return !reviewedProductIds.includes(productId);
}

/**
 * TỰ HOÀN THÀNH LƯỜI — LEAD §4 #3 / §5 #6, KHÔNG cron.
 * Đơn da_giao có deliveredAt và (nowIso − deliveredAt) ≥ 7 × 24 giờ ⇒ patch = applyTransition(o, "hoan_thanh", "system",
 * "Tự hoàn thành sau 7 ngày", <deliveredAt + 7 ngày>) — completedAt/at lấy MỐC ĐẾN HẠN, không lấy giờ đọc, để doanh
 * thu rơi đúng ngày dù ai đọc lúc nào. Không đủ điều kiện ⇒ null. Chạy ở MỌI route đọc đơn/thống kê qua
 * `settleOverdueOrders` (route-utils.ts §7).
 */
export const AUTO_COMPLETE_MS = 7 * 24 * 3600 * 1000;
export function settleOverdue(o: Order, nowIso: string): OrderPatch | null {
  if (o.status === "cho_xac_nhan") return settlePending(o, nowIso);
  if (o.status !== "da_giao" || !o.deliveredAt) return null;
  const delivered = Date.parse(o.deliveredAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(delivered) || !Number.isFinite(now)) return null;
  if (now - delivered < AUTO_COMPLETE_MS) return null;
  const due = new Date(delivered + AUTO_COMPLETE_MS).toISOString();
  return applyTransition(o, "hoan_thanh", "system", "Tự hoàn thành sau 7 ngày", due);
}
/** Đơn cho_xac_nhan quá 48 giờ — chỉ để hiện nhắc (11 §4.3), không đổi trạng thái. */
export const PENDING_WARN_MS = 48 * 3600 * 1000;
export function isPendingTooLong(o: Pick<Order, "status" | "createdAt">, nowIso: string): boolean {
  if (o.status !== "cho_xac_nhan") return false;
  const c = Date.parse(o.createdAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(c) || !Number.isFinite(now)) return false;
  return now - c >= PENDING_WARN_MS;
}

/**
 * TỰ HUỶ ĐƠN SHOP KHÔNG XÁC NHẬN (2026-10-18, chủ dự án: "luồng giống Shopee"). Đơn cho_xac_nhan quá
 * AUTO_CANCEL_MS ⇒ system huỷ, hoàn kho (transitionOrder lo), lý do nói rõ cho cả hai bên. Mốc ghi = lúc ĐẾN HẠN
 * (createdAt + 72 giờ) như settleOverdue, không phải lúc ai đó mở màn. 48 giờ vẫn chỉ NHẮC (isPendingTooLong).
 * Chạy lười ở mọi route đọc đơn (settleOverdueOrders) — không cron.
 */
export const AUTO_CANCEL_MS = 72 * 3600 * 1000;
export const AUTO_CANCEL_REASON = "Shop chưa xác nhận sau 3 ngày — đơn tự huỷ";
export function settlePending(o: Order, nowIso: string): OrderPatch | null {
  if (o.status !== "cho_xac_nhan") return null;
  const c = Date.parse(o.createdAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(c) || !Number.isFinite(now) || now - c < AUTO_CANCEL_MS) return null;
  return applyTransition(o, "da_huy", "system", AUTO_CANCEL_REASON, new Date(c + AUTO_CANCEL_MS).toISOString());
}
/** Còn bao lâu nữa đơn chờ tự huỷ (ms, ≥0) — để màn chủ shop đếm ngược; null nếu không ở chờ xác nhận. */
export function msUntilAutoCancel(o: Pick<Order, "status" | "createdAt">, nowIso: string): number | null {
  if (o.status !== "cho_xac_nhan") return null;
  const c = Date.parse(o.createdAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(c) || !Number.isFinite(now)) return null;
  return Math.max(0, c + AUTO_CANCEL_MS - now);
}
