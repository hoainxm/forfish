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
// PATCH/DELETE ĐÒI CHỨNG THỰC từ 2026-08-18 (audit P3) — xem `actorFor` bên dưới.
//
// OFFLINE: mọi nhánh ở đây là POST/PATCH/DELETE nên service worker BỎ QUA hẳn.
// Client gọi kiểu bắn-rồi-quên, mất sóng thì thôi (xem lib/push-client.ts).
import { NextResponse } from "next/server";
import { identityFromRequest } from "@/lib/api-identity";
import { hashDeviceToken, readTokenHeader } from "@/lib/device-token";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validatePushSubscription,
  type PushSubscriptionInput,
} from "@/lib/push-subscriptions";

const err = (status: number, code: string) =>
  NextResponse.json({ ok: false, code }, { status });

/** Tài khoản đang đăng nhập, ĐÃ CHUẨN HOÁ — null khi máy chưa gắn tài khoản.
 *
 *  `anonymous = true` vì đăng ký thông báo KHÔNG đòi tài khoản: máy chưa đăng
 *  nhập vẫn nhận được tin chung (tin bão), đó là cả lý do tính năng này tồn tại.
 *  Không tra được danh tính cũng trả `null` — đăng ký ẩn danh còn hơn không đăng
 *  ký được, và ghi đè bằng null đã có lá chắn riêng bên dưới. */
async function currentAccount(req: Request): Promise<string | null> {
  const who = await identityFromRequest(req, true);
  return who.ok && who.phone ? who.phone : null;
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

  const account = await currentAccount(req);
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

/*  AI ĐƯỢC ĐỤNG HÀNG NÀO (audit P3, 2026-08-18) — chung cho PATCH và DELETE:
      · có chuỗi máy hợp lệ → chỉ hàng của CHÍNH SĐT mình, hoặc hàng chưa gắn ai;
      · không chuỗi (máy khách) → chỉ hàng `customer_phone IS NULL`.
    Trước đây ai biết endpoint là gỡ/xoá được của người khác — endpoint khó đoán
    nhưng "khó đoán" không phải là quyền.

    RIÊNG PATCH (gỡ tài khoản lúc ĐĂNG XUẤT): hero-account gọi `detachPushAccount`
    SAU khi đã thu hồi chuỗi (DELETE /api/auth/token) ⇒ lúc tới đây chuỗi đã
    `token_revoked`. Nếu chặn thẳng thì đúng ca cần gỡ nhất — chủ tàu đăng xuất
    trao máy cho bạn thuyền — lại là ca KHÔNG gỡ được, và tin nhắm riêng của chủ
    tàu tiếp tục nhảy lên máy bạn thuyền. Nên với PATCH, chuỗi VỪA BỊ THU HỒI
    vẫn được tính là "của SĐT đó" (tra thẳng device_tokens kể cả revoked_at) —
    thu hồi là bằng chứng máy này TỪNG là máy của tài khoản, và việc gỡ chỉ BỚT
    quyền nhận. DELETE (tắt thông báo, gọi khi còn đăng nhập) không có ngoại lệ. */
type Actor = { phone: string | null } | { res: NextResponse };

async function actorFor(
  req: Request,
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  allowRevoked: boolean,
): Promise<Actor> {
  const who = await identityFromRequest(req, true);
  if (who.ok) return { phone: who.phone || null };
  // KHÔNG TRA ĐƯỢC → 503, không bao giờ coi là "không có quyền"
  if (who.res.status === 503) return { res: who.res };
  if (allowRevoked) {
    const raw = readTokenHeader(req.headers);
    if (raw) {
      const { data, error } = await admin
        .from("device_tokens")
        .select("customer_phone")
        .eq("token_hash", await hashDeviceToken(raw))
        .maybeSingle();
      if (error) return { res: err(503, "unavailable") };
      const p = (data as { customer_phone: string } | null)?.customer_phone;
      if (p) return { phone: p }; // cùng dạng tokenIdentity trả về (đã chuẩn hoá lúc cấp)
    }
  }
  // chuỗi lạ / đã thu hồi mà không được ngoại lệ → xem như máy khách
  return { phone: null };
}

/** Hàng có tồn tại và người gọi có được đụng không. `null` = không có hàng (idempotent, trả ok). */
async function ownedRow(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  endpoint: string,
  actorPhone: string | null,
): Promise<{ allowed: boolean; exists: boolean } | { res: NextResponse }> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("customer_phone")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) return { res: err(500, "query_failed") };
  if (!data) return { allowed: true, exists: false };
  const owner = (data as { customer_phone: string | null }).customer_phone;
  return { allowed: !owner || owner === actorPhone, exists: true };
}

/**
 * GỠ TÀI KHOẢN khỏi một máy (gọi lúc ĐĂNG XUẤT) — giữ đăng ký để máy vẫn nhận
 * thông báo chung. Chỉ gỡ được hàng của mình / hàng chưa gắn (xem ghi chú trên).
 */
export async function PATCH(req: Request) {
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured");
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
  } | null;
  if (!body?.endpoint) return err(400, "bad_endpoint");

  const actor = await actorFor(req, admin, true);
  if ("res" in actor) return actor.res;
  const own = await ownedRow(admin, body.endpoint, actor.phone);
  if ("res" in own) return own.res;
  if (!own.exists) return NextResponse.json({ ok: true });
  if (!own.allowed) return err(403, "forbidden");

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

  const actor = await actorFor(req, admin, false);
  if ("res" in actor) return actor.res;
  const own = await ownedRow(admin, body.endpoint, actor.phone);
  if ("res" in own) return own.res;
  if (!own.exists) return NextResponse.json({ ok: true });
  if (!own.allowed) return err(403, "forbidden");

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint);
  if (error) return err(500, "delete_failed");
  return NextResponse.json({ ok: true });
}
