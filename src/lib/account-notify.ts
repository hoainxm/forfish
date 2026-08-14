import "server-only";

// GỬI THÔNG BÁO cho MỘT TÀI KHOẢN (theo SĐT) — dùng cho cập nhật trạng thái đơn
// hàng (đã nhận / đang giao / đã giao). Gói lại pattern của /api/admin/push:
//   1) GHI vào hộp thư (push_messages) TRƯỚC — lưới an toàn kể cả đẩy hụt / máy
//      đang mất sóng: bà con mở app sau vẫn đọc được (giống đường thông báo tay).
//   2) Đẩy Web Push best-effort tới mọi máy của tài khoản; endpoint chết thì dọn.
//
// BEST-EFFORT: mọi lỗi được nuốt — KHÔNG bao giờ làm hỏng việc chính (đổi trạng
// thái đơn). Gọi trong try/catch phía route cho chắc.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPushConfigured, sendPush } from "@/lib/push-send";
import { normalizeVnPhone } from "@/lib/phone";

export async function notifyAccount(
  admin: SupabaseClient,
  phone: string,
  msg: { title: string; body: string; url?: string; sentBy?: string },
): Promise<void> {
  try {
    const target = normalizeVnPhone(phone);
    if (!target) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth_key")
      .eq("customer_phone", target);
    const rows = subs ?? [];

    const { data: rec } = await admin
      .from("push_messages")
      .insert({
        title: msg.title,
        body: msg.body,
        url: msg.url || null,
        target: "account",
        target_phone: target,
        sent_by: msg.sentBy || "system",
        devices: rows.length,
        sent: 0,
      })
      .select("id")
      .maybeSingle();
    const messageId = (rec as { id: string } | null)?.id ?? null;

    if (rows.length === 0 || !(await isPushConfigured())) return;

    const payload = {
      title: msg.title,
      body: msg.body,
      url: msg.url || "/",
      sentAt: new Date().toISOString(),
      messageId,
    };
    const results = await Promise.all(
      rows.map((r) =>
        sendPush(
          { endpoint: r.endpoint, p256dh: r.p256dh, authKey: r.auth_key },
          payload,
        ).then((res) => ({ id: r.id as string, ...res })),
      ),
    );
    const sent = results.filter((r) => r.ok).length;
    const gone = results.filter((r) => !r.ok && r.gone).map((r) => r.id);
    if (gone.length > 0)
      await admin.from("push_subscriptions").delete().in("id", gone);
    if (messageId)
      await admin.from("push_messages").update({ sent }).eq("id", messageId);
  } catch {
    // thông báo là phụ — đơn đã đổi trạng thái xong rồi, nuốt lỗi ở đây
  }
}
