// KAIROS — PHÍA APP CỦA DÒNG TIN (14 §3.2, §10, AC02/AC03/AC06/AC19).
//
// Phần THUẦN (test ở kairos-feed-client.test.ts): dựng tham số /feed + /new-count từ chip và
// NƠI NHÀ, đọc phản hồi, lọc bản lưu khi mất sóng, chữ giờ. Phần mạng (`fetchFeedPage`,
// `fetchNewCount`) KHÔNG BAO GIỜ ném: đồng hồ + `.catch`, trả kết quả có nhãn để màn chọn
// trạng thái (mất sóng ≠ máy chủ lỗi — mất sóng thì hiện bản lưu, lỗi thì thẻ Thử lại).
//
// ⚠️ HỒ SƠ ĐỌC KHÔNG RỜI MÁY (AC04): request chỉ mang mã chip + MÃ cảng/tỉnh khi chip cần,
// không bao giờ mang số lần bấm/đọc. Test soi điều đó.

import { docTheTaiTro, type TheTaiTro } from "./quang-cao";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { noteResponse, tokenHeader } from "@/lib/device-token-store";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { provinceIdOf, regionsOfProvince } from "./khu-vuc.mjs";
import { HABIT_KEY, parseHabit, serializeHabit, type ChipId, type Habit } from "./thoi-quen";
import { parseTuyChon, serializeTuyChon, TUY_CHON_KEY, type TuyChon } from "./tuy-chon";
import { KAIROS_CACHE_KEY, mergeAndTrim, parseCache, writeCache, type CacheWrite, type KairosCache } from "./cache";
import { parseAnDen, serializeAnDen, TAI_MANG_DI_KEY } from "./tai-mang-di";
import type { KairosPost } from "./types";

/** Đồng hồ một trang dòng tin — trang đầu là thứ bà con đang chờ nhìn. */
export const FEED_TIMEOUT_MS = 12_000;
/** Đồng hồ "Có N bài mới" (14 §3.2: 8 s). */
export const NEW_COUNT_TIMEOUT_MS = 8_000;

const TOPIC_CHIPS = new Set<ChipId>(["nghe-ca", "thoi-su", "phap-luat", "doi-song", "the-thao", "giai-tri", "kinh-te"]);

export type FeedQuery = { ok: true; params: URLSearchParams } | { ok: false; need: "home" };

/**
 * Chip + nơi nhà ⇒ tham số /api/kairos/feed (không kèm cursor). "Cảng tôi" cần cảng nhà,
 * "Gần tôi" cần tỉnh nhà — thiếu ⇒ `need:"home"` (màn mở hộp chọn cảng, 14 §3.2).
 * `port` riêng (Bến) đè chip.
 */
export function feedQuery(chip: ChipId, home: Habit["home"], opts: { port?: string; author?: string } = {}): FeedQuery {
  const p = new URLSearchParams();
  if (opts.port) {
    p.set("port", opts.port);
    return { ok: true, params: p };
  }
  if (opts.author) p.set("author", opts.author);
  if (chip === "cang-toi") {
    if (!home.port) return { ok: false, need: "home" };
    p.set("chip", chip);
    p.set("port", home.port);
  } else if (chip === "gan-toi") {
    if (!home.province) return { ok: false, need: "home" };
    p.set("chip", chip);
    p.set("province", home.province);
  } else if (chip !== "moi") {
    p.set("chip", chip);
  }
  return { ok: true, params: p };
}

export interface FeedPage {
  posts: KairosPost[];
  pinned: KairosPost[];
  next: string | null;
  /** giờ máy chủ lúc trả trang — mốc `since` cho "Có N bài mới" */
  at: string;
  /** bài Tài trợ (14 §20) — CHỈ trang đầu dòng tin chung có trường này; undefined = giữ danh sách đang có */
  ads?: TheTaiTro[];
}

const isPost = (p: unknown): p is KairosPost =>
  !!p && typeof p === "object" && typeof (p as KairosPost).id === "string" && typeof (p as KairosPost).kind === "string" &&
  typeof (p as KairosPost).publishedAt === "string" && Array.isArray((p as KairosPost).topComments);

/** JSON /feed ⇒ FeedPage. Hình dạng lạ ⇒ null (màn coi như lỗi máy chủ, KHÔNG đè bản đang hiện). */
export function parseFeedPage(j: unknown, now: number): FeedPage | null {
  if (!j || typeof j !== "object" || (j as { ok?: unknown }).ok !== true) return null;
  const o = j as Record<string, unknown>;
  if (!Array.isArray(o.posts)) return null;
  const at = typeof o.at === "string" && Number.isFinite(Date.parse(o.at)) ? o.at : new Date(now).toISOString();
  return {
    posts: o.posts.filter(isPost),
    pinned: Array.isArray(o.pinned) ? o.pinned.filter(isPost) : [],
    next: typeof o.next === "string" && o.next ? o.next : null,
    at,
    ...("ads" in o ? { ads: docTheTaiTro(o.ads) } : {}),
  };
}

export type NetResult<T> =
  | { kind: "ok"; value: T }
  /** không tới được máy chủ (mất sóng, hết giờ) */
  | { kind: "offline" }
  /** máy chủ trả lỗi / dữ liệu hỏng — `status` 401 = cần đăng nhập */
  | { kind: "error"; status: number };

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

async function getJson(path: string, ms: number): Promise<NetResult<unknown>> {
  if (isOffline()) return { kind: "offline" };
  try {
    const r = await fetch(apiUrl(path), { headers: tokenHeader(), signal: timeoutSignal(ms), cache: "no-store" });
    void noteResponse(r);
    if (!r.ok) return { kind: "error", status: r.status };
    return { kind: "ok", value: await r.json().catch(() => null) };
  } catch {
    return { kind: "offline" };
  }
}

/** Một trang dòng tin. KHÔNG ném. */
export async function fetchFeedPage(params: URLSearchParams, cursor: string | null, now = Date.now()): Promise<NetResult<FeedPage>> {
  const q = new URLSearchParams(params);
  if (cursor) q.set("cursor", cursor);
  const s = q.toString();
  const res = await getJson(`/api/kairos/feed${s ? `?${s}` : ""}`, FEED_TIMEOUT_MS);
  if (res.kind !== "ok") return res;
  const page = parseFeedPage(res.value, now);
  return page ? { kind: "ok", value: page } : { kind: "error", status: 502 };
}

/** Số bài mới sau `since` cùng bộ lọc. KHÔNG ném; hỏng gì cũng chỉ là không hiện thanh. */
export async function fetchNewCount(params: URLSearchParams, since: string): Promise<number> {
  const q = new URLSearchParams(params);
  q.set("since", since);
  const res = await getJson(`/api/kairos/new-count?${q.toString()}`, NEW_COUNT_TIMEOUT_MS);
  if (res.kind !== "ok") return 0;
  const n = (res.value as { n?: unknown } | null)?.n;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 99) : 0;
}

/**
 * Mất sóng: lọc bản lưu theo chip đang chọn, cùng luật máy chủ ở mức dữ liệu bản lưu có.
 * "Theo dõi" cần danh sách người theo dõi (máy không giữ) ⇒ trả [] — màn nói "Có sóng sẽ tải".
 */
export function filterCached(posts: readonly KairosPost[], chip: ChipId, home: Habit["home"], port?: string): KairosPost[] {
  if (port) return posts.filter((p) => p.ports.includes(port));
  if (chip === "moi") return [...posts];
  if (chip === "theo-doi") return [];
  if (chip === "cang-toi") return home.port ? posts.filter((p) => p.ports.includes(home.port!)) : [];
  if (chip === "gan-toi") {
    if (!home.province) return [];
    const regions = regionsOfProvince(home.province);
    return posts.filter((p) => p.provinces.includes(home.province!) || p.regions.some((r) => regions.includes(r)));
  }
  return TOPIC_CHIPS.has(chip) ? posts.filter((p) => p.topic === chip) : [...posts];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Lưu lúc 14:05 23/10" (14 §10). Giờ máy của bà con — cùng một nguồn với dòng mất sóng toàn app (`lib/offline-line`). */
export { gioLuu as savedAtLabel } from "@/lib/offline-line";

/** Giờ trên thẻ: "Vừa xong" · "5 phút" · "3 giờ" · "Hôm qua" · "23/10" (năm khác: "23/10/2025"). */
export function postTimeLabel(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((now - t) / 60_000);
  if (m < 1) return "Vừa xong";
  if (m < 60) return `${m} phút`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} giờ`;
  const d = new Date(t);
  const today = new Date(now);
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()) return "Hôm qua";
  const dm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return d.getFullYear() === today.getFullYear() ? dm : `${dm}/${d.getFullYear()}`;
}

/** Số đếm trên thẻ: trần 99+ (14 §10 cực đoan). */
export function countLabel(n: number): string {
  return n > 99 ? "99+" : String(Math.max(0, Math.floor(n)));
}

/**
 * Mã cảng ⇒ nơi nhà {cảng, tỉnh mới}. Cảng lạ ⇒ cả hai null. Dùng cho hộp chọn cảng và cho cảng
 * nhà lấy từ sổ tàu (`Boat.homePortId`) — KHÔNG từ vị trí máy.
 */
export function homeFromPort(portId: string | null | undefined): Habit["home"] {
  const p = portId ? FISHING_PORTS.find((x) => x.id === portId) : undefined;
  if (!p) return { port: null, province: null };
  return { port: p.id, province: provinceIdOf(p.province ?? null) };
}

/** Tên cảng trong danh mục (lối vào Bến /kairos/ben/[port], AC14); mã lạ ⇒ null. */
export function portLabel(portId: string | null | undefined): string | null {
  return (portId && FISHING_PORTS.find((x) => x.id === portId)?.name) || null;
}

/** Màu ảnh đại diện chữ cái: băm id ⇒ 1..6 (`--kairos-av-N`, A15). Ổn định theo id. */
export function avatarTone(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

/** Chữ cái đầu của tên gọi (bỏ khoảng trắng/ký hiệu đầu); rỗng ⇒ "B" (Bà con). */
export function avatarLetter(handle: string): string {
  const m = handle.trim().match(/[\p{L}\p{N}]/u);
  return m ? m[0].toLocaleUpperCase("vi") : "B";
}

// ── Kho trong máy (localStorage) ──────────────────────────────────────────
// Thói quen hỏng/không ghi được chỉ làm chip về thứ tự mặc định — không phải dữ liệu của bà
// con, nên lỗi ghi bỏ qua CÓ CHỦ Ý. Bản lưu dòng tin thì trả kết quả ghi cho màn (`writeCache`).


function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadHabit(): Habit {
  try {
    return parseHabit(storage()?.getItem(HABIT_KEY));
  } catch {
    return parseHabit(null);
  }
}

export function saveHabit(h: Habit): void {
  try {
    storage()?.setItem(HABIT_KEY, serializeHabit(h));
  } catch {
    /* đầy bộ nhớ / chế độ riêng tư: mất thói quen = chip về thứ tự mặc định, không mất gì của bà con */
  }
}

/** Tuỳ chọn dòng tin (tuy-chon.ts). Đọc hỏng ⇒ mặc định. */
export function loadTuyChon(): TuyChon {
  try {
    return parseTuyChon(storage()?.getItem(TUY_CHON_KEY));
  } catch {
    return parseTuyChon(null);
  }
}

/** Ghi tuỳ chọn; false = máy không ghi được (đầy / riêng tư) — màn báo "chỉ dùng lần này", vẫn áp trong phiên. */
export function saveTuyChon(t: TuyChon): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(TUY_CHON_KEY, serializeTuyChon(t));
    return true;
  } catch {
    return false;
  }
}

/** Mốc "Để sau" của gợi ý Tải tin mang đi (tai-mang-di.ts). Đọc hỏng ⇒ 0 (hiện được). */
export function loadTaiMangDiAn(): number {
  try {
    return parseAnDen(storage()?.getItem(TAI_MANG_DI_KEY));
  } catch {
    return 0;
  }
}

/** Bấm "Để sau" ⇒ ẩn 24 giờ. Ghi hỏng bỏ qua CÓ CHỦ Ý: chỉ là gợi ý hiện lại lần sau, không mất gì. */
export function saveTaiMangDiAn(now: number): void {
  try {
    storage()?.setItem(TAI_MANG_DI_KEY, serializeAnDen(now));
  } catch {
    /* đầy / riêng tư ⇒ gợi ý hiện lại lần mở sau */
  }
}

/** Bản lưu của ĐÚNG ngăn SĐT này (khác ngăn ⇒ null — cách ly tài khoản). */
export function loadFeedCache(phone: string | null): KairosCache | null {
  try {
    return parseCache(storage()?.getItem(KAIROS_CACHE_KEY), phone);
  } catch {
    return null;
  }
}

/** Gộp bài vừa tải vào bản lưu (≤200 bài chỉ chữ, ≤400 KB). */
export function saveFeedCache(phone: string | null, incoming: readonly KairosPost[], now: number): CacheWrite {
  const s = storage();
  if (!s) return { ok: false, reason: "error" };
  const cur = loadFeedCache(phone);
  return writeCache(s, phone, mergeAndTrim(cur?.posts ?? [], incoming), now);
}
