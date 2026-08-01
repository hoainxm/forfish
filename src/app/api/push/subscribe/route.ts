// /api/push/subscribe — Đăng ký / đồng bộ / gỡ nhận Web Push.
//
// CÁCH GÁN MỘT MÁY VÀO MỘT TÀI KHOẢN (làm rõ 2026-08-01):
//  1. Trình duyệt cấp `endpoint` — URL riêng cho ĐÚNG bản cài trên máy đó
//     (Apple/Google cấp, không tự chế được) + 2 khoá mã hoá. Đó là "id của app
//     trên máy này", và là khoá duy nhất của bảng (onConflict: endpoint).
//  2. Máy gửi bộ đó lên đây KÈM COOKIE PHIÊN. Server TỰ ĐỌC tài khoản từ
//     cookie — client KHÔNG được phép khai mình là ai (khai được thì ai cũng
//     nhận thông báo của người khác).
//  3. Lưu cặp `endpoint ↔ tài khoản`. Gửi thông báo = tra endpoint của tài
//     khoản đó, ký VAPID, đẩy qua Apple/Google.
//
// TÀI KHOẢN Ở ĐÂY LÀ SĐT: `customers.phone` là khoá chính của tài khoản, auth
// user là email ảo {sđt}@sdvico.local. `customer_phone` là CON TRỎ TỚI TÀI
// KHOẢN, không phải "số để liên lạc" — nên phải CHUẨN HOÁ như mọi id khác.
//
// BA LỖI ĐÃ SỬA (2026-08-01):
//  · id không chuẩn hoá: lấy `email.split("@")[0]` trần trong khi cả app dùng
//    `normalizeVnPhone` ⇒ một tài khoản có email ảo dạng 84xxx là khớp trượt,
//    gửi cho 0 người mà không ai biết.
//  · GHI ĐÈ BẰNG NULL: upsert luôn kèm `customer_phone` kể cả khi đọc không ra
//    phiên ⇒ một máy từng gắn đúng tài khoản bị xoá trắng về ẩn danh.
//  · gán CHỈ MỘT LẦN lúc bấm nút: bật thông báo trước khi đăng nhập là ẩn danh
//    vĩnh viễn. Nay client đồng bộ lại mỗi lần mở app (POST y hệt), và endpoint
//    do Apple/Google xoay định kỳ cũng nhờ đó mà theo kịp.
//
// PATCH = GỠ TÀI KHOẢN khỏi máy (đăng xuất) mà GIỮ đăng ký: máy vẫn nhận thông
// báo chung, nhưng thôi nhận thông báo nhắm riêng — tàu dùng chung điện thoại,
// không để tin của chủ tàu chạy tới máy đang trong tay bạn thuyền.
//
// OFFLINE: mọi nhánh ở đây là POST/PATCH/DELETE nên service worker BỎ QUA hẳn.
// Client gọi kiểu bắn-rồi-quên, mất sóng thì thôi (xem lib/push-client.ts).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVnPhone } from "@/lib/phone";
import {
  validatePushSubscription,
  type PushSubscriptionInput,
} from "@/lib/push-subscriptions";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

/** Tài khoản đang đăng nhập, ĐÃ CHUẨN HOÁ — null khi không đọc được phiên */
async function currentAccount(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (!email) return null;
  return normalizeVnPhone(email.split("@")[0]);
}

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    subscription?: PushSubscriptionInput;
    userAgent?: string;
  } | null;
  const invalid = validatePushSubscription(body?.subscription);
  if (invalid) return err(400, "invalid_subscription");
  const sub = body!.subscription!;

  const account = await currentAccount();
  const nowIso = new Date().toISOString();
  const row: Record<string, string | null> = {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth_key: sub.keys.auth,
    user_agent: body?.userAgent?.slice(0, 300) || null,
    last_seen_at: nowIso,
  };
  // CHỈ ghi cột tài khoản khi ĐỌC ĐƯỢC phiên. Không đọc được (chưa đăng nhập,
  // cookie chưa kịp, sóng "sống mà chết") thì BỎ HẲN cột khỏi payload —
  // PostgREST chỉ SET những cột có trong payload, nên giá trị cũ được giữ
  // nguyên thay vì bị null hoá.
  if (account) row.customer_phone = account;

  const { error } = await admin
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" });
  if (error) return err(500, "insert_failed");
  return NextResponse.json({ ok: true, attached: !!account });
}

/**
 * GỠ TÀI KHOẢN khỏi một máy (gọi lúc ĐĂNG XUẤT) — giữ đăng ký để máy vẫn nhận
 * thông báo chung. Không đòi phiên: người vừa đăng xuất thì cookie đã mất, mà
 * việc này chỉ BỚT quyền nhận nên không có gì để lạm dụng (biết endpoint của
 * máy khác cũng chỉ gỡ được tin nhắm riêng của chính máy đó).
 */
export async function PATCH(req: Request) {
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
  } | null;
  if (!body?.endpoint) return err(400, "bad_endpoint");

  const { error } = await admin
    .from("push_subscriptions")
    .update({ customer_phone: null })
    .eq("endpoint", body.endpoint);
  if (error) return err(500, "detach_failed");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");

  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
  } | null;
  if (!body?.endpoint) return err(400, "bad_endpoint");

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint);
  if (error) return err(500, "delete_failed");
  return NextResponse.json({ ok: true });
}
