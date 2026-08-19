// /api/push/ack — MÁY BÁO VỀ: đã nhận / đã đọc một thông báo (0023).
//
// Vì sao cần: gửi xong chỉ biết "đã đẩy tới Apple/Google", KHÔNG biết máy bà
// con có nhận được không. Nhưng service worker CHẠY THẬT trên máy khi tin tới
// (nhánh `push`) và khi bà con bấm vào (`notificationclick`) — hai chỗ đó gọi
// về đây. Máy vừa nhận được push thì đang có mạng, nên cú gọi này gần như luôn
// đi được.
//
// KHÔNG đòi đăng nhập: service worker không chắc có phiên (tin tới lúc app
// đóng). Khoá là cặp (messageId, endpoint) — biết được endpoint của máy khác
// cũng chỉ đánh dấu hộ nó "đã nhận", không đọc được nội dung gì.
//
// OFFLINE: POST nên service worker bỏ qua ở nhánh cache; mất sóng thì gọi hỏng
// và thôi (client bên kia nuốt lỗi) — biên nhận là thống kê, không phải dữ liệu
// bà con cần.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    messageId?: string;
    endpoint?: string;
    kind?: "delivered" | "opened";
  } | null;
  if (!body?.messageId || !body?.endpoint) {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const now = new Date().toISOString();
  // Ai gửi tin cho máy này thì tra ra từ bảng đăng ký — client không khai.
  const { data: sub, error: subErr } = await admin
    .from("push_subscriptions")
    .select("customer_phone")
    .eq("endpoint", body.endpoint)
    .maybeSingle();
  if (subErr) return NextResponse.json({ ok: false }, { status: 503 });
  /*  ENDPOINT PHẢI CÓ TRONG SỔ ĐĂNG KÝ (audit P3, 2026-08-18): biên nhận là số
      liệu /quan-tri nhìn để kết luận "tin có tới không" — ai cũng ghi được với
      endpoint bịa thì con số đó vô nghĩa. Máy đã huỷ đăng ký (hàng bị dọn) mà
      còn báo về thì bỏ qua, trả ok để service worker thôi thử. */
  if (!sub) return NextResponse.json({ ok: true, counted: 0 });

  const row: Record<string, string | null> = {
    message_id: body.messageId,
    endpoint: body.endpoint,
    account_phone: (sub as { customer_phone: string | null } | null)?.customer_phone ?? null,
  };
  // "đã đọc" bao hàm "đã nhận" — bấm được thì đương nhiên nhận được. Ghi cả hai
  // cho khỏi lệch khi cú báo delivered rơi mất giữa đường.
  if (body.kind === "opened") {
    row.opened_at = now;
    row.delivered_at = now;
  } else {
    row.delivered_at = now;
  }

  const { error } = await admin
    .from("push_receipts")
    .upsert(row, { onConflict: "message_id,endpoint" });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
