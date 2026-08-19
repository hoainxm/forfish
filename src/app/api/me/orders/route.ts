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

  const body = (await req.json().catch(() => null)) as
    | (OrderDraft & { clientRef?: unknown })
    | null;
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

  /*  ═══ CHỐNG ĐƠN TRÙNG ═══ (2026-08-16, thẩm định P1)

      Ca thật ở cảng 3G: đơn GHI ĐƯỢC nhưng phản hồi rơi mất, client hết 20 giây
      và báo "chưa gửi được", bà con bấm lại ⇒ hai đơn, giao hai lần, thu tiền
      hai lần. `clientRef` là mã của GIỎ (lib/cart.ts), giữ nguyên qua mọi lần
      bấm, nên `(customer_phone, client_ref)` nhận ra "vẫn là lần đặt đó".

      Trọng tài đặt ở DB (unique index, migration 0034) chứ không phải "đọc
      trước rồi ghi": hai cú bấm sát nhau chạy trên hai instance khác nhau thì
      đọc-rồi-ghi vẫn lọt cả hai.

      ĐƯỜNG LÙI KHI 0034 CHƯA APPLY: cột `client_ref` chưa có ⇒ insert kèm
      trường lạ sẽ hỏng ⇒ thử lại KHÔNG kèm trường đó. App chạy y như hôm nay
      (vẫn có thể trùng), không ai bị chặn đặt hàng vì một migration chưa duyệt. */
  const clientRef =
    typeof body.clientRef === "string" && body.clientRef.trim()
      ? body.clientRef.trim().slice(0, 64)
      : null;

  const coBan = {
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
  };

  /*  Cùng khuôn "ghi kèm cột có thể chưa apply" của `/api/me/heartbeat`: tách
      hàm nhận phần THÊM để kiểu của lời gọi không đổi theo nhánh. */
  const ghiDon = (them: Record<string, unknown>) =>
    admin
      .from("catalog_orders")
      .insert({ ...coBan, ...them })
      .select("id")
      .maybeSingle();

  let { data, error } = await ghiDon(
    clientRef ? { client_ref: clientRef } : {},
  );

  if (error && clientRef) {
    // 23505 = unique_violation ⇒ đơn của CHÍNH lần đặt này đã nằm trong kho.
    if (error.code === "23505") {
      const { data: cu } = await admin
        .from("catalog_orders")
        .select("id,total_vnd")
        .eq("customer_phone", who.phone)
        .eq("client_ref", clientRef)
        .maybeSingle();
      if (cu?.id) {
        return NextResponse.json({
          ok: true,
          id: cu.id,
          totalVnd: (cu as { total_vnd?: number }).total_vnd ?? total,
          duplicate: true,
        });
      }
    }
    // Cột chưa có (0034 chưa apply) → ghi lại không kèm mã giỏ.
    if (error.code === "42703" || error.code === "PGRST204") {
      console.error("[orders] client_ref chưa apply, ghi lại không kèm:", error.message);
      ({ data, error } = await ghiDon({}));
    }
  }
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
