// YÊU CẦU ĐẶT HÀNG — "đặt bất kỳ cái gì" (2026-10-18, chủ dự án: "cho phép chủ tàu đặt đơn
// bất kỳ cái gì, nó sẽ chuyển cho chủ sàn"). THUẦN, nguồn DUY NHẤT của luật chuyển.
//
// Luồng: chủ tàu ghi món cần (chữ/giọng nói, kèm ảnh) → CHỦ SÀN (admin /quan-tri) tìm hàng,
// BÁO GIÁ (tiền hàng + phí giao + hẹn giao + shop lo hàng) hoặc báo KHÔNG TÌM ĐƯỢC → chủ tàu
// ĐỒNG Ý ⇒ sinh một ĐƠN thường (shop đã chọn, đã xác nhận sẵn kèm hẹn giao) đi tiếp luồng đơn
// (đang giao → đã giao → hoàn thành) như mọi đơn. Báo giá giữ 3 ngày; yêu cầu không ai trả lời
// 7 ngày tự hết hạn — chạy lười khi đọc, không cron (khuôn settleOverdue).
import { timelineBy } from "./order-state";
import type { Actor, BankInfo, MarketRequest, OrderLine, RequestQuote, RequestStatus, RequestTimelineEntry, TimelineEntry } from "./types";

export const REQUEST_STATUSES: readonly RequestStatus[] = ["moi", "da_bao_gia", "da_dat", "khong_tim_duoc", "da_huy", "het_han"];
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  moi: "Chờ chủ sàn báo giá",
  da_bao_gia: "Đã có báo giá",
  da_dat: "Đã đặt hàng",
  khong_tim_duoc: "Không tìm được hàng",
  da_huy: "Đã huỷ",
  het_han: "Hết hạn",
};
/** cặp token nền/chữ — KHÔNG hex (03 §"Đặt hàng") */
export const REQUEST_STATUS_CHIP: Record<RequestStatus, { bg: string; fg: string }> = {
  moi: { bg: "var(--field)", fg: "var(--navy)" },
  da_bao_gia: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  da_dat: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  khong_tim_duoc: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  da_huy: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  het_han: { bg: "var(--field)", fg: "var(--muted)" },
};
export function isRequestStatus(v: unknown): v is RequestStatus {
  return typeof v === "string" && (REQUEST_STATUSES as readonly string[]).includes(v);
}

export const QUOTE_VALID_MS = 3 * 24 * 3600 * 1000;
export const REQUEST_IDLE_MS = 7 * 24 * 3600 * 1000;
export const REQUEST_IDLE_REASON = "Chủ sàn chưa trả lời sau 7 ngày — bà con gửi lại giúp";
export const QUOTE_EXPIRED_REASON = "Báo giá quá 3 ngày chưa đồng ý — hết hạn";

/** Vá một yêu cầu — adapter chỉ ghi đúng trường có mặt (khuôn OrderPatch). */
export interface RequestPatch {
  status?: RequestStatus;
  quote?: RequestQuote;
  quoteShopId?: string;
  rejectReason?: string;
  orderId?: string;
  timelineAppend?: RequestTimelineEntry;
}

/** Ai được đi từ đâu tới đâu. Admin báo giá lại được khi đang có báo giá (sửa giá). */
const TRANSITIONS: Record<RequestStatus, Partial<Record<Actor, RequestStatus[]>>> = {
  moi: { admin: ["da_bao_gia", "khong_tim_duoc"], buyer: ["da_huy"], system: ["het_han"] },
  da_bao_gia: { admin: ["da_bao_gia", "khong_tim_duoc"], buyer: ["da_dat", "da_huy"], system: ["het_han"] },
  da_dat: {},
  khong_tim_duoc: {},
  da_huy: {},
  het_han: {},
};
export function canRequestTransition(from: RequestStatus, to: RequestStatus, actor: Actor): boolean {
  return (TRANSITIONS[from]?.[actor] ?? []).includes(to);
}

const entry = (status: RequestStatus, nowIso: string, actor: Actor, actorPhone?: string, note?: string): RequestTimelineEntry => {
  const n = note?.trim();
  return { status, at: nowIso, by: timelineBy(actor, actorPhone), ...(n ? { note: n } : {}) };
};

/** Chủ sàn báo giá. Quote đã validate ở route (validateQuote). */
export function applyQuote(
  r: MarketRequest,
  q: Omit<RequestQuote, "quotedAt" | "expiresAt">,
  shopId: string,
  nowIso: string,
  actorPhone?: string,
): RequestPatch | null {
  if (!canRequestTransition(r.status, "da_bao_gia", "admin")) return null;
  const expiresAt = new Date(Date.parse(nowIso) + QUOTE_VALID_MS).toISOString();
  return {
    status: "da_bao_gia",
    quote: { ...q, quotedAt: nowIso, expiresAt },
    quoteShopId: shopId,
    timelineAppend: entry("da_bao_gia", nowIso, "admin", actorPhone, q.note),
  };
}

/** Chủ sàn báo không tìm được — bắt buộc lý do (bà con cần biết vì sao). */
export function applyReject(r: MarketRequest, reason: string, nowIso: string, actorPhone?: string): RequestPatch | null {
  const n = reason?.trim();
  if (!n || !canRequestTransition(r.status, "khong_tim_duoc", "admin")) return null;
  return { status: "khong_tim_duoc", rejectReason: n, timelineAppend: entry("khong_tim_duoc", nowIso, "admin", actorPhone, n) };
}

export function applyBuyerCancel(r: MarketRequest, note: string | undefined, nowIso: string): RequestPatch | null {
  if (!canRequestTransition(r.status, "da_huy", "buyer")) return null;
  return { status: "da_huy", timelineAppend: entry("da_huy", nowIso, "buyer", undefined, note) };
}

/** Đồng ý báo giá — chỉ khi còn hạn. orderId do adapter điền khi sinh đơn. */
export function applyAccept(r: MarketRequest, nowIso: string): RequestPatch | null {
  if (!canRequestTransition(r.status, "da_dat", "buyer") || !r.quote) return null;
  if (Date.parse(nowIso) >= Date.parse(r.quote.expiresAt)) return null;
  return { status: "da_dat", timelineAppend: entry("da_dat", nowIso, "buyer") };
}

/** Hết hạn lười: báo giá quá 3 ngày · yêu cầu mới quá 7 ngày. Mốc ghi = lúc ĐẾN HẠN. */
export function settleRequest(r: MarketRequest, nowIso: string): RequestPatch | null {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return null;
  if (r.status === "da_bao_gia" && r.quote) {
    const exp = Date.parse(r.quote.expiresAt);
    if (Number.isFinite(exp) && now >= exp)
      return { status: "het_han", timelineAppend: entry("het_han", new Date(exp).toISOString(), "system", undefined, QUOTE_EXPIRED_REASON) };
    return null;
  }
  if (r.status === "moi") {
    const c = Date.parse(r.createdAt);
    if (Number.isFinite(c) && now - c >= REQUEST_IDLE_MS)
      return { status: "het_han", timelineAppend: entry("het_han", new Date(c + REQUEST_IDLE_MS).toISOString(), "system", undefined, REQUEST_IDLE_REASON) };
  }
  return null;
}

export function quoteTotal(q: Pick<RequestQuote, "goodsVnd" | "shippingVnd">): number {
  return q.goodsVnd + q.shippingVnd;
}

/** Áp patch vào bản sao (adapter file + client lạc quan dùng chung, không ai tự viết lại). */
export function patchRequest(r: MarketRequest, p: RequestPatch, nowIso: string): MarketRequest {
  return {
    ...r,
    ...(p.status ? { status: p.status } : {}),
    ...(p.quote ? { quote: p.quote } : {}),
    ...(p.quoteShopId ? { quoteShopId: p.quoteShopId } : {}),
    ...(p.rejectReason ? { rejectReason: p.rejectReason } : {}),
    ...(p.orderId ? { orderId: p.orderId } : {}),
    timeline: p.timelineAppend ? [...r.timeline, p.timelineAppend] : r.timeline,
    updatedAt: nowIso,
  };
}

/** Đầu vào để adapter sinh ĐƠN từ yêu cầu đã đồng ý (khuôn PreparedShopOrder, nhưng không trừ kho). */
export interface PreparedRequestOrder {
  shopId: string;
  lines: OrderLine[];
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  bankSnapshot?: BankInfo;
  etaFrom: string;
  etaTo: string;
  buyerNote?: string;
  timeline: TimelineEntry[];
}

/**
 * Yêu cầu + báo giá ⇒ đơn: MỘT dòng hàng (productId = id yêu cầu — không trùng món nào nên hoàn kho
 * khi huỷ không đụng kho ai), shop = shop chủ sàn đã chọn, vào thẳng "đã xác nhận" kèm hẹn giao của
 * báo giá (chủ sàn đã nhận lời lúc báo giá — bắt shop bấm xác nhận lần nữa là thừa một bước).
 */
export function requestToOrder(r: MarketRequest, nowIso: string, bank?: BankInfo): PreparedRequestOrder | null {
  if (!r.quote || !r.quoteShopId) return null;
  const q = r.quote;
  const unitPrice = Math.max(1, Math.round(q.goodsVnd / Math.max(1, r.qty)));
  const note = [r.description?.trim(), q.note?.trim() ? `Chủ sàn: ${q.note.trim()}` : ""].filter(Boolean).join(" · ");
  return {
    shopId: r.quoteShopId,
    lines: [{ productId: r.id, title: r.title, unit: r.unit, priceVnd: unitPrice, qty: r.qty, lineTotalVnd: q.goodsVnd, ...(r.images[0] ? { image: r.images[0] } : {}) }],
    subtotalVnd: q.goodsVnd,
    shippingVnd: q.shippingVnd,
    totalVnd: quoteTotal(q),
    ...(r.paymentMethod === "chuyen_khoan" && bank ? { bankSnapshot: bank } : {}),
    etaFrom: q.etaFrom,
    etaTo: q.etaTo,
    ...(note ? { buyerNote: note.slice(0, 300) } : {}),
    timeline: [
      { status: "cho_xac_nhan", at: nowIso, by: "buyer", note: `Đặt từ yêu cầu ${r.code}` },
      { status: "da_xac_nhan", at: nowIso, by: "system", note: "Chủ sàn đã báo giá và hẹn giao" },
    ],
  };
}
