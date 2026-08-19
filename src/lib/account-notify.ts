import "server-only";

// GỬI THÔNG BÁO cho MỘT TÀI KHOẢN (theo SĐT) — dùng cho cập nhật trạng thái đơn
// hàng (đã nhận / đang giao / đã giao / đã huỷ). Gói lại pattern của /api/admin/push:
//   1) GHI vào hộp thư (push_messages) TRƯỚC — lưới an toàn kể cả đẩy hụt / máy
//      đang mất sóng: bà con mở app sau vẫn đọc được (giống đường thông báo tay).
//   2) Đẩy Web Push best-effort tới mọi máy của tài khoản — CHỈ KHI `pushOs`
//      (audit P6, 2026-08-18: đơn hàng là chuyện ở bờ; "đã nhận đơn" chỉ nằm
//      hộp thư, không đánh thức máy; đang giao / đã giao / đã huỷ mới đẩy).
//      Endpoint chết thì dọn.
//
// BEST-EFFORT: mọi lỗi được nuốt — KHÔNG bao giờ làm hỏng việc chính (đổi trạng
// thái đơn). Gọi trong try/catch phía route cho chắc.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPushConfigured, sendPushMany } from "@/lib/push-send";
import { normalizeVnPhone } from "@/lib/phone";

export const ORDER_PUSH_SENT_BY = "system:order";

export async function notifyAccount(
  admin: SupabaseClient,
  phone: string,
  msg: {
    title: string;
    body: string;
    url?: string;
    /** ghi vào push_messages.sent_by — /quan-tri lọc theo tiền tố `system:` */
    sentBy?: string;
    /** false = chỉ ghi hộp thư, KHÔNG đẩy lên máy (mặc định true) */
    pushOs?: boolean;
    /** gom thông báo cùng việc trên máy (vd `don-<orderId>`) */
    tag?: string;
  },
): Promise<void> {
  try {
    const target = normalizeVnPhone(phone);
    if (!target) return;
    const pushOs = msg.pushOs !== false;

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
        // không đẩy OS thì số máy = 0: hộp thư vẫn có, thống kê không khoe hụt
        devices: pushOs ? rows.length : 0,
        sent: 0,
      })
      .select("id")
      .maybeSingle();
    const messageId = (rec as { id: string } | null)?.id ?? null;

    if (!pushOs || rows.length === 0 || !(await isPushConfigured())) return;

    const { sent, goneIds } = await sendPushMany(
      rows.map((r) => ({
        id: r.id as string,
        endpoint: r.endpoint,
        p256dh: r.p256dh,
        authKey: r.auth_key,
      })),
      {
        title: msg.title,
        body: msg.body,
        url: msg.url || "/",
        sentAt: new Date().toISOString(),
        messageId,
        tag: msg.tag,
      },
    );
    if (goneIds.length > 0)
      await admin.from("push_subscriptions").delete().in("id", goneIds);
    if (messageId)
      await admin.from("push_messages").update({ sent }).eq("id", messageId);
  } catch {
    // thông báo là phụ — đơn đã đổi trạng thái xong rồi, nuốt lỗi ở đây
  }
}
