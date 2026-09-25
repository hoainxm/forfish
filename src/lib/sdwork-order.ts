// SDFish → SDWork: tạo ĐƠN MUA (Edge Function `sdfish-order`, action "create").
// SERVER ONLY (giữ shared secret). Mirror đúng khuôn `lib/renewal.ts`:
//   - gác bằng shared secret header `x-sdfish-secret` (function verify_jwt=false)
//   - KHÔNG gửi apikey/Authorization (nếu gửi, Supabase edge chặn 401 "Invalid
//     API key" TRƯỚC khi tới function — bài học renewal).
//
// PHASE 1 (chủ dự án + SDWork chốt 2026-09-25):
//   - Response lúc tạo: { ok, displayRef:"SDF-xxxxxx", status:"pending" }. CHƯA
//     có mã DH (sinh khi kinh doanh DUYỆT — về ở phase 2 qua webhook).
//   - Gửi TÊN sản phẩm dạng text (kinh doanh gán SKU + báo giá lúc duyệt); qty=1,
//     giá để trống. externalRef BẮT BUỘC (idempotent — gửi trùng ref → đơn cũ).
//
// Helper `buildOrderPayload` THUẦN (test được). Cấu hình:
//   SDFISH_ORDER_SECRET (bắt buộc) · SDFISH_ORDER_URL (tuỳ chọn — full URL cho
//   sandbox; trống thì suy từ SDWORK_SUPABASE_URL + /functions/v1/sdfish-order).

import { timeoutSignal } from "@/lib/abort";

const CRM_BASE = process.env.SDWORK_SUPABASE_URL ?? "";
const ORDER_SECRET = process.env.SDFISH_ORDER_SECRET ?? "";
/** Full URL của function (ưu tiên) — cho sandbox trỏ project/URL khác. */
const ORDER_URL =
  process.env.SDFISH_ORDER_URL ||
  (CRM_BASE ? `${CRM_BASE}/functions/v1/sdfish-order` : "");

export function isOrderConfigured(): boolean {
  return Boolean(ORDER_URL && ORDER_SECRET);
}

/** Một dòng hàng gửi sang CRM. Phase 1: sku/unitPriceVnd để trống. */
export interface OrderItemInput {
  productName: string;
  sku?: string | null;
  qty: number;
  unitPriceVnd?: number | null;
}

export interface SdfishOrderInput {
  /** BẮT BUỘC — id ổn định của yêu cầu để idempotent (gửi trùng → đơn cũ). */
  externalRef: string;
  fullName: string;
  phone: string; // đã chuẩn hoá 0xxxxxxxxx
  items: OrderItemInput[];
  note?: string | null;
  deliveryAddress?: string | null;
}

/** Kết quả tạo đơn (phase 1). */
export interface SdfishOrderResult {
  ok: boolean;
  /** SDF-xxxxxx — mã hiển thị cho ngư dân (chờ duyệt). */
  displayRef?: string;
  /** "pending" lúc tạo. */
  status?: string;
  /** mã lỗi khi !ok */
  code?: string;
}

/** Ráp payload gửi function `sdfish-order` — THUẦN (test được). */
export function buildOrderPayload(input: SdfishOrderInput): Record<string, unknown> {
  return {
    action: "create",
    source: "sdfish",
    externalRef: input.externalRef,
    customer: { fullName: input.fullName, phone: input.phone },
    items: input.items.map((it) => ({
      productName: it.productName,
      sku: it.sku ?? null,
      qty: Number.isFinite(it.qty) && it.qty > 0 ? Math.round(it.qty) : 1,
      unitPriceVnd:
        typeof it.unitPriceVnd === "number" && it.unitPriceVnd > 0
          ? Math.round(it.unitPriceVnd)
          : null,
    })),
    note: input.note?.trim() || null,
    deliveryAddress: input.deliveryAddress?.trim() || null,
  };
}

/**
 * Gọi function tạo đơn. Server-only. Lỗi nào cũng trả `ok:false` (không ném).
 */
export async function createSdfishOrder(
  input: SdfishOrderInput,
): Promise<SdfishOrderResult> {
  if (!isOrderConfigured()) return { ok: false, code: "not_configured" };
  try {
    const r = await fetch(ORDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Gác THẬT: shared secret. KHÔNG gửi apikey/Authorization (verify_jwt=false).
        "x-sdfish-secret": ORDER_SECRET,
      },
      body: JSON.stringify(buildOrderPayload(input)),
      signal: timeoutSignal(20000),
    });
    const j = (await r.json().catch(() => null)) as {
      ok?: boolean;
      displayRef?: string;
      status?: string;
      code?: string;
    } | null;
    if (!r.ok || !j?.ok) {
      return { ok: false, code: j?.code || `http_${r.status}` };
    }
    return { ok: true, displayRef: j.displayRef, status: j.status };
  } catch {
    return { ok: false, code: "service_unavailable" };
  }
}
