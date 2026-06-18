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
export type WebhookEntity = "customer" | "device" | "supply";
export type WebhookAction = "upsert" | "delete";

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
  return { phone: normalizeVnPhone(phone), name: str(e.data.name), sdwork_ref: e.ref };
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
