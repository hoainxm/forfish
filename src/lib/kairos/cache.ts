// KAIROS — BẢN LƯU ĐỌC KHI MẤT SÓNG + NHÁP (14 §8, AC19). Luật THUẦN; đọc/ghi qua `Storage`
// truyền vào (localStorage ở app, giả ở test) — không React, không fetch.
//
// forfish.kairos.v1     = { bucket, savedAt, posts[] } ≤200 bài CHỈ CHỮ, trần ~400 KB.
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
import { xoaAnh } from "./luu-anh";
import { xoaLuuTaiKhoan } from "./luu-bai";

export const KAIROS_CACHE_KEY = "forfish.kairos.v1";
export const KAIROS_DRAFT_KEY = "forfish.kairos.nhap.v1";
export const CACHE_MAX_POSTS = 200;
/*  Trần chữ bản lưu dòng tin. NÂNG 300 ⇒ 400 KB (2026-10-24, "Tải tin mang đi" 14 §19): đo bài dựng như thật
    (toCachedPost) — bài báo ~1,18 KB, bài bà con kèm 2 bình luận ~1,95 KB; dòng tin thật ~70 % báo ⇒ 200 bài
    ~234 KB, nhưng ngày bà con đăng nhiều 200 bài toàn bài bà con ~390 KB — 300 KB cắt mất ~50 bài cũ đúng lúc
    vừa tải 100 bài mang đi. 400 KB UTF-8 (~0,8 MB UTF-16 trong localStorage ~5 MB của WebKit) vẫn xa mép
    lỗi iOS 16 xoá sạch localStorage (forecast-store.ts) vì gói dự báo đã ra IndexedDB. */
export const CACHE_MAX_BYTES = 400 * 1024;
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
// ảnh bình luận + ảnh thẻ link cũng bỏ (bản lưu chỉ chữ) — thẻ link giữ tên trang + tiêu đề
const textComment = (c: KairosComment): KairosComment => ({
  ...c,
  author: textAuthor(c.author)!,
  image: null,
  link: c.link ? { ...c.link, image: null } : c.link,
});

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
  /** URL ảnh đã tải của khung soạn (bấm "Lưu nháp"); nháp cũ không có trường này vẫn đọc được */
  images?: string[];
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
        const imgs = Array.isArray(d.images) ? d.images.filter((u): u is string => typeof u === "string" && u.length <= 500).slice(0, LIMITS.images) : [];
        out[k] = imgs.length ? { text: d.text.slice(0, LIMITS.postBody), at: d.at, images: imgs } : { text: d.text.slice(0, LIMITS.postBody), at: d.at };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Đặt/xoá một nháp; giữ ≤20 nháp mới nhất. `images` không truyền ⇒ chữ còn thì GIỮ ảnh cũ của
 * nháp (gõ từng phím không làm rơi ảnh đã lưu), chữ rỗng thì xoá cả nháp như trước. Truyền
 * `images` ⇒ đặt đúng danh sách đó; chữ rỗng + ảnh rỗng ⇒ xoá.
 */
export function putDraft(drafts: Drafts, key: string, text: string, now: number, images?: readonly string[]): Drafts {
  const next = { ...drafts };
  const t = text.slice(0, LIMITS.postBody);
  const imgs = (images ?? (t.trim() ? drafts[key]?.images ?? [] : [])).slice(0, LIMITS.images);
  if (t.trim() || imgs.length) next[key] = imgs.length ? { text: t, at: now, images: [...imgs] } : { text: t, at: now };
  else delete next[key];
  const keys = Object.keys(next).sort((a, b) => next[b].at - next[a].at);
  for (const k of keys.slice(DRAFT_MAX)) delete next[k];
  return next;
}

/**
 * Đăng xuất: xoá bản lưu + nháp Kairos + MỌI NGĂN TÀI KHOẢN của bài đã lưu (`forfish.kairos.luu.v1`, giữ
 * ngăn khách). KHÔNG đụng khoá khác. Trả URL ảnh bài lưu không còn ai dùng — bên gọi xoá khỏi kho ảnh.
 */
export function clearKairosStorage(storage: Storage): string[] {
  storage.removeItem(KAIROS_CACHE_KEY);
  storage.removeItem(KAIROS_DRAFT_KEY);
  return xoaLuuTaiKhoan(storage, GUEST);
}

/**
 * Đăng xuất / gỡ máy: xoá bản lưu dòng tin + nháp Kairos + bài đã lưu của tài khoản (chữ + ảnh, 14 §8/§18).
 * Thói quen chip ở lại — nó không mang gì của tài khoản (chỉ đếm bấm + nơi nhà), người sau dùng máy chỉ
 * thấy chip xếp theo thói quen cũ. Bài khách đã lưu ở lại (không gắn tài khoản). KHÔNG ném.
 */
export function clearKairosLocal(): void {
  try {
    if (typeof window === "undefined") return;
    void xoaAnh(clearKairosStorage(window.localStorage));
  } catch {
    /* chế độ riêng tư chặn ghi — bản lưu vẫn cách ly theo ngăn SĐT (cache.ts) */
  }
}
