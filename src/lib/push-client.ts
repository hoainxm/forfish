"use client";

// WEB PUSH — helper PHÍA TRÌNH DUYỆT (2026-07-28, Phase 3). Đăng ký/hủy nhận
// thông báo qua service worker sẵn có (public/sw.js). Dùng trong
// hero-account.tsx (sheet Tài khoản → "Bật thông báo").

import { apiUrl } from "@/lib/api-base";
import type { PushSubscriptionInput } from "@/lib/push-subscriptions";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";

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
 * Khoá công khai VAPID mà SERVER đang dùng (/api/push/vapid-public-key, đọc
 * DB-trước rồi env). `null` = không hỏi được (mất sóng, hết 8s, lỗi) — KHÔNG
 * rơi về khoá nhúng lúc build: so khoá để đăng ký lại mà dùng khoá build cũ là
 * tự hủy một đăng ký đang chạy tốt.
 */
async function fetchServerVapidKey(): Promise<string | null> {
  try {
    const r = await fetch(apiUrl("/api/push/vapid-public-key"), {
      signal: timeoutSignal(8000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { key?: string | null };
    return j.key || null;
  } catch {
    return null;
  }
}

/**
 * Khoá công khai VAPID — lấy RUNTIME từ server nên đổi khoá KHÔNG cần build
 * lại. Rơi về NEXT_PUBLIC_VAPID_PUBLIC_KEY (nhúng lúc build) nếu API lỗi — chỉ
 * để BẬT thông báo lần đầu; null = chưa cấu hình.
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  return (await fetchServerVapidKey()) ?? (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null);
}

/**
 * Đăng ký trên máy có dùng ĐÚNG khoá server đang ký không. Thuần, có test.
 * `null` = KHÔNG BIẾT (trình duyệt cũ không có `options.applicationServerKey`,
 * hoặc khoá server sai dạng) → người gọi giữ nguyên, không đụng gì.
 */
export function sameServerKey(
  current: ArrayBuffer | null | undefined,
  serverKey: string,
): boolean | null {
  if (!current) return null;
  let want: Uint8Array;
  try {
    want = urlBase64ToUint8Array(serverKey);
  } catch {
    return null;
  }
  const have = new Uint8Array(current);
  if (have.length !== want.length) return false;
  for (let i = 0; i < have.length; i++) if (have[i] !== want[i]) return false;
  return true;
}

export type RekeyStep =
  /** không làm gì */
  | "keep"
  /** khoá đổi: hủy đăng ký cũ → đăng ký bằng khoá mới */
  | "rotate"
  /** lần trước hủy xong mà chưa đăng ký lại được (mất sóng giữa chừng) → làm nốt */
  | "resubscribe";

/**
 * Quyết định ĐĂNG KÝ LẠI KHI KHOÁ VAPID ĐỔI. Thuần, có test.
 * Chỉ khi đã cấp quyền + hỏi được khoá server. Có đăng ký mà khoá lệch CHẮC
 * CHẮN (`false`, không phải `null`) mới hủy. Không có đăng ký thì CHỈ làm tiếp
 * khi có dấu "đang đổi dở" — máy tự tắt thông báo thì để yên.
 */
export function decideRekey(input: {
  permission: NotificationPermission | "unsupported";
  hasSubscription: boolean;
  pending: boolean;
  serverKey: boolean;
  keyMatch: boolean | null;
}): RekeyStep {
  if (input.permission !== "granted" || !input.serverKey) return "keep";
  if (!input.hasSubscription) return input.pending ? "resubscribe" : "keep";
  return input.keyMatch === false ? "rotate" : "keep";
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
  const reg = await readyRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Service worker đã sẵn — đua với 3s (xem getExistingPushSubscription). */
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  return Promise.race([navigator.serviceWorker.ready.catch(() => null), timeout]);
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
    headers: { "Content-Type": "application/json", ...tokenHeader() },
    body: JSON.stringify({
      subscription: toInput(sub),
      phone: phone ?? undefined,
      userAgent: navigator.userAgent,
    }),
    signal: timeoutSignal(20000),
  }).catch(() => null);
  if (!r?.ok) return { ok: false, error: "save_failed" };
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  // bà con TỰ TẮT: bỏ dấu đổi khoá dở, kẻo lần mở sau "làm nốt" = bật lại trái ý
  clearRekey();
  const sub = await getExistingPushSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  const r = await fetch(apiUrl("/api/push/subscribe"), {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...tokenHeader() },
    body: JSON.stringify({ endpoint }),
    signal: timeoutSignal(20000),
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

/*  ĐĂNG KÝ LẠI KHI KHOÁ VAPID ĐỔI (2026-10-07). Máy đăng ký bằng khoá cũ mà
    server ký bằng khoá mới thì Apple/Google trả 403 — máy im lặng mất mọi tin,
    kể cả tin bão. Trình duyệt KHÔNG cho đăng ký khoá mới khi còn đăng ký cũ, nên
    phải hủy trước rồi mới đăng ký. Hủy xong mà mất sóng giữa chừng thì máy không
    còn đăng ký nào, và lần mở sau không phân biệt được với "bà con tự tắt" — nên
    ghi DẤU `forfish.push.rekey.v1` TRƯỚC khi hủy, giữ tới khi server nhận đăng ký
    mới. Dấu mang endpoint CŨ để server xoá dòng cũ. */
const REKEY_KEY = "forfish.push.rekey.v1";
type RekeyMark = { oldEndpoint: string | null; at: string };

function readRekey(): RekeyMark | null {
  try {
    const raw = localStorage.getItem(REKEY_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<RekeyMark>;
    return { oldEndpoint: typeof j.oldEndpoint === "string" ? j.oldEndpoint : null, at: String(j.at ?? "") };
  } catch {
    return null;
  }
}
function writeRekey(m: RekeyMark): void {
  try {
    localStorage.setItem(REKEY_KEY, JSON.stringify(m));
  } catch {
    /* hết chỗ / chế độ riêng tư — vẫn đổi khoá, chỉ mất khả năng làm nốt nếu đứt giữa chừng */
  }
}
function clearRekey(): void {
  try {
    localStorage.removeItem(REKEY_KEY);
  } catch {
    /* kệ */
  }
}

type RekeyResult = { sub: PushSubscription | null; pending: RekeyMark | null };

/** Mỗi lần mở app so khoá TỐI ĐA MỘT LẦN (heartbeat + các nút đều gọi sync). */
let rekeyRun: Promise<RekeyResult> | null = null;

/**
 * So khoá rồi đổi đăng ký nếu cần. Trả đăng ký HIỆN TẠI (có thể là cái mới) +
 * dấu đang dở. Mọi lỗi → giữ nguyên cái đang có, không ném.
 * Lúc mở app heartbeat + hero-account gọi CÙNG LÚC: lượt sau phải ĐỢI lượt đầu
 * xong rồi đọc lại đăng ký — nếu không nó POST endpoint CŨ (upsert) đè lên lúc
 * lượt đầu vừa xoá, để lại một dòng 403 vĩnh viễn.
 */
async function ensureCurrentKey(
  reg: ServiceWorkerRegistration,
  sub: PushSubscription | null,
): Promise<RekeyResult> {
  if (rekeyRun) {
    await rekeyRun;
    const now = await reg.pushManager.getSubscription().catch(() => null);
    return { sub: now, pending: readRekey() };
  }
  rekeyRun = rekeyOnce(reg, sub);
  return rekeyRun;
}

async function rekeyOnce(
  reg: ServiceWorkerRegistration,
  sub: PushSubscription | null,
): Promise<RekeyResult> {
  let pending = readRekey();
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  // không quyền / không có gì để so / trình duyệt không cho biết khoá → khỏi gọi mạng
  if (permission !== "granted") return { sub, pending };
  if (!sub && !pending) return { sub, pending };
  const knownKey = sub ? sub.options?.applicationServerKey ?? null : null;
  if (sub && !knownKey && !pending) return { sub, pending };

  const serverKey = await fetchServerVapidKey();
  const step = decideRekey({
    permission,
    hasSubscription: !!sub,
    pending: !!pending,
    serverKey: !!serverKey,
    keyMatch: sub && serverKey ? sameServerKey(knownKey, serverKey) : null,
  });
  if (step === "keep" || !serverKey) return { sub, pending };

  if (step === "rotate") {
    pending = { oldEndpoint: sub!.endpoint, at: new Date().toISOString() };
    writeRekey(pending); // GHI TRƯỚC khi hủy — đứt giữa chừng thì lần sau làm nốt
    const gone = await sub!.unsubscribe().catch(() => false);
    if (!gone) {
      clearRekey(); // không hủy được → cái cũ vẫn là cái đang có, không có gì dở
      return { sub, pending: null };
    }
  }
  // subscribe phải tới được máy chủ Apple/Google — sóng "sống mà chết" có thể
  // treo nó vô hạn, kéo theo mọi lượt sync đang đợi rekeyRun. Quá 15s coi như hỏng.
  const fresh = await Promise.race([
    reg.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(serverKey) as BufferSource,
      })
      .catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
  ]);
  // đăng ký mới hỏng → GIỮ dấu, lần mở app sau "resubscribe" làm nốt
  return { sub: fresh, pending };
}

export async function syncPushAccount(): Promise<SyncPushResult> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "failed";
    }
    const reg = await readyRegistration();
    if (!reg) return "no-subscription";
    const existing = await reg.pushManager.getSubscription();
    const { sub, pending } = await ensureCurrentKey(reg, existing);
    if (!sub) return pending ? "failed" : "no-subscription";
    const oldEndpoint =
      pending?.oldEndpoint && pending.oldEndpoint !== sub.endpoint ? pending.oldEndpoint : undefined;
    // POST là UPSERT theo endpoint — gửi lặp mỗi lần mở app không sao, và POST
    // hỏng thì lần sau gửi lại endpoint hiện tại: server không bao giờ mất dấu
    // một đăng ký mới (dấu đổi khoá chỉ xoá khi server đã nhận).
    const r = await fetch(apiUrl("/api/push/subscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tokenHeader() },
      body: JSON.stringify({
        subscription: toInput(sub),
        userAgent: navigator.userAgent,
        ...(oldEndpoint ? { oldEndpoint } : {}),
      }),
      signal: timeoutSignal(10000),
      keepalive: true,
    });
    if (!r.ok) return "failed";
    if (pending) clearRekey();
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
      headers: { "Content-Type": "application/json", ...tokenHeader() },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      signal: timeoutSignal(10000),
      keepalive: true,
    });
  } catch {
    /* đăng xuất KHÔNG được chờ việc này — hỏng thì thôi */
  }
}
