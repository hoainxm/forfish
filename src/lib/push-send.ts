import "server-only";

// WEB PUSH — GỬI thật (2026-07-28, Phase 3), server-only. Cần env
// VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (tạo bằng `npx web-push generate-vapid-keys`,
// NEXT_PUBLIC_VAPID_PUBLIC_KEY phía client phải TRÙNG VAPID_PUBLIC_KEY) +
// VAPID_SUBJECT (mailto: hoặc https: liên hệ, web-push yêu cầu). Dùng trong
// /api/admin/push (requireStaff) — KHÔNG import từ client component.

import webpush from "web-push";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  authKey: string;
}

/** true nếu đủ env để gửi push thật. */
export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

let configured = false;
function ensureVapid() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Gửi 1 thông báo. Trả `gone:true` khi endpoint đã chết (404/410) — caller
 * nên xóa subscription đó khỏi DB (dọn rác tự nhiên, không cần cron riêng).
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean }> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.authKey },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    return { ok: false, gone: status === 404 || status === 410 };
  }
}
