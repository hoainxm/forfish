// Đồ SDVICO của TÔI — sản phẩm/bảo hành/dịch vụ/cước của khách đang đăng
// nhập, đọc từ hệ thống bán hàng qua adapter (sdwork-assets.ts).
//
// An toàn: account phía CRM suy từ SESSION ForFish (sdwork_customer_ref /
// SĐT trong profiles) — client không gửi và không thể đổi định danh.
// Chưa đăng nhập / chưa cấu hình / CRM lỗi → ok:false, UI dùng dữ liệu local.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnedAssets, isAssetSyncConfigured } from "@/lib/sdwork-assets";

export async function GET() {
  if (!isAssetSyncConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured" });
  }
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, code: "not_configured" });
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) {
    return NextResponse.json({ ok: false, code: "not_signed_in" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("sdwork_customer_ref, phone")
    .eq("id", user.id)
    .maybeSingle();

  // fallback: SĐT suy từ email ảo {SĐT}@sdvico.local
  const phoneFromEmail = user.email?.split("@")[0] ?? null;

  const assets = await fetchOwnedAssets(
    profile?.sdwork_customer_ref ?? null,
    profile?.phone ?? phoneFromEmail,
  );
  if (!assets) {
    return NextResponse.json({ ok: false, code: "no_link" });
  }

  return NextResponse.json(
    { ok: true, assets },
    // dữ liệu riêng từng khách — không cache chung; trình duyệt giữ 10 phút
    { headers: { "Cache-Control": "private, max-age=600" } },
  );
}
