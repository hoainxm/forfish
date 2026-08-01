"use client";

// HỘP THƯ — tin đã gửi cho tài khoản này, đọc lại được ở trang chủ (0023).
//
// VÌ SAO CÓ: thông báo đẩy vuốt tắt là MẤT, app không có chỗ xem lại. Ngư dân
// để điện thoại trong túi, tay ướt, dễ vuốt nhầm — tin bão biến mất không dấu
// vết. Đây cũng là lưới an toàn cho ca đẩy hụt: máy chưa gắn tài khoản, hết
// hạn TTL, tắt quyền thông báo… tin vẫn nằm đây, mở app là đọc được.
//
// ⚠️ CÁCH LY TÀI KHOẢN: bản lưu offline mang theo SĐT CHỦ NHÂN. Máy dùng chung
// trên tàu, đổi tài khoản là bản của người trước KHÔNG được đọc — cùng luật đã
// áp cho service worker (không cache route gắn danh tính) và cho dấu premium.
//
// ⚠️ OFFLINE: đọc bản lưu TRƯỚC, gọi mạng sau và chỉ để làm mới. Mất sóng thì
// mục Thông báo vẫn hiện đủ tin cũ, không quay vòng chờ.

import { apiUrl } from "@/lib/api-base";

export interface InboxMessage {
  id: string;
  title: string;
  body: string;
  url: string | null;
  /** ISO — giờ GỬI, không phải giờ nhận */
  sentAt: string;
  /** tin nhắm riêng tài khoản này (khác tin gửi chung) */
  mine: boolean;
}

/** Quy ước key forfish.* (xem ops/state-registry.md) */
export const INBOX_KEY = "forfish.inbox.v1";

type Stored = { phone: string; savedAt: number; messages: InboxMessage[] };

/** Bản lưu của ĐÚNG tài khoản này; SĐT lệch → coi như chưa có gì. */
export function loadInbox(phone: string | null): InboxMessage[] {
  if (!phone || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INBOX_KEY);
    if (!raw) return [];
    const s = JSON.parse(raw) as Stored;
    if (s?.phone !== phone || !Array.isArray(s.messages)) return [];
    return s.messages;
  } catch {
    return [];
  }
}

function saveInbox(phone: string, messages: InboxMessage[]): void {
  try {
    window.localStorage.setItem(
      INBOX_KEY,
      JSON.stringify({ phone, savedAt: Date.now(), messages } satisfies Stored),
    );
  } catch {
    /* máy hết chỗ — hộp thư là tiện ích, không được chen chỗ của dự báo */
  }
}

/** Gọi lúc ĐĂNG XUẤT — không để thư của người trước nằm lại trên máy chung. */
export function clearInbox(): void {
  try {
    window.localStorage.removeItem(INBOX_KEY);
  } catch {
    /* bỏ qua */
  }
}

/**
 * Làm mới từ máy chủ. Trả về danh sách MỚI, hoặc `null` nếu không lấy được
 * (mất sóng / chưa đăng nhập) — chỗ gọi giữ nguyên bản đang hiện.
 *
 * KHÔNG BAO GIỜ ném. Có đồng hồ 10 giây: mục Thông báo không được là lý do
 * khiến trang chủ quay vòng giữa biển.
 */
export async function refreshInbox(): Promise<{
  phone: string | null;
  messages: InboxMessage[];
} | null> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return null;
    }
    const r = await fetch(apiUrl("/api/me/messages"), {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      ok?: boolean;
      phone?: string | null;
      messages?: InboxMessage[];
    };
    if (!j.ok) return null;
    const messages = j.messages ?? [];
    if (j.phone) saveInbox(j.phone, messages);
    return { phone: j.phone ?? null, messages };
  } catch {
    return null;
  }
}
