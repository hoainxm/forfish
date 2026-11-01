// Webhook SDWork → SDFish: verify chữ ký HMAC (logic thuần, server-only) +
// chuẩn hoá payload sự kiện thành hàng bảng SDFish. Idempotent theo sdwork_ref.
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeVnPhone } from "@/lib/phone";

/** Verify HMAC SHA-256 hex của raw body với secret (so an toàn thời gian). */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHex: string,
  secret: string,
): boolean {
  if (!secret || !signatureHex) return false;
  const want = createHmac("sha256", secret).update(rawBody).digest();
  let got: Buffer;
  try {
    got = Buffer.from(signatureHex, "hex");
  } catch {
    return false;
  }
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── Shape sự kiện (hợp đồng với SDWork — xem docs/integration/sdwork-sso-contract.md) ──
// "payment"/"reconciled" (2026-07-30, ba-spec 10 NV5): SDWork đối chiếu sao kê
// xong bắn về xác nhận đã nhận tiền theo MÃ CK (ref=code) → SDFish set
// payments.reconciled_status='reconciled'. Xử riêng ở route (không qua TABLE map).
export type WebhookEntity = "customer" | "device" | "supply" | "payment";
export type WebhookAction = "upsert" | "delete" | "reconciled";

export interface WebhookEvent {
  entity: WebhookEntity;
  action: WebhookAction;
  /** khoá đối chiếu nguồn (id bên SDWork) — bắt buộc, để idempotent */
  ref: string;
  data: Record<string, unknown>;
}

export interface CustomerRow {
  phone: string;
  name: string | null;
  sdwork_ref: string;
  /** Hạng tài khoản — CHỈ có mặt khi event gửi tier hợp lệ; vắng mặt thì
   *  upsert KHÔNG đụng hạng hiện có (admin gán tay không bị webhook ghi đè). */
  tier?: "basic" | "premium";
  /** Hạn premium (đi kèm tier) — null = không hạn. */
  premium_until?: string | null;
}
export interface DeviceRow {
  customer_phone: string;
  name: string;
  serial: string | null;
  model: string | null;
  purchased_on: string | null;
  warranty_until: string | null;
  order_code: string | null;
  sdwork_ref: string;
}
export interface SupplyRow {
  customer_phone: string;
  name: string;
  qty: number | null;
  unit: string | null;
  order_code: string | null;
  sdwork_ref: string;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export function toCustomerRow(e: WebhookEvent): CustomerRow | null {
  const phone = str(e.data.phone);
  if (!phone) return null;
  const row: CustomerRow = {
    phone: normalizeVnPhone(phone),
    name: str(e.data.name),
    sdwork_ref: e.ref,
  };
  // tier là optional trong event: chỉ 'basic'/'premium' mới được nhận, giá trị
  // lạ coi như KHÔNG gửi (không hạ nhầm hạng vì SDWork gửi sai chữ).
  const tier = str(e.data.tier);
  if (tier === "basic" || tier === "premium") {
    row.tier = tier;
    row.premium_until = str(e.data.premiumUntil);
  }
  return row;
}

export function toDeviceRow(e: WebhookEvent): DeviceRow | null {
  const phone = str(e.data.customerPhone ?? e.data.phone);
  const name = str(e.data.name);
  if (!phone || !name) return null;
  return {
    customer_phone: normalizeVnPhone(phone),
    name,
    serial: str(e.data.serial),
    model: str(e.data.model),
    purchased_on: str(e.data.purchasedOn),
    warranty_until: str(e.data.warrantyUntil),
    order_code: str(e.data.orderCode),
    sdwork_ref: e.ref,
  };
}

/**
 * Ý định đồng bộ mật khẩu từ một customer event (đăng nhập 2 app dùng chung 1
 * credential). `password` = mật khẩu kèm theo (nếu có). `reset` = SDWork YÊU CẦU
 * đặt lại (đổi mật khẩu hiện hữu); khác provision lần đầu vốn KHÔNG ghi đè để
 * tránh xoá mật khẩu KH tự đổi. Reset chỉ khi `resetPassword === true`.
 */
export function passwordSyncIntent(e: WebhookEvent): {
  password: string | null;
  reset: boolean;
} {
  if (e.entity !== "customer") return { password: null, reset: false };
  const password =
    typeof e.data.password === "string" && e.data.password
      ? e.data.password
      : null;
  return { password, reset: e.data.resetPassword === true };
}

// ── Khách TRÙNG SĐT (2026-10-31) ──
// `customers` có HAI khoá duy nhất: phone VÀ sdwork_ref. Upsert theo sdwork_ref
// chỉ thấy hàng cùng mã; khách tạo tay ở /quan-tri (admin/accounts upsert theo
// phone, KHÔNG có mã) đứng sẵn với cùng SĐT ⇒ upsert thành INSERT ⇒ 23505 trên
// customers_phone_key ⇒ `upsert_failed` mãi (đo 31/10: 865 event dead + 134/139
// khách đang chờ — 133 trùng SĐT mã NULL, 1 trùng SĐT mã khác).

/** Lỗi upsert là do SĐT đã thuộc một hàng khác (khoá customers_phone_key)? */
export function isPhoneTaken(
  err: { code?: string | null; message?: string | null; details?: string | null } | null,
): boolean {
  if (!err || err.code !== "23505") return false;
  const text = `${err.message ?? ""} ${err.details ?? ""}`;
  return /customers_phone_key|\(phone\)/.test(text);
}

/**
 * Hàng đang giữ SĐT chưa có mã SDWork ⇒ cùng một khách, NHẬN về (gắn mã vào
 * hàng đó). Đã mang mã KHÁC ⇒ hai khách CRM cùng một SĐT ⇒ KHÔNG ghi đè, báo
 * `phone_conflict` để người xử lý tay. Không tìm thấy hàng ⇒ cũng conflict
 * (không đoán).
 */
export function planPhoneClaim(
  holder: { id: string; sdwork_ref: string | null } | null,
): { kind: "claim"; id: string } | { kind: "conflict" } {
  return holder && holder.sdwork_ref == null
    ? { kind: "claim", id: holder.id }
    : { kind: "conflict" };
}

export function toSupplyRow(e: WebhookEvent): SupplyRow | null {
  const phone = str(e.data.customerPhone ?? e.data.phone);
  const name = str(e.data.name);
  if (!phone || !name) return null;
  const qtyRaw = e.data.qty;
  return {
    customer_phone: normalizeVnPhone(phone),
    name,
    qty: typeof qtyRaw === "number" && Number.isFinite(qtyRaw) ? qtyRaw : null,
    unit: str(e.data.unit),
    order_code: str(e.data.orderCode),
    sdwork_ref: e.ref,
  };
}
