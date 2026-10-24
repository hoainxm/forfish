// KAIROS — LUẬT THUẦN CỦA CÁC NÚT GHI (14 §3.3–§3.10, AC07–AC15). Không React, không fetch,
// không localStorage — trang server (/k/[id]) và test dùng được. Phần mạng ở write-client.ts.
//
// Gồm: mã lỗi route ⇒ câu tiếng Việt đúng chỗ (14 §10), Hay lạc quan + hoàn tác, gom bình luận
// thành luồng 1 cấp, link + chữ chia sẻ (không SĐT), đổi URL ảnh về đường kho (sửa bài giữ ảnh).

import { apiBase } from "@/lib/api-base";
import { LIMITS, type KairosAuthor, type KairosComment, type KairosPost } from "./types";

export type SendResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      status: number;
      /** không tới được máy chủ (mất sóng, hết giờ) */
      offline: boolean;
      /** trường phụ route kèm theo (`nextAt` của handle_cooldown, `until` của banned) */
      extra: Record<string, unknown>;
    };

/** GET/PATCH /api/kairos/me — hồ sơ của chính mình (không SĐT). */
export interface KairosMe extends KairosAuthor {
  showBoat: boolean;
  rulesAccepted: boolean;
  /** null = đổi tên được ngay */
  handleNextChangeAt: string | null;
  bannedUntil: string | null;
  banReason: string | null;
  postCount: number;
}

/** GET /api/kairos/users/[id] — hồ sơ công khai nhìn từ người đang xem. */
export interface KairosUser extends KairosAuthor {
  postCount: number;
  following: boolean;
  blockedByMe: boolean;
  me: boolean;
}

// ── Câu lỗi ─────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const dayLabel = (iso: unknown) => {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Kết quả hỏng ⇒ câu nói thật cho bà con (14 §10 "câu theo mã"). `what` = việc đang làm, để
 * câu chung có chủ ngữ ("Chưa gửi được bình luận"). Mất sóng luôn nói "cần sóng".
 */
export function errorText(
  r: { code: string; status: number; offline: boolean; extra?: Record<string, unknown> },
  what: "bai" | "binh-luan" | "ten" | "anh" | "hay" | "bao-xau" | "theo-doi" | "chan" | "xoa" = "bai",
): string {
  if (r.offline) return "Cần sóng — chưa gửi được. Có sóng bà con bấm lại.";
  const max = what === "binh-luan" ? LIMITS.commentBody : what === "bao-xau" ? LIMITS.reportNote : LIMITS.postBody;
  switch (r.code) {
    case "empty":
      return what === "binh-luan" ? "Bà con viết vài chữ đã." : "Bà con viết vài chữ hoặc thêm ảnh đã.";
    case "too_long":
      return `Dài quá — tối đa ${max.toLocaleString("vi-VN")} ký tự.`;
    case "too_many_images":
      return `Tối đa ${LIMITS.images} ảnh.`;
    case "bad_image":
    case "image_too_large":
      return "Ảnh này không dùng được, chọn ảnh khác.";
    case "bad_words":
      return "Có chữ không hay, bà con sửa lại giúp.";
    case "sovereignty":
      return "Có tên gọi sai về biển đảo. Dùng \"Biển Đông\", \"Hoàng Sa, Trường Sa của Việt Nam\".";
    case "rate_limited":
      return what === "hay" ? "Bấm nhanh quá, đợi chút rồi bấm lại." : "Hôm nay bà con gửi nhiều rồi, mai gửi tiếp nhé.";
    case "banned": {
      const d = dayLabel(r.extra?.until);
      return d ? `Tài khoản đang bị khoá đăng tới ${d}.` : "Tài khoản đang bị khoá đăng.";
    }
    case "rules":
      return "Cần đồng ý nội quy trước khi đăng.";
    case "handle_short":
      return `Tên cần ít nhất ${LIMITS.handleMin} ký tự.`;
    case "handle_long":
      return `Tên tối đa ${LIMITS.handleMax} ký tự.`;
    case "handle_chars":
      return "Tên chỉ dùng chữ, số, dấu cách và . - _";
    case "handle_reserved":
      return "Tên này dễ nhầm với báo, cơ quan nhà nước hoặc SDVICO. Chọn tên khác.";
    case "handle_taken":
      return "Tên này đã có người dùng. Thêm số hoặc chọn tên khác.";
    case "handle_cooldown": {
      const d = dayLabel(r.extra?.nextAt);
      return d ? `30 ngày chỉ đổi tên 1 lần. Đổi lại được từ ${d}.` : "30 ngày chỉ đổi tên 1 lần.";
    }
    case "official_fixed":
      return "Tên SDVICO không đổi được.";
    case "self":
      return what === "bao-xau" ? "Không báo xấu bài của chính mình được." : "Không làm vậy với chính mình được.";
    case "gone":
    case "not_found":
      return what === "binh-luan" ? "Bài này không còn." : "Bài hoặc người này không còn.";
    case "comment_gone":
      return "Bình luận này không còn.";
    case "not_owner":
      return "Chỉ chủ bài mới sửa, xoá được.";
    case "storage_failed":
      return "Chưa xoá được ảnh trong kho. Bài vẫn còn nguyên, thử lại sau.";
    case "unavailable":
      return "Máy chủ đang bận, thử lại sau.";
    default:
      if (r.status === 401) return "Cần đăng nhập.";
      return `Chưa gửi được (lỗi ${r.status || "mạng"}). Bấm Thử lại.`;
  }
}

// ── Hay lạc quan ────────────────────────────────────────────────────────

export interface HayState {
  hayByMe: boolean;
  hayCount: number;
}

/** Bấm Hay: đảo trạng thái + đếm ngay (lạc quan). Không xuống dưới 0. */
export function flipHay(s: HayState): HayState {
  const on = !s.hayByMe;
  return { hayByMe: on, hayCount: Math.max(0, s.hayCount + (on ? 1 : -1)) };
}

/** Máy chủ trả lời: ok ⇒ lấy số thật của máy chủ; hỏng ⇒ trả về trạng thái TRƯỚC khi bấm. */
export function settleHay(before: HayState, res: SendResult<{ on: boolean; hayCount: number }>): HayState {
  if (!res.ok) return before;
  const n = res.data.hayCount;
  return { hayByMe: res.data.on, hayCount: typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : before.hayCount };
}

// ── Bình luận ───────────────────────────────────────────────────────────

export interface Thread {
  root: KairosComment;
  replies: KairosComment[];
}

/**
 * Danh sách phẳng (máy chủ trả theo giờ tăng dần, nhiều trang) ⇒ luồng 1 cấp: gốc theo thứ tự
 * đến, trả lời dưới gốc của nó. Trả lời mà gốc chưa tải tới (trang sau) / đã xoá ⇒ đứng như
 * gốc để không mất chữ. Trùng id (trang chồng) ⇒ giữ bản sau.
 */
export function threadComments(list: readonly KairosComment[]): Thread[] {
  const byId = new Map<string, KairosComment>();
  for (const c of list) byId.set(c.id, c);
  const roots: Thread[] = [];
  const idx = new Map<string, Thread>();
  const all = [...byId.values()];
  for (const c of all) {
    if (c.parentId && byId.has(c.parentId)) continue;
    const t = { root: c, replies: [] };
    idx.set(c.id, t);
    roots.push(t);
  }
  for (const c of all) if (c.parentId && idx.has(c.parentId)) idx.get(c.parentId)!.replies.push(c);
  return roots;
}

/** Trả lời một trả lời ⇒ gắn vào gốc kèm "@tên " ở đầu (14 §3.4). Trả lời gốc ⇒ không chèn. */
export function replyTarget(c: KairosComment): { parentId: string; prefix: string } {
  return c.parentId ? { parentId: c.parentId, prefix: `@${c.author.handle} ` } : { parentId: c.id, prefix: "" };
}

/** Bỏ một bình luận khỏi danh sách; xoá gốc ⇒ bỏ luôn trả lời con (máy chủ cascade). */
export function dropComment(list: readonly KairosComment[], id: string): KairosComment[] {
  return list.filter((c) => c.id !== id && c.parentId !== id);
}

// ── Chia sẻ ─────────────────────────────────────────────────────────────

/**
 * Link công khai `/k/[id]` (14 §3.6). Bản native (Capacitor) có `NEXT_PUBLIC_API_BASE` ⇒ dùng
 * host đó (origin `capacitor://` không mở được trên máy người nhận); web ⇒ origin hiện tại.
 */
export function shareLink(postId: string, origin: string, base = apiBase()): string {
  const host = base || origin.replace(/\/+$/, "");
  return `${host}/k/${encodeURIComponent(postId)}`;
}

/** Chữ đi kèm link khi gửi Zalo: tiêu đề bài báo hoặc ~120 ký tự đầu bài, không SĐT. */
export function shareText(p: Pick<KairosPost, "kind" | "title" | "body" | "summary" | "outlet" | "author">): string {
  const who = p.kind === "bao" ? p.outlet || "Báo" : p.kind === "chinh-thuc" ? "SDVICO" : p.author?.handle || "Bà con";
  const raw = (p.kind === "bao" ? p.title || p.summary || "" : p.body || "").replace(/\s+/g, " ").trim();
  const cut = [...raw].length > 120 ? `${[...raw].slice(0, 117).join("")}…` : raw;
  return cut ? `${who}: ${cut}` : `${who} trên Kairos`;
}

/**
 * URL ảnh công khai ⇒ đường kho `<profileId>/<uuid>.<ext>` (route PATCH nhận ĐƯỜNG, thẻ bài
 * có URL). Supabase: `…/kairos-media/<pid>/<uuid>.jpg`; dev: `/api/dev/kairos-media/<pid>__<uuid>.jpg`.
 * Lạ ⇒ null (bỏ ảnh đó khỏi bản sửa còn hơn gửi đường hỏng bị 400).
 */
export function mediaPathFromUrl(url: string): string | null {
  const m = url.match(/([0-9a-f-]{36})(?:\/|__)([0-9a-f-]{36}\.(?:jpg|png|webp))(?:[?#].*)?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}
