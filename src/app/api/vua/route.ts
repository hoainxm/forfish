// /api/vua — HỒ SƠ VỰA ĐANG HIỆN cho Chợ cá › Đầu mối (spec 17 §12.4), gộp phía app với danh bạ admin `sell_contacts`.
//
// Chỉ hồ sơ `hoat_dong` (nhân viên đã duyệt). Cần đăng nhập — mục Đầu mối đã sau RequireLogin, và danh sách mang SĐT
// liên hệ nên không mở cho người lạ cào. KHÔNG BAO GIỜ trả SĐT chủ tài khoản (`phone`): chỉ `contact` chủ tự khai để hiện,
// và cờ `xacMinh` (customers.vai_xac_minh_at, chỉ nhân viên gán — §5). id = số thứ tự trong lượt trả, chỉ để làm khoá vẽ.
//
// Offline: route không nằm trong API_CACHE_ALLOW của sw.js; mất sóng ⇒ app chỉ hiện danh bạ admin/tĩnh như cũ.
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVuaKind, type PublicVua } from "@/lib/vua-profile";

const MAX = 500;

type Row = {
  phone: string;
  name: string;
  kind: string;
  province: string | null;
  address: string | null;
  species: unknown;
  hours: string | null;
  contact: string | null;
};

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });

  const { data, error } = await admin
    .from("vua_profiles")
    .select("phone,name,kind,province,address,species,hours,contact")
    .eq("status", "hoat_dong")
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(MAX);
  if (error) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  const rows = (data ?? []) as Row[];

  const daXacMinh = new Set<string>();
  if (rows.length > 0) {
    const { data: cs, error: cErr } = await admin
      .from("customers")
      .select("phone")
      .in("phone", rows.map((r) => r.phone))
      .not("vai_xac_minh_at", "is", null);
    // tra dấu hỏng ⇒ vẫn trả danh sách, chỉ không có dấu (thiếu dấu an toàn hơn dấu sai)
    if (!cErr) for (const c of cs ?? []) daXacMinh.add((c as { phone: string }).phone);
  }

  const vua: PublicVua[] = rows
    .filter((r) => isVuaKind(r.kind))
    .map((r, i) => ({
      id: `vp-${i}`,
      name: r.name,
      kind: r.kind as PublicVua["kind"],
      province: r.province,
      address: r.address,
      species: Array.isArray(r.species) ? (r.species as unknown[]).filter((x): x is string => typeof x === "string") : [],
      hours: r.hours,
      contact: r.contact,
      xacMinh: daXacMinh.has(r.phone),
    }));
  return NextResponse.json({ ok: true, vua });
}
