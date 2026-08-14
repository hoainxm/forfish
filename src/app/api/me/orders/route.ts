// /api/me/orders — ĐƠN của CHỦ TÀU (2026-08-11).
//   POST: đặt đơn từ giỏ. Server TRA giá từ product_listings hiện tại và tính
//         lại tổng — KHÔNG tin giá client gửi. Chỉ nhận món orderable+visible.
//   GET:  danh sách đơn của chính người gọi (tự lọc theo SĐT từ device token).
//
// Định danh qua identityFromRequest (device token, KHÔNG auth.uid — 0026/0028).
// Ghi/đọc bằng service-role; bảng catalog_orders KHÔNG có RLS policy (0033).
// Online-only — SW bỏ qua POST, client tự báo lỗi khi mất mạng.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityFromRequest } from "@/lib/api-identity";
import { normalizeVnPhone } from "@/lib/phone";
import { rowToListing } from "@/lib/product-catalog";
import {
  buildOrderLines,
  computeOrderTotal,
  rowToOrder,
  validateOrderDraft,
  type OrderDraft,
} from "@/lib/catalog-orders";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

const LISTING_COLS =
  "id,vendor_kind,vendor_name,title,category,description,features,price_text,image_url,contact_phone,contact_note,line,group,price_vnd,unit,orderable,visible,sort_order,created_at";

const ORDER_COLS =
  "id,customer_phone,boat_name,boat_ref,items,total_vnd,delivery_location,contact_name,contact_phone,note,status,handled_by,handled_at,dealer_note,created_at,updated_at";

export async function POST(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!who.phone) return err(401, "login_required");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as OrderDraft | null;
  if (!body) return err(400, "bad_body");
  const draft: OrderDraft = {
    items: Array.isArray(body.items) ? body.items : [],
    boatName: body.boatName,
    boatRef: body.boatRef,
    deliveryLocation: body.deliveryLocation,
    contactName: body.contactName,
    contactPhone: body.contactPhone ?? "",
    note: body.note,
  };
  const invalid = validateOrderDraft(draft);
  if (invalid) return err(400, "invalid_draft");

  // Tra danh mục THẬT theo id trong giỏ — giá lấy từ đây, không tin client.
  const ids = draft.items.map((i) => i.listingId);
  const { data: rows, error: qErr } = await admin
    .from("product_listings")
    .select(LISTING_COLS)
    .in("id", ids);
  if (qErr) return err(500, "query_failed");

  const catalog = (rows ?? []).map((r) =>
    rowToListing(r as Parameters<typeof rowToListing>[0]),
  );
  const { lines } = buildOrderLines(draft.items, catalog);
  if (lines.length === 0) return err(409, "items_unavailable");
  const total = computeOrderTotal(lines);

  const { data, error } = await admin
    .from("catalog_orders")
    .insert({
      customer_phone: who.phone,
      boat_name: draft.boatName?.trim() || null,
      boat_ref: draft.boatRef?.trim() || null,
      items: lines,
      total_vnd: total,
      delivery_location: draft.deliveryLocation?.trim() || null,
      contact_name: draft.contactName?.trim() || null,
      contact_phone: normalizeVnPhone(draft.contactPhone),
      note: draft.note?.trim() || null,
      status: "moi",
    })
    .select("id")
    .maybeSingle();
  if (error) return err(500, "insert_failed");

  return NextResponse.json({ ok: true, id: data?.id, totalVnd: total });
}

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!who.phone) return err(401, "login_required");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from("catalog_orders")
    .select(ORDER_COLS)
    .eq("customer_phone", who.phone)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return err(500, "query_failed");

  const orders = (data ?? []).map((r) =>
    rowToOrder(r as Parameters<typeof rowToOrder>[0]),
  );
  return NextResponse.json({ ok: true, orders });
}
