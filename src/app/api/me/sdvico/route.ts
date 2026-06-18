// Đồ của TÔI — sản phẩm/bảo hành/hỗ trợ của khách đang đăng nhập, đọc từ DB
// RIÊNG của SDFish (customers/devices/support_requests) do webhook SDWork nạp.
// KHÔNG đọc-live SDWork nữa (tách riêng). RLS lọc theo SĐT (current_phone()) —
// client chỉ thấy hàng của mình. Chưa đăng nhập / bảng chưa có → ok:false,
// UI lùi dữ liệu local. Shape {ok, assets} giữ nguyên (use-sdvico-assets không đổi).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OwnedAssets, SupportRequest } from "@/lib/owned-assets";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, code: "not_configured" });
  }

  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return NextResponse.json({ ok: false, code: "not_signed_in" });
  }

  // RLS tự lọc theo current_phone() — không cần truyền SĐT từ client.
  const [{ data: customer }, { data: devices, error: devErr }, { data: reqs }] =
    await Promise.all([
      supabase.from("customers").select("name").maybeSingle(),
      supabase
        .from("devices")
        .select("id, name, serial, purchased_on, warranty_until, order_code"),
      supabase
        .from("support_requests")
        .select("id, summary, status, created_at")
        .order("created_at", { ascending: false }),
    ]);

  // bảng chưa tạo (migration chưa apply) → degrade, UI dùng local
  if (devErr) {
    return NextResponse.json({ ok: false, code: "no_link" });
  }
  // đăng nhập nhưng chưa khớp khách nào (chưa mua / SĐT chưa về qua webhook)
  if (!customer && (!devices || devices.length === 0)) {
    return NextResponse.json({ ok: false, code: "no_link" });
  }

  const assets: OwnedAssets = {
    products: (devices ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      serial: (d.serial as string) ?? undefined,
      purchasedOn: (d.purchased_on as string) ?? undefined,
      warrantyUntil: (d.warranty_until as string) ?? undefined,
      orderCode: (d.order_code as string) ?? undefined,
    })),
    services: [],
    payments: [],
    requests: (reqs ?? []).map(
      (r): SupportRequest => ({
        id: r.id as string,
        summary: r.summary as string,
        status: r.status as string,
        sentAt: (r.created_at as string) ?? undefined,
      }),
    ),
    customerName: (customer?.name as string) ?? undefined,
  };

  return NextResponse.json(
    { ok: true, assets },
    { headers: { "Cache-Control": "private, max-age=600" } },
  );
}
