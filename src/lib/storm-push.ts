// PUSH BÃO TỰ ĐỘNG — luật THUẦN (2026-08-18, audit P7). Không fetch, không DB,
// không Date.now() trong thân hàm → test được trọn vẹn. Route
// /api/cron/notify-storms mỗi 30 phút gọi vào đây rồi mới đẩy.
//
// KHỬ TRÙNG KHÔNG CẦN MIGRATION: mỗi lần đẩy ghi một dòng `push_messages` với
// `sent_by = 'system:storm'` và `url = /ngu-truong?bao=<khoá>&cap=<alert>&muc=<n>`.
// Lần cron sau đọc lại các dòng 48 giờ gần nhất, parse `url` ra (khoá, cấp) và
// so với tin hiện có. Nghĩa là URL vừa là đường mở app vừa là "sổ đã gửi" —
// đổi khuôn URL là mất trí nhớ khử trùng, nên khuôn nằm ở đúng một chỗ:
// `stormPushUrl` / `parseStormPushUrl`.
//
// KHOÁ CƠN BÃO ≠ `id` NGUỒN: NCHMF đánh id theo BẢN TIN (`nchmf-<postNNNN>`),
// mỗi bản tin 3–6 giờ một số mới ⇒ lấy id làm khoá thì mỗi bản tin là một
// "bão MỚI" và bà con bị đẩy 4–8 lần/ngày. Với nguồn VN, khoá = tên bà con nghe
// trên đài ("số 3", hoặc "atnd" khi áp thấp không tên). GDACS id ổn định theo
// cơn nên giữ nguyên.

import type { StormAlert } from "@/lib/storms";

export const STORM_PUSH_SENT_BY = "system:storm";
/** Vẫn `danger` mà lâu hơn ngần này chưa nhắc → nhắc lại */
export const STORM_REMIND_MS = 12 * 60 * 60 * 1000;
/** Cửa sổ đọc lại "đã gửi" — bão qua rồi thì sổ tự trôi, không cần dọn */
export const STORM_RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Bậc nhãn loại — chỉ để so "lên cấp", không hiện cho bà con */
const KIND_RANK: Record<string, number> = {
  "Áp thấp nhiệt đới": 1,
  "Bão / áp thấp": 1,
  Bão: 2,
  "Bão mạnh": 3,
  "Siêu bão": 4,
};

export type StormSeverity = { alert: 0 | 1; kind: number };

export function stormSeverity(s: Pick<StormAlert, "alert" | "kindLabel">): StormSeverity {
  return {
    alert: s.alert === "danger" ? 1 : 0,
    kind: KIND_RANK[s.kindLabel] ?? 2,
  };
}

function slug(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Khoá ổn định theo CƠN, không theo bản tin (xem ghi chú đầu file). */
export function stormKey(s: Pick<StormAlert, "id" | "name">): string {
  if (s.id.startsWith("nchmf-")) {
    const ten = slug(s.name);
    return `nchmf-${ten || "atnd"}`;
  }
  return slug(s.id) || "khong-ro";
}

export function stormPushUrl(key: string, sev: StormSeverity): string {
  const cap = sev.alert === 1 ? "danger" : "watch";
  return `/ngu-truong?bao=${encodeURIComponent(key)}&cap=${cap}&muc=${sev.kind}`;
}

export type SentStormMark = { key: string; sev: StormSeverity };

/** Đọc ngược URL đã ghi trong push_messages. Không phải URL bão → null. */
export function parseStormPushUrl(url: string | null | undefined): SentStormMark | null {
  if (!url) return null;
  const q = url.indexOf("?");
  if (q < 0) return null;
  const p = new URLSearchParams(url.slice(q + 1));
  const key = p.get("bao");
  if (!key) return null;
  const cap = p.get("cap");
  const muc = Number(p.get("muc"));
  return {
    key,
    sev: {
      alert: cap === "danger" ? 1 : 0,
      kind: Number.isFinite(muc) && muc > 0 ? muc : 2,
    },
  };
}

/** Giờ khuya 22h–5h giờ Việt Nam: chỉ tin `danger` mới được đánh thức bà con. */
export function isQuietHoursVN(nowMs: number): boolean {
  const h = (new Date(nowMs).getUTCHours() + 7) % 24;
  return h >= 22 || h < 5;
}

/*  KM/H → CẤP GIÓ (6–17) — cận DƯỚI mỗi cấp. Cấp 6–12 lấy từ cùng thang
    `beaufort()` (marine-weather.ts, không import vì file đó kéo theo kho client);
    13–17 theo dải KTTV. Test khoá bất biến hai chiều với `capGioSangKmh` của
    storms-vn.ts: đổi một bên là test đỏ. */
const CAP_LOWER_KMH: [number, number][] = [
  [17, 202],
  [16, 184],
  [15, 167],
  [14, 150],
  [13, 134],
  [12, 117],
  [11, 102],
  [10, 88],
  [9, 74],
  [8, 61],
  [7, 49],
  [6, 38],
];

/** null khi dưới cấp 6 (không phải gió bão) hoặc không có số. */
export function capGioTuKmh(kmh: number | null): number | null {
  if (kmh == null || !Number.isFinite(kmh)) return null;
  for (const [cap, duoi] of CAP_LOWER_KMH) if (kmh >= duoi) return cap;
  return null;
}

/** Tiêu đề + nội dung. Giờ bản tin KHÔNG ghép ở đây — sw.js tự in "(tin lúc …)"
    từ `sentAt` của payload, và tự thêm "TIN CŨ" nếu tin tới muộn. */
export function stormPushCopy(s: StormAlert): { title: string; body: string } {
  const title = [s.kindLabel, s.name, "trên Biển Đông"].filter(Boolean).join(" ");
  const cap = capGioTuKmh(s.windKmh);
  const gio =
    s.windKmh != null && Number.isFinite(s.windKmh)
      ? `Gió mạnh nhất ~${Math.round(s.windKmh)} km/giờ${cap != null ? ` (cấp ${cap})` : ""}.`
      : "Chưa rõ sức gió.";
  return {
    title,
    body: `${gio} Đừng ra khơi vùng ảnh hưởng — nghe đài duyên hải.`,
  };
}

export type StormPushReason = "moi" | "len-cap" | "nhac-lai";

export type StormPushPlan = {
  storm: StormAlert;
  key: string;
  reason: StormPushReason;
  title: string;
  body: string;
  url: string;
  /** gom thông báo cùng cơn trên máy: tin mới đè tin cũ, không xếp chồng */
  tag: string;
  /** giờ PHÁT TIN của bản tin (ms) — payload.sentAt; rác thì lấy `now` */
  sentAtMs: number;
};

export type SentStormRecord = { url: string | null; created_at: string };

/**
 * Quyết định đẩy gì lượt này.
 *  · MỚI: khoá chưa có trong 48h đã gửi
 *  · LÊN CẤP: alert watch→danger hoặc nhãn loại tăng bậc so với lần gửi cuối
 *  · NHẮC LẠI: vẫn `danger` và lần gửi cuối đã quá 12h
 * Giờ khuya (22h–5h VN): chỉ `danger` đi; `watch` chờ cron sau 5h tự xét lại
 * (lúc đó vẫn là "MỚI" vì chưa từng ghi ⇒ tự đi).
 */
export function decideStormPushes(
  storms: StormAlert[],
  recentSent: SentStormRecord[],
  nowMs: number,
): StormPushPlan[] {
  // lần gửi CUỐI theo khoá
  const last = new Map<string, { sev: StormSeverity; atMs: number }>();
  for (const r of recentSent) {
    const m = parseStormPushUrl(r.url);
    if (!m) continue;
    const at = Date.parse(r.created_at);
    if (!Number.isFinite(at)) continue;
    const prev = last.get(m.key);
    if (!prev || at > prev.atMs) last.set(m.key, { sev: m.sev, atMs: at });
  }

  const quiet = isQuietHoursVN(nowMs);
  const seen = new Set<string>();
  const out: StormPushPlan[] = [];
  for (const s of storms) {
    const key = stormKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    const sev = stormSeverity(s);
    const prev = last.get(key);

    let reason: StormPushReason | null = null;
    if (!prev) reason = "moi";
    else if (sev.alert > prev.sev.alert || sev.kind > prev.sev.kind) reason = "len-cap";
    else if (sev.alert === 1 && nowMs - prev.atMs >= STORM_REMIND_MS) reason = "nhac-lai";
    if (!reason) continue;
    if (quiet && sev.alert !== 1) continue;

    const { title, body } = stormPushCopy(s);
    const phat = Date.parse(s.updated ?? "");
    out.push({
      storm: s,
      key,
      reason,
      title,
      body,
      url: stormPushUrl(key, sev),
      tag: `bao-${key}`,
      sentAtMs: Number.isFinite(phat) && phat <= nowMs ? phat : nowMs,
    });
  }
  return out;
}
