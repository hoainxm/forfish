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

/**
 * Khoá công khai VAPID — lấy RUNTIME từ server (/api/push/vapid-public-key,
 * đọc DB-trước rồi env) nên đổi khoá KHÔNG cần build lại. Rơi về
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY (nhúng lúc build) nếu API lỗi. null = chưa cấu hình.
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const r = await fetch(apiUrl("/api/push/vapid-public-key"), {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const j = (await r.json()) as { key?: string | null };
      if (j.key) return j.key;
    }
  } catch {
    // mất mạng / timeout → thử env build-time
  }
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
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

/**
 * Đã đăng ký nhận thông báo trên máy này chưa (không hỏi quyền).
 * `navigator.serviceWorker.ready` KHÔNG BAO GIỜ resolve nếu chưa có service
 * worker nào active cho scope này (vd dev mode — `sw-register.tsx` chỉ đăng
 * ký ở production) → không được để nút "Bật thông báo" treo `disabled` vô
 * hạn (cùng nguyên tắc "không thất bại câm" ở 02-architecture.md §5). Đua
 * với timeout 3s, coi như "chưa đăng ký" nếu quá hạn.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  const reg = await Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    timeout,
  ]);
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

  // Không service worker active thì không thể subscribe — timeout thay vì
  // treo "Đang xử lý" vô hạn (cùng lý do getExistingPushSubscription ở trên).
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
  const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
  if (!reg) return { ok: false, error: "no_service_worker" };
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

/* --------------------------------------------------------------------------
   ĐỒNG BỘ TÀI KHOẢN ↔ MÁY (2026-08-01)
-------------------------------------------------------------------------- */

/**
 * Gắn lại máy này vào TÀI KHOẢN đang đăng nhập. Gọi mỗi lần mở app (ghép vào
 * nhịp heartbeat) — KHÔNG phải chỉ lúc bấm nút bật thông báo.
 *
 * Vì sao cần: (a) ai bật thông báo TRƯỚC khi đăng nhập thì máy ẩn danh vĩnh
 * viễn, đăng nhập sau cũng không có gì gắn lại; (b) Apple/Google XOAY endpoint
 * định kỳ — endpoint mới mà không báo lên là mất liên lạc lặng lẽ.
 *
 * ⚠️ KHÔNG ĐƯỢC LÀM PHIỀN VIỆC ĐI BIỂN: máy chưa đăng ký thông báo thì thoát
 * ngay, không gọi mạng; có đăng ký thì bắn một POST rồi QUÊN — hết giờ 10 giây,
 * nuốt sạch lỗi, không ai đợi kết quả. App không cần cái "OK" của server để
 * chạy: hỏng thì lần mở sau tự thử lại.
 */
export type SyncPushResult =
  /** đã gắn máy này vào tài khoản đang đăng nhập */
  | "attached"
  /** máy chưa bật thông báo → không có gì để gắn */
  | "no-subscription"
  /** máy chủ nhận được nhưng KHÔNG đọc được phiên (chưa đăng nhập / cookie hỏng) */
  | "no-session"
  /** mất sóng / hết giờ / máy chủ lỗi */
  | "failed";

export async function syncPushAccount(): Promise<SyncPushResult> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "failed";
    }
    const sub = await getExistingPushSubscription();
    if (!sub) return "no-subscription";
    const r = await fetch(apiUrl("/api/push/subscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: toInput(sub),
        userAgent: navigator.userAgent,
      }),
      signal: AbortSignal.timeout(10000),
      keepalive: true,
    });
    if (!r.ok) return "failed";
    const j = (await r.json().catch(() => null)) as { attached?: boolean } | null;
    return j?.attached ? "attached" : "no-session";
  } catch {
    /* mất sóng / hết giờ — kệ, lần mở app sau tự gắn lại */
    return "failed";
  }
}

/**
 * GỠ tài khoản khỏi máy này (gọi lúc ĐĂNG XUẤT) nhưng GIỮ đăng ký thông báo.
 * Máy vẫn nhận tin chung, thôi nhận tin nhắm riêng — tàu dùng chung điện thoại
 * thì tin của chủ tàu không được chạy tới máy đang trong tay bạn thuyền.
 */
export async function detachPushAccount(): Promise<void> {
  try {
    const sub = await getExistingPushSubscription();
    if (!sub) return;
    await fetch(apiUrl("/api/push/subscribe"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      signal: AbortSignal.timeout(10000),
      keepalive: true,
    });
  } catch {
    /* đăng xuất KHÔNG được chờ việc này — hỏng thì thôi */
  }
}
