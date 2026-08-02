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
import { normalizeVnPhone } from "@/lib/phone";

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

/* Quy ước key forfish.* (xem ops/state-registry.md).
   v1 → v2 (2026-08-02): NGĂN nay khoá bằng SĐT ĐÃ CHUẨN HOÁ, khớp đúng thứ máy
   chủ ghi. Bản v1 khoá bằng `email.split("@")[0]` thô ở phía đọc, nên tài khoản
   có email không phải SĐT ("duclong292@gmail.com": máy chủ ghi ngăn "0292",
   client tra ngăn "duclong292") thì hộp thư offline RỖNG VĨNH VIỄN (K6). */
export const INBOX_KEY = "forfish.inbox.v2";
/** Khoá đời cũ — chỉ để migrate sang v2 rồi bỏ, KHÔNG đọc/ghi ở đâu khác. */
const INBOX_KEY_V1 = "forfish.inbox.v1";
/** Tin đã BÁO VỀ được là "đã đọc" — để khỏi báo lại mỗi lần mở app (0024) */
export const INBOX_READ_KEY = "forfish.inbox.read.v1";

type Stored = { phone: string; savedAt: number; messages: InboxMessage[] };

/* Ngăn của KHÁCH CHƯA ĐĂNG NHẬP — chỉ chứa tin gửi chung (ai xem cũng như
   nhau) nên để chung máy không lộ gì của ai. Đăng nhập thì ghi sang ngăn của
   SĐT đó, đăng xuất thì xoá sạch. */
const GUEST = "__khach__";

/**
 * Tên ngăn của một SĐT — PHẢI khớp từng ký tự với máy chủ, nếu không thì ghi
 * một đằng đọc một nẻo. Máy chủ (`src/app/api/me/messages/route.ts`) dùng
 * `normalizeVnPhone(email.split("@")[0])`; ở đây dùng ĐÚNG hàm đó.
 * Rỗng / không ra số nào → ngăn khách.
 */
export function inboxBucket(phone: string | null | undefined): string {
  if (!phone) return GUEST;
  const n = normalizeVnPhone(phone);
  return n && n !== "0" ? n : GUEST;
}

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(INBOX_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    return s && typeof s.phone === "string" && Array.isArray(s.messages)
      ? s
      : null;
  } catch {
    return null;
  }
}

/**
 * Dời hộp thư v1 sang v2 — KHÔNG được làm mất tin bà con đang có (nhất là tin
 * bão đã nhận ở bờ). Chạy một lần, im lặng, không bao giờ ném.
 */
function migrateV1(): void {
  try {
    if (window.localStorage.getItem(INBOX_KEY)) return; // đã có v2
    const old = window.localStorage.getItem(INBOX_KEY_V1);
    if (!old) return;
    const s = JSON.parse(old) as Stored;
    if (s && typeof s.phone === "string" && Array.isArray(s.messages)) {
      window.localStorage.setItem(
        INBOX_KEY,
        JSON.stringify({
          // v1 ghi `phone` lấy thẳng từ máy chủ (đã chuẩn hoá) — cho qua hàm
          // chuẩn hoá lần nữa cho chắc, ngăn khách thì giữ nguyên.
          phone: s.phone === GUEST ? GUEST : inboxBucket(s.phone),
          savedAt: typeof s.savedAt === "number" ? s.savedAt : Date.now(),
          messages: s.messages,
        } satisfies Stored),
      );
    }
    window.localStorage.removeItem(INBOX_KEY_V1);
  } catch {
    /* JSON hỏng / máy hết chỗ — thà giữ nguyên còn hơn xoá nhầm */
  }
}

/** Bản lưu của ĐÚNG tài khoản này; SĐT lệch → coi như chưa có gì. */
export function loadInbox(phone: string | null): InboxMessage[] {
  if (typeof window === "undefined") return [];
  migrateV1();
  const s = readStored();
  if (!s || s.phone !== inboxBucket(phone)) return [];
  return s.messages;
}

function saveInbox(phone: string | null, messages: InboxMessage[]): void {
  try {
    migrateV1();
    const b = inboxBucket(phone);
    /* NHÁNH KHÁCH KHÔNG ĐƯỢC ĐÈ NGĂN CỦA NGƯỜI ĐÃ ĐĂNG NHẬP (K4/F2).
       Máy chủ trả `ok:true, phone:null, messages:[chỉ tin chung]` khi không đọc
       được phiên — đó là câu trả lời HỢP LỆ, không phải lỗi, nên mọi lá chắn
       kiểu `if (!ok) return` đều không bắt được. Ghi đè bằng nó là xoá sổ tin
       gửi riêng khỏi máy, đúng lúc bà con sắp ra khơi. Đăng xuất thật thì
       clearInbox() dọn, không cần đường này. */
    if (b === GUEST) {
      const cur = readStored();
      if (cur && cur.phone !== GUEST) return;
    }
    window.localStorage.setItem(
      INBOX_KEY,
      JSON.stringify({
        phone: b,
        savedAt: Date.now(),
        messages,
      } satisfies Stored),
    );
  } catch {
    /* máy hết chỗ — hộp thư là tiện ích, không được chen chỗ của dự báo */
  }
}

/** Gọi lúc ĐĂNG XUẤT — không để thư của người trước nằm lại trên máy chung. */
export function clearInbox(): void {
  try {
    window.localStorage.removeItem(INBOX_KEY);
    window.localStorage.removeItem(INBOX_KEY_V1);
    window.localStorage.removeItem(INBOX_READ_KEY);
  } catch {
    /* bỏ qua */
  }
}

/* ── BÁO VỀ "ĐÃ ĐỌC" (0024) ────────────────────────────────────────────────
   Vì sao cần: trước đây chỉ nhánh `notificationclick` của service worker mới
   ghi "đã đọc", tức là CHỈ đếm khi bấm vào banner. Bà con phần lớn đọc trên
   màn khoá rồi vuốt tắt, hoặc mở app xem ở đây — trang quản trị vì thế hiện
   "đọc 0" vĩnh viễn dù tin đã tới mắt. Số dối còn hại hơn không có số.

   Trong màn này, thẻ tin hiện SẴN cả tiêu đề lẫn nội dung, không có gì để "mở
   ra" — nên mốc đọc đúng là LÚC THẺ HIỆN RA TRƯỚC MẮT, không phải lúc bấm. */

type ReadStore = { phone: string; ids: string[] };

/** Id đã báo về được, của ĐÚNG tài khoản này (đổi tài khoản → coi như chưa) */
function loadReported(phone: string | null): Set<string> {
  try {
    const raw = window.localStorage.getItem(INBOX_READ_KEY);
    if (!raw) return new Set();
    const s = JSON.parse(raw) as ReadStore;
    if (s?.phone !== inboxBucket(phone) || !Array.isArray(s.ids)) return new Set();
    return new Set(s.ids);
  } catch {
    return new Set();
  }
}

function saveReported(phone: string | null, ids: Set<string>): void {
  try {
    window.localStorage.setItem(
      INBOX_READ_KEY,
      // giữ trần bằng hộp thư (≤50 tin) — cắt từ đầu, tin cũ nhất rụng trước
      JSON.stringify({
        phone: inboxBucket(phone),
        ids: [...ids].slice(-50),
      } satisfies ReadStore),
    );
  } catch {
    /* máy hết chỗ — thà báo trùng còn hơn chen chỗ của dự báo */
  }
}

/** Chỉ những id CHƯA báo về được lần nào — chỗ gọi khỏi tự lọc */
export function unreportedIds(phone: string | null, ids: string[]): string[] {
  if (typeof window === "undefined") return [];
  const done = loadReported(phone);
  return ids.filter((id) => !done.has(id));
}

/**
 * Báo về "bà con đã đọc mấy tin này". BẮN RỒI QUÊN.
 *
 * KHÔNG BAO GIỜ ném, có đồng hồ 8 giây, và bỏ qua hẳn khi máy biết mình mất
 * sóng. Chỉ ghi vào bản lưu khi máy chủ ĐÃ xác nhận — hỏng thì lần mở app sau
 * có sóng sẽ báo lại, chứ không mất luôn. Biên nhận là thống kê: nó không được
 * phép làm chậm hay làm hỏng việc đọc tin của bà con.
 */
export async function markRead(
  phone: string | null,
  ids: string[],
): Promise<void> {
  if (typeof window === "undefined" || ids.length === 0) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    // Máy đã bật thông báo thì gửi kèm endpoint — đó là danh tính DUY NHẤT của
    // khách chưa đăng nhập (hộp thư mở cho cả khách, xem /api/me/messages).
    let endpoint: string | undefined;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      endpoint = sub?.endpoint;
    } catch {
      /* không có SW / bị chặn — vẫn báo được nếu đã đăng nhập */
    }
    const r = await fetch(apiUrl("/api/me/messages/read"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, endpoint }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return;
    const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
    if (!j?.ok) return;
    const done = loadReported(phone);
    for (const id of ids) done.add(id);
    saveReported(phone, done);
  } catch {
    /* mất sóng giữa chừng — lần sau báo lại */
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
    saveInbox(j.phone ?? null, messages);
    return { phone: j.phone ?? null, messages };
  } catch {
    return null;
  }
}
