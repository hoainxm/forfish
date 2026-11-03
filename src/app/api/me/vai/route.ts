// /api/me/vai — vai của CHÍNH MÌNH (spec 17 §3). GET đọc, PUT đổi.
//
// SĐT chỉ lấy từ cổng chuỗi (identityFromRequest) — không nhận từ body. Vai là lựa chọn của người dùng, đổi không giới
// hạn số lần (§3.3); máy là nơi giữ chính (forfish.vai.v1), route này chỉ là bản sao để đổi máy không phải chọn lại.
//
// MIGRATION 0079 CÓ THỂ CHƯA ÁP: cột `vai` chưa có ⇒ 503 `unavailable` — máy giữ nguyên bản đang có, KHÔNG coi là
// "chưa chọn vai" (đó là đường ép bà con chọn lại mỗi lần mở app).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVai } from "@/lib/vai";

const unavailable = () => NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const { data, error } = await admin
    .from("customers")
    .select("vai, vai_xac_minh_at")
    .eq("phone", who.phone)
    .maybeSingle();
  if (error) return unavailable();
  // không có hàng khách (tài khoản tự đăng ký chưa được nạp) ⇒ chưa có vai, không lỗi
  const vai = isVai(data?.vai) ? data.vai : null;
  return NextResponse.json({ ok: true, vai, xacMinh: !!data?.vai_xac_minh_at });
}

export async function PUT(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) return who.res;
  const body = (await req.json().catch(() => null)) as { vai?: unknown } | null;
  // ranh giới: chỉ nhận đúng 4 mã; null không nhận (bỏ vai = "Để sau" chỉ ở máy)
  if (!isVai(body?.vai)) return NextResponse.json({ ok: false, code: "bad_vai" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return unavailable();
  const { data, error } = await admin
    .from("customers")
    .update({ vai: body.vai, vai_doi_luc: new Date().toISOString() })
    .eq("phone", who.phone)
    .select("phone");
  if (error) return unavailable();
  if (!data || data.length === 0) {
    // tài khoản tự đăng ký chưa có hàng khách ⇒ tạo hàng tối thiểu (giống heartbeat không tạo — nhưng vai cần chỗ ở)
    const { error: insErr } = await admin
      .from("customers")
      .insert({ phone: who.phone, vai: body.vai, vai_doi_luc: new Date().toISOString() });
    if (insErr) return unavailable();
  }
  return NextResponse.json({ ok: true, vai: body.vai });
}
