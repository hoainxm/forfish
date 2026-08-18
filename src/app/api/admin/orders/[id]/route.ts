// /api/admin/orders/[id] — NCC/ADMIN CHUYỂN TRẠNG THÁI đơn + ghi chú (2026-08-11).
// PATCH: đổi status theo bảng chuyển hợp lệ (canTransition) và/hoặc dealer_note.
// Đổi trạng thái → BÁO CHO CHỦ TÀU (push + hộp thư, best-effort). PHÂN QUYỀN
// qua requirePermission tab "don-hang": edit.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin-activity-log";
import { notifyAccount } from "@/lib/account-notify";
import {
  canTransition,
  isOrderStatus,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/lib/catalog-orders";

type Ctx = { params: Promise<{ id: string }> };

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

/** Câu báo cho chủ tàu theo trạng thái mới. */
function statusMessage(status: OrderStatus): { title: string; body: string } {
  switch (status) {
    case "da_nhan":
      return {
        title: "Đơn hàng đã được nhận",
        body: "Nhà cung cấp đã nhận đơn của bà con và đang chuẩn bị hàng.",
      };
    case "dang_giao":
      return {
        title: "Đơn hàng đang giao",
        body: "Hàng đang trên đường giao tới. Để ý điện thoại nhé.",
      };
    case "da_giao":
      return {
        title: "Đơn hàng đã giao xong",
        body: "Đơn hàng đã giao. Chúc bà con chuyến biển thuận lợi!",
      };
    case "da_huy":
      return {
        title: "Đơn hàng đã huỷ",
        body: "Đơn hàng của bà con đã được huỷ. Cần hỗ trợ thì gọi nhà cung cấp.",
      };
    default:
      return { title: "Cập nhật đơn hàng", body: ORDER_STATUS_LABELS[status] };
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const who = await requirePermission("don-hang", "edit");
  if (!who.ok) return err(who.status, who.code);
  const { id } = await params;
  if (!id) return err(400, "bad_id");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    status?: string;
    dealerNote?: string;
  } | null;
  if (!body) return err(400, "bad_body");

  const wantStatus = body.status;
  const wantNote = typeof body.dealerNote === "string" ? body.dealerNote : undefined;
  if (wantStatus === undefined && wantNote === undefined)
    return err(400, "nothing_to_update");
  if (wantStatus !== undefined && !isOrderStatus(wantStatus))
    return err(400, "bad_status");

  // Đọc đơn hiện tại — cần status cũ (kiểm chuyển hợp lệ) + SĐT chủ tàu (báo tin).
  const { data: cur, error: readErr } = await admin
    .from("catalog_orders")
    .select("status, customer_phone")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return err(500, "query_failed");
  if (!cur) return err(404, "not_found");

  const fromStatus = (cur as { status: string }).status;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let statusChanged = false;

  if (wantStatus !== undefined && wantStatus !== fromStatus) {
    if (!isOrderStatus(fromStatus) || !canTransition(fromStatus, wantStatus))
      return err(409, "bad_transition");
    patch.status = wantStatus;
    patch.handled_by = who.phone;
    patch.handled_at = new Date().toISOString();
    statusChanged = true;
  }
  if (wantNote !== undefined) patch.dealer_note = wantNote.trim() || null;

  /*  GHI CÓ ĐIỀU KIỆN TRẠNG THÁI CŨ (2026-08-16, thẩm định P1).
      LỖI ĐÃ SỬA: đọc `status` ở trên rồi ghi chỉ theo `id` — giữa hai lượt đó
      chủ tàu bấm Huỷ (`/api/me/orders/[id]/cancel` ghi `da_huy`) thì cú ghi
      này ĐÈ LÊN, đơn khách vừa huỷ SỐNG LẠI thành "đã nhận / đang giao" và
      hàng vẫn đi. Nay điều kiện `status = fromStatus` nằm ngay trong câu lệnh
      ghi: ai chen vào giữa thì 0 hàng khớp ⇒ 409, màn quản trị tải lại và
      thấy trạng thái thật. Cùng khuôn với đường huỷ của khách. */
  const { data: updated, error: updErr } = await admin
    .from("catalog_orders")
    .update(patch)
    .eq("id", id)
    .eq("status", fromStatus)
    .select("id");
  if (updErr) return err(500, "update_failed");
  if (!updated || updated.length === 0) return err(409, "bad_transition");

  await logActivity(admin, {
    actorPhone: who.phone,
    actorRole: who.role,
    action: "order.update",
    target: id,
    detail: statusChanged ? { status: wantStatus } : { note: true },
  });

  // Báo cho chủ tàu khi trạng thái đổi (best-effort, không chặn).
  if (statusChanged) {
    const phone = (cur as { customer_phone: string }).customer_phone;
    const m = statusMessage(wantStatus as OrderStatus);
    await notifyAccount(admin, phone, { ...m, url: "/tau?tab=san-pham", sentBy: who.phone });
  }

  return NextResponse.json({ ok: true });
}
