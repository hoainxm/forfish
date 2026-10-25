// KAIROS — LƯU BÀI MANG THEO (14 §8, §18; 2026-10-24). Luật THUẦN + đọc/ghi qua `Storage` truyền vào.
//
// Khác "Lưu" của Facebook (chỉ là đánh dấu, mất sóng không mở được): lưu ở đây là MANG THEO — chữ bài
// nằm ở `forfish.kairos.luu.v1`, ảnh (ảnh nén sẵn của kho kairos-media + ảnh bìa bài báo) nằm ở Cache
// Storage `kairos-luu-anh-v1` (luu-anh.ts). Ngoài khơi mở Trang tôi › Đã lưu là đọc được cả ảnh.
//
// forfish.kairos.luu.v1 = { v:1, ngan: { [ngăn SĐT | "__khach__"]: BaiLuu[] } }
//   · NGĂN theo SĐT như forfish.kairos.v1 (`cacheBucket`) — nhưng giữ NHIỀU ngăn cùng lúc: đây là thứ bà
//     con tự chọn giữ, đổi tài khoản không được đè mất bài người kia đã lưu. Khách lưu được (ngăn khách).
//   · Trần MỖI NGĂN: 50 bài, 20 MB ảnh. Trần CẢ KHOÁ: 400 KB chữ (UTF-8 của JSON).
//   · ĐẦY ⇒ trả lỗi cho màn báo "Bộ nhớ lưu đầy — bỏ bớt bài đã lưu". KHÔNG BAO GIỜ tự xoá bài cũ âm thầm.
//   · Đăng xuất ⇒ bỏ mọi ngăn tài khoản, GIỮ ngăn khách (không gắn tài khoản nào) — `chiGiuNgan`.
// ⚠️ File này KHÔNG import cache.ts (cache.ts gọi `xoaLuuTaiKhoan` lúc đăng xuất — tránh vòng import).

import type { KairosAuthor, KairosComment, KairosPost } from "./types";
import { LIMITS } from "./types";

export const LUU_KEY = "forfish.kairos.luu.v1";
/** Tên kho Cache Storage giữ ảnh bài đã lưu — sw.js giữ nó qua `activate` và phục vụ ảnh từ đây. */
export const LUU_ANH_CACHE = "kairos-luu-anh-v1";
export const LUU_MAX_POSTS = 50;
export const LUU_MAX_ANH_BYTES = 20 * 1024 * 1024;
/** 50 bài × ≤2.000 ký tự thân + 2 bình luận ≈ ≤6 KB/bài ⇒ 300 KB/ngăn; 400 KB chừa chỗ cho ngăn thứ hai. */
export const LUU_MAX_CHU_BYTES = 400 * 1024;
/**
 * Ảnh "mờ" (opaque — ảnh bìa của báo không mở CORS) không đọc được cỡ thật ⇒ tính khoán chừng này.
 * nợ: cỡ khoán, trần = một ảnh bìa > 300 KB làm trần 20 MB hụt nhẹ; nâng khi có đường ảnh bìa qua máy chủ mình.
 */
export const ANH_MO_BYTES = 300 * 1024;

export interface AnhLuu {
  url: string;
  bytes: number;
}
export interface BaiLuu {
  post: KairosPost;
  /** ms */
  savedAt: number;
  /** ảnh ĐÃ nằm trong kho `kairos-luu-anh-v1` cho bài này */
  anh: AnhLuu[];
}
export interface LuuState {
  v: 1;
  ngan: Record<string, BaiLuu[]>;
}

export const emptyLuu = (): LuuState => ({ v: 1, ngan: {} });

const noAvatar = (a: KairosAuthor | null): KairosAuthor | null => (a ? { ...a, avatarUrl: null } : null);
const noAvatarC = (c: KairosComment): KairosComment => ({ ...c, author: noAvatar(c.author)! });
const isHttp = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u);

/**
 * Bài để mang theo: GIỮ ảnh + ảnh bìa (sẽ nằm trong kho ảnh), bỏ ảnh đại diện (không tải — mất sóng về
 * chữ cái như bản lưu dòng tin); ≤2 bình luận; bài gốc đăng lại 1 tầng, chỉ chữ (thẻ bài gốc không vẽ ảnh).
 */
export function toSavedPost(p: KairosPost): KairosPost {
  const r = p.reshareOf;
  return {
    ...p,
    author: noAvatar(p.author),
    images: p.images.filter(isHttp).slice(0, LIMITS.images),
    imageCount: p.imageCount ?? p.images.length,
    reshareOf: r
      ? { ...r, author: noAvatar(r.author), images: [], imageCount: r.imageCount ?? r.images.length, coverUrl: null, reshareOf: null, topComments: [] }
      : null,
    topComments: p.topComments.slice(0, LIMITS.topComments).map(noAvatarC),
  };
}

/** Ảnh cần mang theo của một bài: ảnh bài (≤5) + ảnh bìa, chỉ http(s), không trùng. */
export function anhCuaBai(p: Pick<KairosPost, "images" | "coverUrl">): string[] {
  const out: string[] = [];
  for (const u of [...p.images.slice(0, LIMITS.images), p.coverUrl]) if (isHttp(u) && !out.includes(u)) out.push(u);
  return out;
}

const isEntry = (e: unknown): e is BaiLuu => {
  const x = e as BaiLuu;
  return (
    !!x && typeof x === "object" && typeof x.savedAt === "number" && !!x.post && typeof x.post.id === "string" &&
    typeof x.post.publishedAt === "string" && Array.isArray(x.post.images) && Array.isArray(x.post.topComments) && Array.isArray(x.anh)
  );
};

/** Đọc khoá. Hỏng ⇒ rỗng; mục hỏng lẻ ⇒ bỏ mục đó, giữ mục lành. */
export function parseLuu(raw: string | null | undefined): LuuState {
  if (!raw) return emptyLuu();
  try {
    const j = JSON.parse(raw) as LuuState;
    if (!j || j.v !== 1 || !j.ngan || typeof j.ngan !== "object" || Array.isArray(j.ngan)) return emptyLuu();
    const ngan: Record<string, BaiLuu[]> = {};
    for (const [k, list] of Object.entries(j.ngan)) {
      if (!Array.isArray(list)) continue;
      const ok = list.filter(isEntry).map((e) => ({
        post: e.post,
        savedAt: e.savedAt,
        anh: e.anh.filter((a) => a && isHttp(a.url) && typeof a.bytes === "number" && a.bytes >= 0),
      }));
      if (ok.length) ngan[k] = ok.slice(0, LUU_MAX_POSTS);
    }
    return { v: 1, ngan };
  } catch {
    return emptyLuu();
  }
}

export const serializeLuu = (s: LuuState) => JSON.stringify(s);
const utf8Len = (s: string) => new TextEncoder().encode(s).length;

/** Bài đã lưu của một ngăn, mới lưu trước. */
export function listLuu(s: LuuState, ngan: string): BaiLuu[] {
  return [...(s.ngan[ngan] ?? [])].sort((a, b) => b.savedAt - a.savedAt);
}

export const daLuu = (s: LuuState, ngan: string, id: string) => (s.ngan[ngan] ?? []).some((e) => e.post.id === id);

/** Đang dùng bao nhiêu trong ngăn: số bài + byte ảnh. */
export function dungLuong(s: LuuState, ngan: string): { bai: number; anhBytes: number } {
  const list = s.ngan[ngan] ?? [];
  return { bai: list.length, anhBytes: list.reduce((n, e) => n + e.anh.reduce((m, a) => m + a.bytes, 0), 0) };
}

export type ThemLuu = { ok: true; state: LuuState } | { ok: false; reason: "bai" | "anh" | "chu" };

/**
 * Thêm (hoặc làm mới — cùng id thì thay, không tính thêm bài) một bài vào ngăn. Vượt 50 bài / 20 MB ảnh /
 * 400 KB chữ ⇒ `ok:false` kèm trần nào đầy; state cũ GIỮ NGUYÊN — không tự bỏ bài nào.
 */
export function themLuu(s: LuuState, ngan: string, post: KairosPost, anh: AnhLuu[], now: number): ThemLuu {
  const cur = (s.ngan[ngan] ?? []).filter((e) => e.post.id !== post.id);
  if (cur.length >= LUU_MAX_POSTS) return { ok: false, reason: "bai" };
  const entry: BaiLuu = { post: toSavedPost(post), savedAt: now, anh };
  const next: LuuState = { v: 1, ngan: { ...s.ngan, [ngan]: [entry, ...cur] } };
  if (dungLuong(next, ngan).anhBytes > LUU_MAX_ANH_BYTES) return { ok: false, reason: "anh" };
  if (utf8Len(serializeLuu(next)) > LUU_MAX_CHU_BYTES) return { ok: false, reason: "chu" };
  return { ok: true, state: next };
}

/** Bỏ lưu một bài (không có ⇒ state y nguyên). Ngăn rỗng thì gỡ luôn ngăn. */
export function boLuu(s: LuuState, ngan: string, id: string): LuuState {
  const list = s.ngan[ngan];
  if (!list?.some((e) => e.post.id === id)) return s;
  const rest = list.filter((e) => e.post.id !== id);
  const ng = { ...s.ngan };
  if (rest.length) ng[ngan] = rest;
  else delete ng[ngan];
  return { v: 1, ngan: ng };
}

const urlsOf = (s: LuuState) => new Set(Object.values(s.ngan).flatMap((l) => l.flatMap((e) => e.anh.map((a) => a.url))));

/**
 * Ảnh có ở `truoc` mà `sau` không còn bài nào (ở BẤT KỲ ngăn nào) dùng ⇒ xoá khỏi kho ảnh được.
 * Hai tài khoản cùng lưu một bài thì ảnh chung một ô kho — bỏ lưu ở ngăn này không được làm mất ảnh ngăn kia.
 */
export function anhKhongDung(truoc: LuuState, sau: LuuState): string[] {
  const con = urlsOf(sau);
  return [...urlsOf(truoc)].filter((u) => !con.has(u));
}

/** Chỉ giữ một ngăn (đăng xuất: giữ ngăn khách). */
export function chiGiuNgan(s: LuuState, ngan: string): LuuState {
  return s.ngan[ngan] ? { v: 1, ngan: { [ngan]: s.ngan[ngan] } } : emptyLuu();
}

// ── Đọc/ghi khoá qua Storage truyền vào ──────────────────────────────────

export function docLuu(storage: Storage | null): LuuState {
  try {
    return parseLuu(storage?.getItem(LUU_KEY));
  } catch {
    return emptyLuu();
  }
}

/** Ghi khoá; false = máy không ghi được (đầy / riêng tư) — bên gọi BÁO, không nuốt. Rỗng ⇒ gỡ khoá. */
export function ghiLuu(storage: Storage | null, s: LuuState): boolean {
  if (!storage) return false;
  try {
    if (Object.keys(s.ngan).length) storage.setItem(LUU_KEY, serializeLuu(s));
    else storage.removeItem(LUU_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Đăng xuất / gỡ máy: bỏ mọi ngăn tài khoản, giữ ngăn khách. Trả các URL ảnh không còn ai dùng để bên gọi
 * xoá khỏi kho ảnh (bất đồng bộ). KHÔNG ném.
 */
export function xoaLuuTaiKhoan(storage: Storage | null, nganKhach: string): string[] {
  const truoc = docLuu(storage);
  const sau = chiGiuNgan(truoc, nganKhach);
  if (!ghiLuu(storage, sau)) {
    try {
      storage?.removeItem(LUU_KEY); // ghi bản rút gọn hỏng ⇒ gỡ hẳn (bài tài khoản không được ở lại máy)
    } catch {
      /* chế độ riêng tư chặn cả gỡ — bài vẫn cách ly theo ngăn SĐT */
    }
    return anhKhongDung(truoc, emptyLuu());
  }
  return anhKhongDung(truoc, sau);
}

/** Câu báo cho bà con khi lưu không được (14 §10). */
export function luuLoiText(reason: "bai" | "anh" | "chu" | "ghi"): string {
  return reason === "ghi" ? "Máy không lưu được bài này — bộ nhớ máy có thể đã đầy." : "Bộ nhớ lưu đầy — bỏ bớt bài đã lưu.";
}
