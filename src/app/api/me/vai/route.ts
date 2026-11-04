// /api/me/vai — vai của CHÍNH MÌNH (spec 17 §3). GET đọc, PUT đổi.
//
// SĐT chỉ lấy từ cổng chuỗi (identityFromRequest) — không nhận từ body. Vai chọn MỘT LẦN (anh Long 03/11 — luật ở
// lib/vai lyDoKhongDoiVai): chưa có vai ⇒ ghi; đã có ⇒ 409 `da_co_vai`, trừ Đi bạn ⇒ Chủ tàu khi sổ tàu ĐÃ ĐỒNG BỘ có ≥1
// tàu (chưa có ⇒ 409 `chua_co_tau`, máy giữ cờ chờ và gửi lại sau). Thu mua / Đại lý KHÔNG tự chọn được ⇒ 409 `can_duyet`
// (anh Long 04/11 — nhân viên gán ở /quan-tri). Máy chủ là nơi QUYẾT vai; máy chỉ giữ bản sao.
//
// MIGRATION 0079 CÓ THỂ CHƯA ÁP: cột `vai` chưa có ⇒ 503 `unavailable` — máy giữ nguyên bản đang có, KHÔNG coi là
// "chưa chọn vai" (đó là đường ép bà con chọn lại mỗi lần mở app).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripDeleted } from "@/lib/sync-tombstone";
import { isVai, lyDoKhongDoiVai } from "@/lib/vai";

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
  const moi = body.vai;
  const { data: cur, error: curErr } = await admin.from("customers").select("vai").eq("phone", who.phone).maybeSingle();
  if (curErr) return unavailable();
  const hienTai = isVai(cur?.vai) ? cur.vai : null;
  if (hienTai === moi) return NextResponse.json({ ok: true, vai: moi });
  // chỉ tra sổ tàu khi cần (Đi bạn ⇒ Chủ tàu); tàu đã xoá (dấu tombstone) không tính
  let coTau = false;
  if (hienTai === "ngu-dan" && moi === "chu-tau") {
    const { data: so } = await admin
      .from("user_docs")
      .select("data")
      .eq("owner_phone", who.phone)
      .eq("kind", "boats")
      .maybeSingle();
    const tau = stripDeleted(so?.data);
    coTau = Array.isArray(tau) && tau.length > 0;
  }
  const lyDo = lyDoKhongDoiVai(hienTai, moi, coTau);
  if (lyDo) return NextResponse.json({ ok: false, code: lyDo, vai: hienTai }, { status: 409 });
  // ghi có điều kiện: vai trên máy chủ vẫn là thứ vừa đọc (hai máy cùng chọn một lúc thì máy sau nhận 409)
  let q = admin.from("customers").update({ vai: moi, vai_doi_luc: new Date().toISOString() }).eq("phone", who.phone);
  q = hienTai === null ? q.is("vai", null) : q.eq("vai", hienTai);
  const { data, error } = await q.select("phone");
  if (error) return unavailable();
  if (cur && (!data || data.length === 0)) {
    return NextResponse.json({ ok: false, code: "da_co_vai", vai: hienTai }, { status: 409 });
  }
  if (!data || data.length === 0) {
    // tài khoản tự đăng ký chưa có hàng khách ⇒ tạo hàng tối thiểu (giống heartbeat không tạo — nhưng vai cần chỗ ở)
    const { error: insErr } = await admin
      .from("customers")
      .insert({ phone: who.phone, vai: moi, vai_doi_luc: new Date().toISOString() });
    if (insErr) return unavailable();
  }
  return NextResponse.json({ ok: true, vai: moi });
}
