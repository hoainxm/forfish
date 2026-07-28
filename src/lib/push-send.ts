import "server-only";

// WEB PUSH — GỬI thật (2026-07-28, Phase 3), server-only. Khoá VAPID lấy qua
// lib/app-config.ts: ưu tiên DB (bảng app_config, admin dán ở /quan-tri), thiếu
// thì rơi về env VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT. Nhờ vậy không
// còn lệ thuộc env máy chủ deploy. Dùng trong /api/admin/push (requireStaff) —
// KHÔNG import từ client component.

import webpush from "web-push";
import { getVapidConfig } from "@/lib/app-config";

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

/** true nếu đủ khoá VAPID (DB hoặc env) để gửi push thật. */
export async function isPushConfigured(): Promise<boolean> {
  return (await getVapidConfig()) !== null;
}

/**
 * Gửi 1 thông báo. Trả `gone:true` khi endpoint đã chết (404/410) — caller
 * nên xóa subscription đó khỏi DB (dọn rác tự nhiên, không cần cron riêng).
 * `unconfigured:true` nếu chưa có đủ khoá VAPID.
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean; unconfigured?: boolean }> {
  const vapid = await getVapidConfig();
  if (!vapid) return { ok: false, unconfigured: true };
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
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
