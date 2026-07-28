// /api/admin/products — QUẢN LÝ danh mục sản phẩm/dịch vụ hiện trong tab
// Sản phẩm /tau (2026-07-28). Admin/quản lý ẩn/hiện/xóa/thêm — kể cả sản
// phẩm của ĐƠN VỊ NGOÀI SDWork (vendor_kind='external'). Áp dụng NGAY cho
// app (client đọc thẳng bảng qua RLS visible=true) — không cần build app.
//
// GET: danh sách ĐẦY ĐỦ (kể cả đang ẩn) cho trang quản trị.
// POST: tạo mới.
// PATCH: sửa 1 hàng theo id (đổi visible/sort_order/nội dung).
// DELETE ?id=: xóa hẳn.
// Ghi bằng service-role; quyền qua requireStaff (admin env + manager DB) —
// giống pattern crew-reports, không phân biệt admin/manager cho danh mục.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/admin-auth";
import { validateProductDraft, type ProductDraft } from "@/lib/product-catalog";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

function draftToRow(d: ProductDraft, who: string) {
  return {
    vendor_kind: d.vendorKind,
    vendor_name: d.vendorName?.trim() || null,
    title: d.title.trim(),
    category: d.category?.trim() || null,
    description: d.description?.trim() || null,
    features: d.features.filter((f) => f.trim().length > 0),
    price_text: d.priceText?.trim() || null,
    image_url: d.imageUrl?.trim() || null,
    contact_phone: d.contactPhone?.trim() || null,
    contact_note: d.contactNote?.trim() || null,
    line: d.line?.trim() || null,
    visible: d.visible,
    created_by: who,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from("product_listings")
    .select(
      "id,vendor_kind,vendor_name,title,category,description,features,price_text,image_url,contact_phone,contact_note,line,visible,sort_order,created_by,created_at,updated_at",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return err(500, "query_failed");

  const listings = (data ?? []).map((r) => ({
    id: r.id as string,
    vendorKind: r.vendor_kind === "external" ? "external" : "sdvico",
    vendorName: (r.vendor_name as string) ?? null,
    title: r.title as string,
    category: (r.category as string) ?? null,
    description: (r.description as string) ?? null,
    features: Array.isArray(r.features)
      ? (r.features as unknown[]).filter((f) => typeof f === "string")
      : [],
    priceText: (r.price_text as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    contactPhone: (r.contact_phone as string) ?? null,
    contactNote: (r.contact_note as string) ?? null,
    line: (r.line as string) ?? null,
    visible: r.visible as boolean,
    sortOrder: r.sort_order as number,
    createdBy: (r.created_by as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));

  return NextResponse.json({ ok: true, me: who, listings });
}

export async function POST(req: Request) {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as
    | (ProductDraft & { sortOrder?: number })
    | null;
  if (!body) return err(400, "bad_body");
  const draft: ProductDraft = {
    vendorKind: body.vendorKind === "external" ? "external" : "sdvico",
    vendorName: body.vendorName,
    title: body.title ?? "",
    category: body.category,
    description: body.description,
    features: Array.isArray(body.features) ? body.features : [],
    priceText: body.priceText,
    imageUrl: body.imageUrl,
    contactPhone: body.contactPhone,
    contactNote: body.contactNote,
    line: body.line,
    visible: body.visible ?? true,
  };
  const invalid = validateProductDraft(draft);
  if (invalid) return err(400, "invalid_draft");

  const { data, error } = await admin
    .from("product_listings")
    .insert({ ...draftToRow(draft, who.phone), sort_order: body.sortOrder ?? 0 })
    .select("id")
    .maybeSingle();
  if (error) return err(500, "insert_failed");
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function PATCH(req: Request) {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as
    | ({ id?: string } & Partial<ProductDraft> & { sortOrder?: number })
    | null;
  if (!body?.id) return err(400, "bad_id");

  // Toggle nhanh (chỉ đổi visible/sortOrder) không bắt buộc đủ draft hợp lệ.
  const isFullEdit = body.title !== undefined;
  if (isFullEdit) {
    const draft: ProductDraft = {
      vendorKind: body.vendorKind === "external" ? "external" : "sdvico",
      vendorName: body.vendorName,
      title: body.title ?? "",
      category: body.category,
      description: body.description,
      features: Array.isArray(body.features) ? body.features : [],
      priceText: body.priceText,
      imageUrl: body.imageUrl,
      contactPhone: body.contactPhone,
      contactNote: body.contactNote,
      line: body.line,
      visible: body.visible ?? true,
    };
    const invalid = validateProductDraft(draft);
    if (invalid) return err(400, "invalid_draft");
    const patch: Record<string, unknown> = draftToRow(draft, who.phone);
    if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
    const { error } = await admin
      .from("product_listings")
      .update(patch)
      .eq("id", body.id);
    if (error) return err(500, "update_failed");
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.visible !== undefined) patch.visible = body.visible;
  if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
  if (Object.keys(patch).length <= 1) return err(400, "nothing_to_update");

  const { error } = await admin
    .from("product_listings")
    .update(patch)
    .eq("id", body.id);
  if (error) return err(500, "update_failed");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err(400, "bad_id");

  const { data, error } = await admin
    .from("product_listings")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return err(500, "delete_failed");
  if (!data || data.length === 0) return err(404, "not_found");
  return NextResponse.json({ ok: true });
}
