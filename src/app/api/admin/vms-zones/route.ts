// /api/admin/vms-zones — QUẢN LÝ vùng biển VMS hiện trên bản đồ Ra khơi
// (2026-07-28). Admin/quản lý thêm/bớt/ẩn vùng + đặt "hiển thị mặc định trên app
// ngư dân". Áp dụng NGAY cho app (client đọc bảng qua RLS visible=true).
//
// GET: danh sách ĐẦY ĐỦ (kể cả ẩn) cho trang quản trị.
// POST: tạo vùng mới (nhận GeoJSON đã parse → server giản lược trước khi lưu).
// PATCH ?: sửa 1 hàng theo id (toggle visible/default_on/sort, hoặc sửa đủ meta).
// DELETE ?id=: xóa hẳn.
// Ghi bằng service-role. ADMIN-ONLY CỨNG (2026-07-30 phân quyền): tab Vùng biển
// không nằm trong 5 tab cấu hình được cho quản lý → requireAdmin mọi method.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import {
  countPoints,
  simplifyFeatureCollection,
  validateZoneDraft,
  type VmsZoneDraft,
  type VmsZoneStyle,
  VMS_ZONE_STYLES,
} from "@/lib/vms-zones";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

const TABLE = "vms_zones";
// Tệp tải lên quá nặng → 400 (bà con/admin nên gửi file đã cắt gọn nguồn).
const MAX_INPUT_POINTS = 200_000;

function coerceStyle(s: unknown): VmsZoneStyle {
  return VMS_ZONE_STYLES.includes(s as VmsZoneStyle)
    ? (s as VmsZoneStyle)
    : "line";
}

function readDraft(body: Record<string, unknown>): VmsZoneDraft {
  const gj = body.geojson as GeoJSON.FeatureCollection;
  return {
    name: String(body.name ?? "").trim(),
    color: String(body.color ?? "#0d9488"),
    style: coerceStyle(body.style),
    defaultOn: body.defaultOn !== false,
    visible: body.visible !== false,
    geojson:
      gj && Array.isArray(gj.features)
        ? gj
        : { type: "FeatureCollection", features: [] },
  };
}

export async function GET() {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const { data, error } = await admin
    .from(TABLE)
    .select(
      "id,name,color,style,default_on,visible,geojson,sort_order,created_by,created_at,updated_at",
    )
    .order("sort_order", { ascending: true })
    .limit(500);
  if (error) return err(500, "query_failed");

  const zones = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    color: r.color as string,
    style: r.style as string,
    defaultOn: r.default_on as boolean,
    visible: r.visible as boolean,
    geojson: r.geojson as GeoJSON.FeatureCollection,
    sortOrder: r.sort_order as number,
    createdBy: (r.created_by as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
  return NextResponse.json({ ok: true, me: who, zones });
}

export async function POST(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return err(400, "bad_body");

  const draft = readDraft(body);
  const invalid = validateZoneDraft(draft);
  if (invalid) return err(400, "invalid_draft");
  if (countPoints(draft.geojson) > MAX_INPUT_POINTS) return err(413, "too_big");

  // Giản lược server-side trước khi lưu (không đẩy 1,6MB xuống mọi máy bà con).
  const simplified = simplifyFeatureCollection(draft.geojson);
  if (simplified.features.length === 0) return err(400, "empty_after_simplify");

  const { data, error } = await admin
    .from(TABLE)
    .insert({
      name: draft.name,
      color: draft.color,
      style: draft.style,
      default_on: draft.defaultOn,
      visible: draft.visible,
      geojson: simplified,
      sort_order: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      created_by: who.phone,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) return err(500, "insert_failed");
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function PATCH(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const id = body?.id as string | undefined;
  if (!id) return err(400, "bad_id");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body!.name === "string") patch.name = (body!.name as string).trim();
  if (typeof body!.color === "string") patch.color = body!.color;
  if (body!.style !== undefined) patch.style = coerceStyle(body!.style);
  if (typeof body!.defaultOn === "boolean") patch.default_on = body!.defaultOn;
  if (typeof body!.visible === "boolean") patch.visible = body!.visible;
  if (typeof body!.sortOrder === "number") patch.sort_order = body!.sortOrder;
  if (Object.keys(patch).length <= 1) return err(400, "nothing_to_update");
  patch.created_by = who.phone;

  const { error } = await admin.from(TABLE).update(patch).eq("id", id);
  if (error) return err(500, "update_failed");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const who = await requireAdmin();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err(400, "bad_id");

  const { data, error } = await admin
    .from(TABLE)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return err(500, "delete_failed");
  if (!data || data.length === 0) return err(404, "not_found");
  return NextResponse.json({ ok: true });
}
