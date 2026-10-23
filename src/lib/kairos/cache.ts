// KAIROS — BẢN LƯU ĐỌC KHI MẤT SÓNG + NHÁP (14 §8, AC19). Luật THUẦN; đọc/ghi qua `Storage`
// truyền vào (localStorage ở app, giả ở test) — không React, không fetch.
//
// forfish.kairos.v1     = { bucket, savedAt, posts[] } ≤200 bài CHỈ CHỮ, trần ~300 KB.
// forfish.kairos.nhap.v1 = { [khoá]: { text, at } } ≤20 nháp, chỉ chữ.
//
// ⚠️ CÁCH LY TÀI KHOẢN như inbox.ts: bản lưu mang NGĂN = SĐT chủ máy đã chuẩn hoá (hoặc ngăn
// khách). Máy dùng chung trên tàu, đổi tài khoản ⇒ bản người trước không được đọc ("Hay" của
// tôi, "mine" của tôi là dữ liệu riêng). Đăng xuất ⇒ `clearKairosStorage`.
// ⚠️ KHÔNG đụng `forfish.fc.*` (dự báo cá đã tải) — đầy bộ nhớ thì CẮT bản lưu Kairos, không xoá
// thứ khác. Ghi hỏng ⇒ trả lỗi cho bên gọi, KHÔNG nuốt.

import { normalizeVnPhone } from "@/lib/phone";
import type { KairosAuthor, KairosComment, KairosPost } from "./types";
import { LIMITS } from "./types";

export const KAIROS_CACHE_KEY = "forfish.kairos.v1";
export const KAIROS_DRAFT_KEY = "forfish.kairos.nhap.v1";
export const CACHE_MAX_POSTS = 200;
export const CACHE_MAX_BYTES = 300 * 1024;
export const DRAFT_MAX = 20;
const GUEST = "__khach__";

export interface KairosCache {
  bucket: string;
  /** ms */
  savedAt: number;
  posts: KairosPost[];
}

/** Ngăn của một SĐT — cùng luật `inboxBucket` (inbox.ts). */
export function cacheBucket(phone: string | null | undefined): string {
  if (!phone) return GUEST;
  const n = normalizeVnPhone(phone);
  return n && n !== "0" ? n : GUEST;
}

const textAuthor = (a: KairosAuthor | null): KairosAuthor | null => (a ? { ...a, avatarUrl: null } : null);
const textComment = (c: KairosComment): KairosComment => ({ ...c, author: textAuthor(c.author)! });

/** Bỏ mọi thứ không phải chữ: ảnh, ảnh bìa, ảnh đại diện; giữ ≤2 bình luận đầu; đăng lại 1 tầng. */
export function toCachedPost(p: KairosPost): KairosPost {
  const reshare = p.reshareOf ? { ...toCachedPost({ ...p.reshareOf, reshareOf: null }), topComments: [] } : null;
  return {
    ...p,
    author: textAuthor(p.author),
    images: [],
    imageCount: p.imageCount ?? p.images.length,
    coverUrl: null,
    reshareOf: reshare,
    topComments: p.topComments.slice(0, LIMITS.topComments).map(textComment),
  };
}

const utf8Len = (s: string) => new TextEncoder().encode(s).length;

/**
 * Gộp bài mới vào bản lưu rồi cắt theo trần. Bài cùng id: bản MỚI tải đè bản cũ. Xếp
 * `publishedAt desc`; quá 200 bài ⇒ bỏ bài cũ nhất; quá `maxBytes` (đo UTF-8 của JSON) ⇒ bỏ
 * tiếp bài cũ nhất tới khi lọt.
 */
export function mergeAndTrim(
  existing: readonly KairosPost[],
  incoming: readonly KairosPost[],
  limits: { maxPosts?: number; maxBytes?: number } = {},
): KairosPost[] {
  const maxPosts = limits.maxPosts ?? CACHE_MAX_POSTS;
  const maxBytes = limits.maxBytes ?? CACHE_MAX_BYTES;
  const byId = new Map<string, KairosPost>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of incoming) byId.set(p.id, toCachedPost(p));
  const all = [...byId.values()].sort(
    (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0) || (a.id < b.id ? 1 : -1),
  );
  let out = all.slice(0, maxPosts);
  // Bỏ dần từ cuối; đo lại cả mảng — 200 lần JSON.stringify ~300 KB vẫn rẻ so với một lần ghi đĩa.
  let size = utf8Len(JSON.stringify(out));
  while (out.length && size > maxBytes) {
    const over = size - maxBytes;
    // ước số bài cần bỏ theo cỡ trung bình, tối thiểu 1
    const avg = size / out.length;
    out = out.slice(0, Math.max(0, out.length - Math.max(1, Math.ceil(over / avg))));
    size = utf8Len(JSON.stringify(out));
  }
  return out;
}

/** Đọc bản lưu của ĐÚNG ngăn này. Hỏng / ngăn khác ⇒ null. */
export function parseCache(raw: string | null | undefined, phone: string | null | undefined): KairosCache | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as KairosCache;
    if (!j || typeof j.bucket !== "string" || typeof j.savedAt !== "number" || !Array.isArray(j.posts)) return null;
    if (j.bucket !== cacheBucket(phone)) return null;
    return { bucket: j.bucket, savedAt: j.savedAt, posts: j.posts.filter((p) => p && typeof p.id === "string") };
  } catch {
    return null;
  }
}

export type CacheWrite = { ok: true; kept: number } | { ok: false; reason: "quota" | "error" };

/**
 * Ghi bản lưu. Ngăn khách KHÔNG đè ngăn của người đã đăng nhập (luật inbox K4/F2: máy chủ trả
 * dữ liệu kiểu khách khi không đọc được phiên — ghi đè là mất bản của bà con). Đầy bộ nhớ ⇒
 * cắt nửa thử lại tới khi ghi được hoặc hết bài.
 */
export function writeCache(storage: Storage, phone: string | null | undefined, posts: KairosPost[], now: number): CacheWrite {
  const bucket = cacheBucket(phone);
  if (bucket === GUEST) {
    try {
      const cur = storage.getItem(KAIROS_CACHE_KEY);
      const j = cur ? (JSON.parse(cur) as { bucket?: unknown }) : null;
      if (j && typeof j.bucket === "string" && j.bucket !== GUEST) return { ok: true, kept: 0 };
    } catch {
      /* bản cũ hỏng ⇒ ghi đè được */
    }
  }
  let list = posts;
  for (;;) {
    try {
      storage.setItem(KAIROS_CACHE_KEY, JSON.stringify({ bucket, savedAt: now, posts: list } satisfies KairosCache));
      return { ok: true, kept: list.length };
    } catch (e) {
      const quota = e instanceof Error && /quota|exceeded/i.test(`${e.name} ${e.message}`);
      if (!quota) return { ok: false, reason: "error" };
      if (!list.length) return { ok: false, reason: "quota" };
      list = list.slice(0, Math.floor(list.length / 2));
    }
  }
}

// ── Nháp ────────────────────────────────────────────────────────────────

export interface Draft {
  text: string;
  /** ms */
  at: number;
}
export type Drafts = Record<string, Draft>;

/** Khoá nháp: "bai" (khung soạn), "sua:<postId>" (đang sửa), "bl:<postId>" (bình luận). */
export function draftKey(kind: "bai" | "sua" | "bl", postId?: string): string {
  return kind === "bai" ? "bai" : `${kind}:${postId ?? ""}`;
}

/**
 * Khoá nháp TRONG NGĂN SĐT (cùng luật `cacheBucket`): máy dùng chung, người sau không thấy nháp
 * người trước kể cả khi phiên mất mà không qua nút đăng xuất.
 */
export function draftSlot(phone: string | null | undefined, key: string): string {
  return `${cacheBucket(phone)}|${key}`;
}

export function parseDrafts(raw: string | null | undefined): Drafts {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    const out: Drafts = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      const d = v as Draft;
      if (k.length <= 90 && d && typeof d.text === "string" && typeof d.at === "number") {
        out[k] = { text: d.text.slice(0, LIMITS.postBody), at: d.at };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Đặt/xoá một nháp (chữ rỗng ⇒ xoá); giữ ≤20 nháp mới nhất. */
export function putDraft(drafts: Drafts, key: string, text: string, now: number): Drafts {
  const next = { ...drafts };
  const t = text.slice(0, LIMITS.postBody);
  if (t.trim()) next[key] = { text: t, at: now };
  else delete next[key];
  const keys = Object.keys(next).sort((a, b) => next[b].at - next[a].at);
  for (const k of keys.slice(DRAFT_MAX)) delete next[k];
  return next;
}

/** Đăng xuất: xoá bản lưu + nháp Kairos (KHÔNG đụng khoá khác). */
export function clearKairosStorage(storage: Storage): void {
  storage.removeItem(KAIROS_CACHE_KEY);
  storage.removeItem(KAIROS_DRAFT_KEY);
}

/**
 * Đăng xuất / gỡ máy: xoá bản lưu dòng tin + nháp Kairos (14 §8). Thói quen chip ở lại — nó
 * không mang gì của tài khoản (chỉ đếm bấm + nơi nhà), người sau dùng máy chỉ thấy chip xếp
 * theo thói quen cũ. KHÔNG ném.
 */
export function clearKairosLocal(): void {
  try {
    if (typeof window === "undefined") return;
    clearKairosStorage(window.localStorage);
  } catch {
    /* chế độ riêng tư chặn ghi — bản lưu vẫn cách ly theo ngăn SĐT (cache.ts) */
  }
}
