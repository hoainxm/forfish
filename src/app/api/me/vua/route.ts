// /api/me/vua — HỒ SƠ VỰA của CHÍNH MÌNH (spec 17 §12.4). GET đọc, PUT tạo/sửa.
//
// SĐT chỉ lấy từ cổng chuỗi (identityFromRequest) — không bao giờ từ body. Trạng thái do MÁY CHỦ quyết theo
// `trangThaiKhiLuu` (lib/vua-profile): hồ sơ mới / gửi lại sau từ chối ⇒ chờ duyệt; đang hiện mà đổi ô chính (tên,
// loại, tỉnh, địa chỉ, SĐT liên hệ) ⇒ chờ duyệt lại; chỉ đổi loài/giờ ⇒ vẫn hiện; đang khoá ⇒ 403 `locked`.
//
// Không gác theo vai: vai là lựa chọn giao diện (§2), chỗ gác thật là bước nhân viên duyệt.
// MIGRATION 0079 CÓ THỂ CHƯA ÁP: bảng chưa có ⇒ 503 `unavailable` — màn giữ chữ đang gõ, không coi là "chưa có hồ sơ".
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import { isVuaKind, isVuaStatus, parseVuaBody, trangThaiKhiLuu, type VuaStatus } from "@/lib/vua-profile";

const TABLE = "vua_profiles";
const COLS = "name,kind,province,address,species,hours,contact,status,status_note,approved_at,updated_at";

const unavailable = () => NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });

type Row = {
  name: string;
  kind: string;
  province: string | null;
  address: string | null;
  species: unknown;
  hours: string | null;
  contact: string | null;
  status: string;
  status_note: string | null;
  approved_at: string | null;
  updated_at: string | null;
};

function toProfile(r: Row) {
  return {
    name: r.name,
    kind: isVuaKind(r.kind) ? r.kind : "vua",
    province: r.province,
    address: r.address,
    species: Array.isArray(r.species) ? (r.species as unknown[]).filter((x): x is string => typeof x === "string") : [],
    hours: r.hours,
    contact: r.contact,
    status: (isVuaStatus(r.status) ? r.status : "cho_duyet") as VuaStatus,
    statusNote: r.status_note,
    approvedAt: r.approved_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const [p, c] = await Promise.all([
    admin.from(TABLE).select(COLS).eq("phone", phone).maybeSingle(),
    admin.from("customers").select("vai_xac_minh_at").eq("phone", phone).maybeSingle(),
  ]);
  if (p.error || c.error) return unavailable();
  return NextResponse.json({
    ok: true,
    profile: p.data ? toProfile(p.data as Row) : null,
    xacMinh: !!(c.data as { vai_xac_minh_at?: string | null } | null)?.vai_xac_minh_at,
  });
}

export async function PUT(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const phone = normalizeVnPhone(who.phone);

  const body = await req.json().catch(() => null);
  const parsed = parseVuaBody(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, code: "invalid", field: parsed.field }, { status: 400 });
  const draft = { ...parsed.value, contact: parsed.value.contact ?? phone };

  const admin = createAdminClient();
  if (!admin) return unavailable();
  const { data: cur, error: curErr } = await admin.from(TABLE).select(COLS).eq("phone", phone).maybeSingle();
  if (curErr) return unavailable();

  const truoc = cur ? toProfile(cur as Row) : null;
  const status = trangThaiKhiLuu(truoc, draft);
  if (status === "khoa") return NextResponse.json({ ok: false, code: "locked" }, { status: 403 });

  const row = {
    phone,
    name: draft.name,
    kind: draft.kind,
    province: draft.province,
    address: draft.address,
    species: draft.species,
    hours: draft.hours,
    contact: draft.contact,
    status,
    // lý do từ chối chỉ còn ý nghĩa khi vẫn đang bị từ chối — gửi lại thì xoá
    status_note: status === "hoat_dong" ? (truoc?.statusNote ?? null) : null,
  };
  const { data, error } = await admin.from(TABLE).upsert(row, { onConflict: "phone" }).select(COLS).single();
  if (error) {
    // 23514 = check của bảng — lib đã chặn trước, tới đây là lệch luật giữa lib và migration
    if (error.code === "23514") return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
    return unavailable();
  }
  return NextResponse.json({ ok: true, profile: toProfile(data as Row) });
}
