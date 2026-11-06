// Đồ của TÔI — sản phẩm/bảo hành/hỗ trợ của khách đang đăng nhập, đọc từ DB
// RIÊNG của SDFish (customers/devices/support_requests) do webhook SDWork nạp.
// KHÔNG đọc-live SDWork nữa (tách riêng). RLS lọc theo SĐT (current_phone()) —
// client chỉ thấy hàng của mình. Chưa đăng nhập / bảng chưa có → ok:false,
// UI lùi dữ liệu local. Shape {ok, assets} giữ nguyên (use-sdvico-assets không đổi).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OwnedAssets, SupportRequest } from "@/lib/owned-assets";
import { sdtTraCuaTaiKhoan, soChoDuyet } from "@/lib/sdt-khac";

export async function GET(req: Request) {
  const who = await identityFromRequest(req);
  if (!who.ok) {
    /*  GIỮ SHAPE CŨ `{ok:false, code}` — `use-sdvico-assets` đọc `code` để lùi về
        dữ liệu local, và nó KHÔNG được thấy 401 ném ra ngoài. Nhưng chuỗi bị thu
        hồi thì phải để `identityFromRequest` trả 401 thật: đó là tín hiệu duy
        nhất báo máy vừa bị đá. */
    if (who.res.status === 503) {
      return NextResponse.json({ ok: false, code: "not_configured" });
    }
    if (who.res.status === 401 && !req.headers.get("x-sdfish-token")) {
      return NextResponse.json({ ok: false, code: "not_signed_in" });
    }
    return who.res;
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: "not_configured" });

  /*  TỰ LỌC THEO SĐT VỪA XÁC THỰC (đổi 2026-08-02). Trước đây RLS `current_phone()`
      lọc hộ vì client mang phiên Supabase; nay không còn phiên nên route dùng
      service key và PHẢI tự lọc. SĐT chỉ lấy từ cổng chuỗi — không nhận từ body,
      query, hay bất cứ thứ gì máy khách nói ra. */
  /*  SỐ KHÁC CỦA TÔI (0086, 2026-11-06 — anh Long: "phải có phương án bind với sdt này hoặc cho khách bổ sung sdt mua
      hàng sdvico"): mua hàng bằng số khác số đăng nhập ⇒ nhân viên duyệt số đó ⇒ đồ của nó hiện ở đây. CHỈ số đã duyệt;
      số bà con mới gửi (chờ duyệt) chỉ trả về để app nói "đang chờ SDVICO xác nhận". */
  const [sdts, choDuyet] = await Promise.all([sdtTraCuaTaiKhoan(admin, who.phone), soChoDuyet(admin, who.phone)]);
  const [{ data: customer }, { data: devices, error: devErr }, { data: reqs }] =
    await Promise.all([
      admin.from("customers").select("name").eq("phone", who.phone).maybeSingle(),
      admin
        .from("devices")
        .select("id, name, serial, purchased_on, warranty_until, order_code")
        .in("customer_phone", sdts),
      admin
        .from("support_requests")
        .select("id, summary, status, created_at")
        .in("phone", sdts)
        .order("created_at", { ascending: false }),
    ]);

  // bảng chưa tạo (migration chưa apply) → degrade, UI dùng local
  if (devErr) {
    return NextResponse.json({ ok: false, code: "no_link", choDuyet });
  }
  // đăng nhập nhưng chưa có đồ SDVICO nào theo mọi số của tài khoản (chưa mua / mua bằng số khác chưa gắn).
  // Đổi 2026-11-06: trước đây có dòng customers (ai đăng nhập cũng có) là coi như "đã nối" ⇒ khối im lặng "0 dịch vụ".
  if ((!devices || devices.length === 0) && (!reqs || reqs.length === 0)) {
    return NextResponse.json({ ok: false, code: "no_link", choDuyet });
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
    { ok: true, assets, choDuyet },
    { headers: { "Cache-Control": "private, max-age=600" } },
  );
}
