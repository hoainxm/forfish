"use client";

// WEB PUSH — helper PHÍA TRÌNH DUYỆT (2026-07-28, Phase 3). Đăng ký/hủy nhận
// thông báo qua service worker sẵn có (public/sw.js). Dùng trong
// hero-account.tsx (sheet Tài khoản → "Bật thông báo").

import { apiUrl } from "@/lib/api-base";
import type { PushSubscriptionInput } from "@/lib/push-subscriptions";

/** VAPID public key trình duyệt cần dạng Uint8Array, server phát base64url. Thuần, có test. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Máy có hỗ trợ Web Push không (Safari cũ / trình duyệt lạ có thể thiếu). */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function toInput(sub: PushSubscription): PushSubscriptionInput {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint ?? "",
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
  };
}

/** Đã đăng ký nhận thông báo trên máy này chưa (không hỏi quyền). */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Hỏi quyền + đăng ký nhận thông báo, gửi lên server lưu.
 * `vapidPublicKey` = NEXT_PUBLIC_VAPID_PUBLIC_KEY (đọc phía component để rõ
 * lỗi "chưa cấu hình" thay vì import.meta ẩn trong lib).
 */
export async function subscribeToPush(
  vapidPublicKey: string,
  phone?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "denied" };

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  const r = await fetch(apiUrl("/api/push/subscribe"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: toInput(sub),
      phone: phone ?? undefined,
      userAgent: navigator.userAgent,
    }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!r?.ok) return { ok: false, error: "save_failed" };
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const sub = await getExistingPushSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  const r = await fetch(apiUrl("/api/push/subscribe"), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  return Boolean(r?.ok);
}
