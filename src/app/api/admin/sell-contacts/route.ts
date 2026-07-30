// /api/admin/sell-contacts — QUẢN LÝ danh bạ "Bán ở đâu" (bảng sell_contacts):
// Nậu vựa · Chợ đầu mối · Nhà máy. Admin/quản lý sửa/ẩn/hiện/xóa/thêm — áp dụng
// NGAY cho app (client đọc bảng qua RLS visible=true).
//
// GET: danh sách ĐẦY ĐỦ (kể cả ẩn).
// POST: tạo mới; hoặc { action:"seed" } = NẠP DANH BẠ MẶC ĐỊNH (đổ ~143 đầu mối
//        tĩnh vào bảng, CHỈ khi bảng đang rỗng — tránh trùng).
// PATCH: sửa 1 hàng theo id (toggle visible/sort, hoặc sửa meta).
// DELETE ?id=: xóa hẳn.
// Ghi bằng service-role; quyền qua requireStaff.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/admin-auth";
import {
  defaultSellContactDrafts,
  validateSellContactDraft,
  SELL_KINDS,
  type SellContactDraft,
  type SellKind,
} from "@/lib/sell-contacts";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

const TABLE = "sell_contacts";

function coerceKind(v: unknown): SellKind {
  return SELL_KINDS.includes(v as SellKind) ? (v as SellKind) : "vua";
}

function readDraft(body: Record<string, unknown>): SellContactDraft {
  const str = (k: string) => {
    const v = body[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const arr = (k: string) =>
    Array.isArray(body[k])
      ? (body[k] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  return {
    kind: coerceKind(body.kind),
    name: String(body.name ?? "").trim(),
    subLabel: str("subLabel"),
    province: str("province"),
    address: str("address"),
    phone: str("phone"),
    hours: str("hours"),
    species: arr("species"),
    markets: arr("markets"),
    website: str("website"),
    direct: body.direct === true,
    visible: body.visible !== false,
  };
}

function draftToRow(d: SellContactDraft, who: string, sortOrder: number) {
  return {
    kind: d.kind,
    name: d.name,
    sub_label: d.subLabel ?? null,
    province: d.province ?? null,
    address: d.address ?? null,
    phone: d.phone ?? null,
    hours: d.hours ?? null,
    species: d.species,
    markets: d.markets,
    website: d.website ?? null,
    direct: d.direct,
    note: null,
    visible: d.visible,
    sort_order: sortOrder,
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
    .from(TABLE)
    .select(
      "id,kind,name,sub_label,province,address,phone,hours,species,markets,website,direct,note,visible,sort_order,created_by,created_at,updated_at",
    )
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(2000);
  if (error) return err(500, "query_failed");

  const contacts = (data ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    name: r.name as string,
    subLabel: (r.sub_label as string) ?? null,
    province: (r.province as string) ?? null,
    address: (r.address as string) ?? null,
    phone: (r.phone as string) ?? null,
    hours: (r.hours as string) ?? null,
    species: Array.isArray(r.species) ? (r.species as string[]) : [],
    markets: Array.isArray(r.markets) ? (r.markets as string[]) : [],
    website: (r.website as string) ?? null,
    direct: r.direct as boolean,
    note: (r.note as string) ?? null,
    visible: r.visible as boolean,
    sortOrder: r.sort_order as number,
    createdAt: r.created_at as string,
  }));
  return NextResponse.json({ ok: true, me: who, contacts });
}

export async function POST(req: Request) {
  const who = await requireStaff();
  if (!who.ok) return err(who.status, who.code);
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return err(400, "bad_body");

  // NẠP DANH BẠ MẶC ĐỊNH — chỉ khi bảng đang rỗng.
  if (body.action === "seed") {
    const { count, error: cErr } = await admin
      .from(TABLE)
      .select("id", { count: "exact", head: true });
    if (cErr) return err(500, "query_failed");
    if ((count ?? 0) > 0) return err(409, "not_empty");
    const rows = defaultSellContactDrafts().map((d, i) =>
      draftToRow(d, who.phone, i),
    );
    const { error } = await admin.from(TABLE).insert(rows);
    if (error) return err(500, "seed_failed");
    return NextResponse.json({ ok: true, seeded: rows.length });
  }

  const draft = readDraft(body);
  const invalid = validateSellContactDraft(draft);
  if (invalid) return err(400, "invalid_draft");
  const { data, error } = await admin
    .from(TABLE)
    .insert(draftToRow(draft, who.phone, typeof body.sortOrder === "number" ? body.sortOrder : 0))
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

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const id = body?.id as string | undefined;
  if (!id) return err(400, "bad_id");

  // Sửa đủ (có name) → validate + ghi cả bản; toggle nhanh → chỉ vá cờ.
  if (typeof body!.name === "string") {
    const draft = readDraft(body!);
    const invalid = validateSellContactDraft(draft);
    if (invalid) return err(400, "invalid_draft");
    const patch: Record<string, unknown> = draftToRow(draft, who.phone, 0);
    delete patch.sort_order;
    if (typeof body!.sortOrder === "number") patch.sort_order = body!.sortOrder;
    const { error } = await admin.from(TABLE).update(patch).eq("id", id);
    if (error) return err(500, "update_failed");
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body!.visible === "boolean") patch.visible = body!.visible;
  if (typeof body!.sortOrder === "number") patch.sort_order = body!.sortOrder;
  if (Object.keys(patch).length <= 1) return err(400, "nothing_to_update");
  patch.created_by = who.phone;

  const { error } = await admin.from(TABLE).update(patch).eq("id", id);
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
    .from(TABLE)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return err(500, "delete_failed");
  if (!data || data.length === 0) return err(404, "not_found");
  return NextResponse.json({ ok: true });
}
