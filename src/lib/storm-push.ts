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
// "bão MỚI" và bà con bị đẩy 4–8 lần/ngày. Khoá + luật "cùng cơn" nằm ở
// `lib/storm-identity.ts` (2026-08-18b) — DÙNG CHUNG với /api/storms và cùng
// khuôn với kho bản tin: `bao-so-N-YYYY`, `atnd-YYYYMMDD-lat-lon`, `gdacs-<tên>`.
// Sổ đã gửi ghi kèm TÂM + GIỜ TIN trong URL, nên lượt sau nối cơn bằng vị trí/
// thời gian (`cungCon`) chứ không tin vào tên: NCHMF "số 3" hôm nay và GDACS
// "WUTIP" (nếu tin VN lỡ hỏng một lượt) là MỘT cơn; hai áp thấp không tên cách
// nhau 1.000 km là HAI cơn.
//
// KHÔNG CÓ GIỜ KHUYA (chủ dự án 2026-08-18b: "giờ khuya làm cái gì???"): bão là
// tính mạng, có tin là đẩy, giờ nào cũng vậy. Máy bà con tự lo im lặng ban đêm.

import type { StormAlert } from "@/lib/storms";
import { cungCon, stormKeyOf } from "@/lib/storm-identity";

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

/** Khoá ổn định theo CƠN — xem lib/storm-identity.ts. Giữ tên cũ cho chỗ gọi. */
export function stormKey(
  s: Pick<StormAlert, "id" | "name" | "lat" | "lon" | "updated">,
  nowMs: number,
): string {
  return stormKeyOf(s, nowMs);
}

export function stormPushUrl(
  key: string,
  sev: StormSeverity,
  tam?: { lat: number; lon: number; tMs: number },
): string {
  const cap = sev.alert === 1 ? "danger" : "watch";
  const goc = `/ngu-truong?bao=${encodeURIComponent(key)}&cap=${cap}&muc=${sev.kind}`;
  if (!tam) return goc;
  // tâm + giờ tin để lượt sau NỐI CƠN theo vị trí (storm-identity.cungCon)
  return `${goc}&lat=${tam.lat.toFixed(2)}&lon=${tam.lon.toFixed(2)}&t=${Math.round(tam.tMs / 1000)}`;
}

export type SentStormMark = {
  key: string;
  sev: StormSeverity;
  /** tâm + giờ tin lúc gửi (null với bản ghi cũ chưa có) */
  tam: { lat: number; lon: number; tMs: number } | null;
};

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
  const lat = Number(p.get("lat"));
  const lon = Number(p.get("lon"));
  const t = Number(p.get("t"));
  const tam =
    Number.isFinite(lat) && Number.isFinite(lon) && p.get("lat") != null && p.get("lon") != null
      ? { lat, lon, tMs: Number.isFinite(t) && t > 0 ? t * 1000 : 0 }
      : null;
  return {
    key,
    sev: {
      alert: cap === "danger" ? 1 : 0,
      kind: Number.isFinite(muc) && muc > 0 ? muc : 2,
    },
    tam,
  };
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
 *  · MỚI: không nối được với cơn nào trong sổ 48h đã gửi (theo KHOÁ, hoặc theo
 *    VỊ TRÍ/THỜI GIAN — `cungCon` — để đổi tên/đổi nguồn không thành cơn mới)
 *  · LÊN CẤP: alert watch→danger hoặc nhãn loại tăng bậc so với lần gửi cuối
 *  · NHẮC LẠI: vẫn `danger` và lần gửi cuối đã quá 12h
 * Đẩy giờ nào cũng đẩy — không có giờ khuya.
 */
export function decideStormPushes(
  storms: StormAlert[],
  recentSent: SentStormRecord[],
  nowMs: number,
): StormPushPlan[] {
  // lần gửi CUỐI theo khoá (kèm tâm để nối cơn)
  type Last = { key: string; sev: StormSeverity; atMs: number; tam: SentStormMark["tam"] };
  const last = new Map<string, Last>();
  for (const r of recentSent) {
    const m = parseStormPushUrl(r.url);
    if (!m) continue;
    const at = Date.parse(r.created_at);
    if (!Number.isFinite(at)) continue;
    const prev = last.get(m.key);
    if (!prev || at > prev.atMs) last.set(m.key, { key: m.key, sev: m.sev, atMs: at, tam: m.tam });
  }

  /* Nối cơn: đúng khoá thì lấy; không thì tìm bản ghi nào có tâm "cùng cơn"
     với tin này (vị trí + thời gian) — tin đổi tên (ATNĐ → bão số N), đổi nguồn
     (VN hỏng một lượt, GDACS lên thay) đều KHÔNG được coi là bão mới. */
  const noiCon = (s: StormAlert, key: string): Last | undefined => {
    const thang = last.get(key);
    if (thang) return thang;
    const phat = Date.parse(s.updated ?? "");
    const tMs = Number.isFinite(phat) ? phat : nowMs;
    let gan: Last | undefined;
    for (const l of last.values()) {
      if (!l.tam) continue;
      if (!cungCon({ lat: s.lat, lon: s.lon, tMs }, { lat: l.tam.lat, lon: l.tam.lon, tMs: l.tam.tMs || l.atMs })) continue;
      if (!gan || l.atMs > gan.atMs) gan = l;
    }
    return gan;
  };

  const seen = new Set<string>();
  const out: StormPushPlan[] = [];
  for (const s of storms) {
    const phat = Date.parse(s.updated ?? "");
    const tMs = Number.isFinite(phat) && phat <= nowMs ? phat : nowMs;
    let key = stormKey(s, tMs);
    const prev = noiCon(s, key);
    // nối được với cơn đã gửi dưới khoá khác ⇒ GIỮ khoá cũ (tag OS đè đúng tin cũ)
    if (prev && prev.key !== key) key = prev.key;
    if (seen.has(key)) continue;
    seen.add(key);
    const sev = stormSeverity(s);

    let reason: StormPushReason | null = null;
    if (!prev) reason = "moi";
    else if (sev.alert > prev.sev.alert || sev.kind > prev.sev.kind) reason = "len-cap";
    else if (sev.alert === 1 && nowMs - prev.atMs >= STORM_REMIND_MS) reason = "nhac-lai";
    if (!reason) continue;

    const { title, body } = stormPushCopy(s);
    out.push({
      storm: s,
      key,
      reason,
      title,
      body,
      url: stormPushUrl(key, sev, { lat: s.lat, lon: s.lon, tMs }),
      tag: `bao-${key}`,
      sentAtMs: tMs,
    });
  }
  return out;
}
