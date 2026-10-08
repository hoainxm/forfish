import "server-only";

// WEB PUSH — GỬI thật (2026-07-28, Phase 3), server-only. Khoá VAPID lấy qua
// lib/app-config.ts: ưu tiên DB (bảng app_config, admin dán ở /quan-tri), thiếu
// thì rơi về env VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT. Nhờ vậy không
// còn lệ thuộc env máy chủ deploy. Dùng trong /api/admin/push (requireStaff),
// lib/account-notify (đơn hàng), /api/cron/notify-storms (bão) — KHÔNG import
// từ client component.

import webpush from "web-push";
import { getVapidConfig } from "@/lib/app-config";
import {
  deliverWithRetry,
  tallyFanout,
  type FanoutTally,
  type SendPushResult,
} from "@/lib/push-delivery";

export type { SendPushResult } from "@/lib/push-delivery";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** ISO giờ GỬI/PHÁT TIN — sw.js tự in "(tin lúc …)" và "TIN CŨ" từ số này */
  sentAt?: string;
  /** id dòng push_messages để máy báo về đã nhận/đã đọc */
  messageId?: string | null;
  /** GOM (2026-08-18, audit P2): cùng `tag` thì tin mới ĐÈ tin cũ trên máy thay vì
      xếp chồng — bão dùng `bao-<khoá>`, đơn hàng `don-<id>`; tin tay không tag. */
  tag?: string;
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

/** Thử lại MỘT lần sau ngần này khi lỗi tạm (audit P11) */
const RETRY_DELAY_MS = 2000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Gửi 1 thông báo. Trả `gone:true` khi endpoint đã chết (404/410) — caller
 * nên xóa subscription đó khỏi DB (dọn rác tự nhiên, không cần cron riêng).
 * `unconfigured:true` nếu chưa có đủ khoá VAPID.
 *
 * Lỗi TẠM (5xx, 429, mạng chớp) → chờ 2s thử lại đúng MỘT lần. 4xx khác (403
 * khoá VAPID lệch…) → KHÔNG thử lại, KHÔNG xoá, trả `status` để đếm theo mã.
 * Luật nằm ở lib/push-delivery.ts (thuần, có test).
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<SendPushResult> {
  const vapid = await getVapidConfig();
  if (!vapid) return { ok: false, unconfigured: true };
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return deliverWithRetry(
    async () => {
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
        return { ok: false, status: (e as { statusCode?: number })?.statusCode };
      }
    },
    () => sleep(RETRY_DELAY_MS),
  );
}

export type PushFanoutRow = PushTarget & { id: string };

/**
 * Gửi cùng một payload tới NHIỀU máy, song song. Trả số gửi được, id các hàng
 * đã chết (caller xoá khỏi push_subscriptions), số hỏng thật và số hỏng THEO MÃ
 * (403 = khoá VAPID lệch…). Một chỗ cho ba đường gửi (tay / đơn hàng / bão) —
 * luật đếm không chép ba bản.
 */
export async function sendPushMany(
  rows: PushFanoutRow[],
  payload: PushPayload,
): Promise<FanoutTally> {
  const results = await Promise.all(
    rows.map((r) => sendPush(r, payload).then((res) => ({ id: r.id, ...res }))),
  );
  return tallyFanout(results);
}
