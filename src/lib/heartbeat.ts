"use client";

// MÁY TỰ BÁO ĐÃ MỞ APP — gửi về /api/me/heartbeat.
//
// ⚠️ RÀNG BUỘC SỐ MỘT: KHÔNG ĐƯỢC LÀM PHIỀN VIỆC ĐI BIỂN.
// Đây là tính năng cho NGƯỜI QUẢN TRỊ, không phải cho ngư dân. Nó tuyệt đối
// không được: chặn màn hình, ngốn sóng giữa biển, hay ném lỗi ra ngoài. Bốn
// hàng rào, theo đúng thứ tự:
//   1. MẤT SÓNG → không gọi gì cả (kiểm `navigator.onLine` trước tiên).
//   2. CỬA CHẶN 12 GIỜ/máy — mở app 20 lần/ngày cũng chỉ gửi một lần. Ngoài
//      khơi sóng yếu, mỗi request thừa là một lần tranh băng thông với tin bão.
//   3. ĐỒNG HỒ 8 giây + `.catch()` nuốt sạch — sóng "sống mà chết" (bắt tay
//      được, gói tin không về) không được để lại một promise treo.
//   4. GỌI TRONG useEffect, KHÔNG await ở đường vẽ màn — màn hình không bao giờ
//      phải đợi nó.
// Và nó là POST nên service worker bỏ qua hẳn: không cache, không cứu, không
// đụng gì tới kho offline.

import { apiUrl } from "@/lib/api-base";

/** Mốc lần gửi gần nhất — quy ước key forfish.* (state-registry) */
export const HEARTBEAT_KEY = "forfish.heartbeat.v1";

/** Gửi nhiều nhất một lần mỗi 12 giờ trên một máy */
export const HEARTBEAT_MIN_GAP_MS = 12 * 60 * 60 * 1000;

/** Đồng hồ chặn: sóng treo thì bỏ, đừng để promise lửng lơ */
const HEARTBEAT_TIMEOUT_MS = 8000;

/**
 * Có nên gửi lúc này không — THUẦN, có test.
 * `lastAt = null` (chưa gửi bao giờ) → gửi. Mất sóng → không.
 */
export function shouldSendHeartbeat(args: {
  online: boolean;
  lastAt: number | null;
  nowMs: number;
}): boolean {
  if (!args.online) return false;
  if (args.lastAt == null) return true;
  return args.nowMs - args.lastAt >= HEARTBEAT_MIN_GAP_MS;
}

function lastSentAt(): number | null {
  try {
    const raw = window.localStorage.getItem(HEARTBEAT_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function markSent(now: number): void {
  try {
    window.localStorage.setItem(HEARTBEAT_KEY, String(now));
  } catch {
    /* hết chỗ / chế độ riêng tư — bỏ qua, lần sau gửi lại */
  }
}

/**
 * Gửi một nhịp. KHÔNG BAO GIỜ ném, không bao giờ chặn. Trả về `true` nếu có
 * gửi thật (dùng cho test/gỡ lỗi, chỗ gọi không cần đọc).
 */
export async function sendHeartbeat(info: {
  standalone: boolean;
  /** máy iOS — máy chủ cần biết để KHÔNG tính "đủ đồ" khi nhịp gửi từ Safari
   *  (bản cài trên iOS có kho riêng — xem lib/app-usage.ts) */
  ios: boolean;
  offlineReady: boolean;
}): Promise<boolean> {
  try {
    const online =
      typeof navigator === "undefined" ? false : navigator.onLine !== false;
    const now = Date.now();
    if (!shouldSendHeartbeat({ online, lastAt: lastSentAt(), nowMs: now })) {
      return false;
    }
    // ĐÁNH DẤU TRƯỚC KHI GỬI: gửi hỏng cũng không thử lại ngay: thà mất một
    // nhịp thống kê còn hơn mỗi lần mở app lại đập vào đường truyền yếu.
    markSent(now);
    await fetch(apiUrl("/api/me/heartbeat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(info),
      signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS),
      keepalive: true,
    });
    return true;
  } catch {
    return false; // mất sóng / hết giờ / máy chủ hỏng — kệ, không phải việc của bà con
  }
}
