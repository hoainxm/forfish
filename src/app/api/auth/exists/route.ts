import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";

/*
  POST /api/auth/exists — SĐT này đã có tài khoản SDFish chưa? (chỉ boolean)

  Phục vụ màn /login tách thông báo lỗi: Supabase trả invalid_credentials chung,
  client không biết KH gõ sai SỐ hay sai MẬT KHẨU. Route này dùng service-role
  gọi RPC sẵn có `auth_user_id_by_phone` (migration 0003, đã trên prod) — KHÔNG
  cần DDL mới, không lộ gì ngoài boolean.

  ⚠️ User enumeration: ai cũng hỏi được "SĐT X có tài khoản không". User chốt
  chấp nhận 2026-07-21 (username = SĐT vốn đoán được); route này là chokepoint
  để gắn rate-limit sau (docs/adr/0007). SĐT đi trong BODY, không nằm trên URL.
*/
export async function POST(req: Request) {
  let phoneRaw = "";
  try {
    const body = await req.json();
    phoneRaw = String(body?.phone ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const phone = normalizeVnPhone(phoneRaw);
  if (!isValidVnPhone(phone)) {
    return NextResponse.json({ ok: false, error: "bad_phone" }, { status: 400 });
  }

  // Chưa cấu hình service-role (demo mode) → ok:false, client quay về câu gộp.
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" });

  const { data, error } = await admin.rpc("auth_user_id_by_phone", {
    p_phone: phone,
  });
  if (error) return NextResponse.json({ ok: false, error: "lookup_failed" });

  return NextResponse.json(
    { ok: true, exists: Boolean(data) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
