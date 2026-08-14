// /api/admin/orders — NCC/ADMIN xem đơn đặt hàng (2026-08-11). Danh sách đầy đủ
// mọi đơn cho web quản trị, lọc theo trạng thái (?status=). PHÂN QUYỀN qua
// requirePermission tab "don-hang": GET=view. Chuyển trạng thái ở PATCH [id].
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { isOrderStatus, rowToOrder } from "@/lib/catalog-orders";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

const ORDER_COLS =
  "id,customer_phone,boat_name,boat_ref,items,total_vnd,delivery_location,contact_name,contact_phone,note,status,handled_by,handled_at,dealer_note,created_at,updated_at";

export async function GET(req: Request) {
  const who = await requirePermission("don-hang", "view");
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const statusFilter = new URL(req.url).searchParams.get("status");

  let q = admin
    .from("catalog_orders")
    .select(ORDER_COLS)
    .order("created_at", { ascending: false })
    .limit(300);
  if (statusFilter && isOrderStatus(statusFilter)) q = q.eq("status", statusFilter);
  const { data, error } = await q;
  if (error) return err(500, "query_failed");

  const orders = (data ?? []).map((r) =>
    rowToOrder(r as Parameters<typeof rowToOrder>[0]),
  );
  return NextResponse.json({ ok: true, me: who, orders });
}
