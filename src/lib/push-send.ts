import "server-only";

// WEB PUSH — GỬI thật (2026-07-28, Phase 3), server-only. Khoá VAPID lấy qua
// lib/app-config.ts: ưu tiên DB (bảng app_config, admin dán ở /quan-tri), thiếu
// thì rơi về env VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT. Nhờ vậy không
// còn lệ thuộc env máy chủ deploy. Dùng trong /api/admin/push (requireStaff),
// lib/account-notify (đơn hàng), /api/cron/notify-storms (bão) — KHÔNG import
// từ client component.

import webpush from "web-push";
import { getVapidConfig } from "@/lib/app-config";

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

/** Thử lại MỘT lần sau ngần này khi lỗi không phải endpoint chết (audit P11) */
const RETRY_DELAY_MS = 2000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type SendPushResult = { ok: boolean; gone?: boolean; unconfigured?: boolean };

/**
 * Gửi 1 thông báo. Trả `gone:true` khi endpoint đã chết (404/410) — caller
 * nên xóa subscription đó khỏi DB (dọn rác tự nhiên, không cần cron riêng).
 * `unconfigured:true` nếu chưa có đủ khoá VAPID.
 *
 * LỖI KHÁC 404/410 (5xx của Apple/Google, mạng chớp) → chờ 2s thử lại đúng MỘT
 * lần trong cùng request rồi mới đếm là hỏng — có trần, không vòng lặp.
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<SendPushResult> {
  const vapid = await getVapidConfig();
  if (!vapid) return { ok: false, unconfigured: true };
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const once = async (): Promise<SendPushResult> => {
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
  };
  const first = await once();
  if (first.ok || first.gone) return first;
  await sleep(RETRY_DELAY_MS);
  return once();
}

export type PushFanoutRow = PushTarget & { id: string };

/**
 * Gửi cùng một payload tới NHIỀU máy, song song. Trả số gửi được, id các hàng
 * đã chết (caller xoá khỏi push_subscriptions) và số hỏng thật. Một chỗ cho ba
 * đường gửi (tay / đơn hàng / bão) — luật đếm sent/gone/failed không chép ba bản.
 */
export async function sendPushMany(
  rows: PushFanoutRow[],
  payload: PushPayload,
): Promise<{ sent: number; goneIds: string[]; failed: number }> {
  const results = await Promise.all(
    rows.map((r) => sendPush(r, payload).then((res) => ({ id: r.id, ...res }))),
  );
  const sent = results.filter((r) => r.ok).length;
  const goneIds = results.filter((r) => !r.ok && r.gone).map((r) => r.id);
  return { sent, goneIds, failed: results.length - sent - goneIds.length };
}
