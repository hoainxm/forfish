// WEB PUSH — đăng ký nhận thông báo (2026-07-28, Phase 3). Types + validate
// thuần dùng chung server/client. Gửi thật (web-push, VAPID) nằm ở
// src/lib/push-send.ts (server-only, cần env VAPID_*).
//
// Helper thuần tách riêng để test ở
// src/lib/__tests__/push-subscriptions.test.ts.

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

/** Shape trả về từ `PushSubscription.toJSON()` trên trình duyệt. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

/** Trả câu lỗi tiếng Việt nếu subscription thiếu field bắt buộc, null nếu OK. */
export function validatePushSubscription(
  sub: PushSubscriptionInput | null | undefined,
): string | null {
  if (!sub?.endpoint?.trim()) return "Thiếu endpoint đăng ký.";
  if (!sub.keys?.p256dh?.trim() || !sub.keys?.auth?.trim())
    return "Thiếu khoá mã hoá đăng ký.";
  return null;
}
