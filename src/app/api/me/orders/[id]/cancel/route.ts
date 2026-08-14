// /api/me/orders/[id]/cancel — CHỦ TÀU tự huỷ đơn khi CÒN 'moi' (chưa ai nhận).
// Định danh device token; chỉ huỷ được đơn của CHÍNH mình và chỉ khi status='moi'
// (đã nhận/đang giao thì gọi NCC, không tự huỷ trong app). Ghi service-role.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityFromRequest } from "@/lib/api-identity";

type Ctx = { params: Promise<{ id: string }> };

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function POST(req: Request, { params }: Ctx) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  if (!who.phone) return err(401, "login_required");

  const { id } = await params;
  if (!id) return err(400, "bad_id");

  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  // Chỉ huỷ đơn của mình + đang 'moi'. Trả về hàng khớp để biết có đổi không.
  const { data, error } = await admin
    .from("catalog_orders")
    .update({ status: "da_huy", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_phone", who.phone)
    .eq("status", "moi")
    .select("id");
  if (error) return err(500, "update_failed");
  if (!data || data.length === 0) return err(409, "cannot_cancel");

  return NextResponse.json({ ok: true });
}
