// /api/product-inquiries — Bà con "Để lại yêu cầu" hỏi mua/tư vấn cho sản
// phẩm trong danh mục (chủ yếu đơn vị NGOÀI SDWork — sản phẩm SDVICO vẫn
// dùng /api/sdvico/request → CRM như cũ). Dùng được cả khi CHƯA đăng nhập,
// giống pattern /api/sdvico/request. Ghi bằng service-role (bảng không có
// RLS policy nào cho client). Admin xem/xử lý ở /api/admin/product-inquiries.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { validateInquiryDraft, type InquiryDraft } from "@/lib/product-inquiries";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as InquiryDraft | null;
  if (!body) return err(400, "bad_body");
  const invalid = validateInquiryDraft(body);
  if (invalid) return err(400, "invalid_draft");

  const { error } = await admin.from("product_inquiries").insert({
    listing_id: body.listingId || null,
    listing_title: body.listingTitle?.trim() || null,
    vendor_kind: body.vendorKind || null,
    customer_phone: normalizeVnPhone(body.phone),
    customer_name: body.name?.trim() || null,
    message: body.message?.trim() || null,
  });
  if (error) return err(500, "insert_failed");
  return NextResponse.json({ ok: true });
}
