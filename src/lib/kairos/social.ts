// KAIROS — LUẬT THUẦN CỦA CÁC NÚT GHI (14 §3.3–§3.10, AC07–AC15). Không React, không fetch,
// không localStorage — trang server (/k/[id]) và test dùng được. Phần mạng ở write-client.ts.
//
// Gồm: mã lỗi route ⇒ câu tiếng Việt đúng chỗ (14 §10), Hay lạc quan + hoàn tác, gom bình luận
// thành luồng 1 cấp, link + chữ chia sẻ (không SĐT), đổi URL ảnh về đường kho (sửa bài giữ ảnh).

import { apiBase } from "@/lib/api-base";
import { GIOI_THIEU_MAX } from "./ho-so";
import { LIMITS, type KairosAbout, type KairosAuthor, type KairosComment, type KairosPost } from "./types";

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
  /** ảnh bìa + quê, nghề, giới thiệu, cảng nhà (0067) */
  about: KairosAbout;
  /** tên còn mặc định chưa đổi lần nào ⇒ trang mình mời đặt tên */
  askName: boolean;
}

/** GET /api/kairos/users/[id] — hồ sơ công khai nhìn từ người đang xem. */
export interface KairosUser extends KairosAuthor {
  postCount: number;
  following: boolean;
  blockedByMe: boolean;
  me: boolean;
  /** ảnh bìa + Giới thiệu (0067) — cột chưa có ⇒ trống */
  about: KairosAbout;
  /** số người theo dõi người này */
  followers: number;
  /** số người người này đang theo dõi */
  followingCount: number;
  /** cùng cảng nhà với người đang xem (không phải trang mình) */
  samePort: boolean;
  /** hồ sơ là agent AI (16-ba-spec-agent-kairos, nháp) — chưa có cột, luôn false */
  isAgent: boolean;
  /** trang của mình + tên còn mặc định chưa đổi lần nào ⇒ mời đặt tên ngay trên trang */
  askName: boolean;
}

/** Phần Giới thiệu rỗng — bản lưu mất sóng / cột chưa có. */
export const EMPTY_ABOUT: KairosAbout = { coverUrl: null, queTinh: null, nghe: null, gioiThieu: "", homePort: null };

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
  what: "bai" | "binh-luan" | "ten" | "anh" | "hay" | "bao-xau" | "theo-doi" | "chan" | "xoa" | "ho-so" = "bai",
): string {
  if (r.offline) return "Cần sóng — chưa gửi được. Có sóng bà con bấm lại.";
  const max =
    what === "binh-luan" ? LIMITS.commentBody : what === "bao-xau" ? LIMITS.reportNote : what === "ho-so" ? GIOI_THIEU_MAX : LIMITS.postBody;
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
    case "bad_province":
    case "bad_job":
    case "bad_port":
      return "Chọn lại trong danh sách giúp.";
    case "bad_avatar":
    case "bad_cover":
      return "Ảnh này không dùng được, chọn ảnh khác.";
    case "fields_missing":
      return "Phần giới thiệu chưa mở trên máy chủ, thử lại sau.";
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

// ── Khung soạn: trạng thái `/me` ⇒ nút Đăng, dòng báo, Thử lại (AC07, A44) ─────

export type ComposerMe = { s: "loading" } | { s: "ok"; me: KairosMe } | { s: "offline" } | { s: "error"; text: string };

export interface ComposerGate {
  canSend: boolean;
  /** nhãn nút ghi (màn đổi `dang` ⇒ `luu` khi đang sửa) — khoá NHAN */
  button: "canSong" | "dangGui" | "dangTai" | "dang";
  /** `/me` chưa hỏi được (mất sóng / lỗi) ⇒ hiện nút Thử lại */
  retry: boolean;
  /** dòng báo dưới khung khi `/me` mất sóng */
  offlineNote: boolean;
}

/**
 * Quyết định MỘT chỗ: mở khung lúc mất sóng không được kẹt. `online` = máy không báo mất sóng;
 * `/me` hỏng vì sóng chết (máy vẫn báo có sóng) cũng coi là "cần sóng" + Thử lại. Đăng chỉ sáng
 * khi `/me` đã về, đã đồng ý nội quy, chữ hợp lệ.
 */
export function composerGate(i: {
  online: boolean;
  me: ComposerMe;
  busy: boolean;
  empty: boolean;
  tooLong: boolean;
  needRules: boolean;
}): ComposerGate {
  const noNet = !i.online || i.me.s === "offline";
  const rulesOk = i.me.s === "ok" && i.me.me.rulesAccepted && !i.needRules;
  return {
    canSend: !noNet && !i.busy && !i.empty && !i.tooLong && rulesOk,
    button: noNet ? "canSong" : i.busy ? "dangGui" : i.me.s === "loading" ? "dangTai" : "dang",
    retry: i.me.s === "offline" || i.me.s === "error",
    offlineNote: i.me.s === "offline",
  };
}

/** Có sóng lại (sự kiện `online`) thì hỏi lại `/me` khi lượt trước chưa về được. */
export function meRefetchOnOnline(me: ComposerMe): boolean {
  return me.s === "offline" || me.s === "error";
}

/**
 * Ảnh tải lên TRONG phiên khung soạn này mà không nằm trong bài đã lưu ⇒ xoá khỏi kho (Huỷ
 * khung: `kept` rỗng; Đăng xong: `kept` = ảnh của bài). Ảnh có sẵn của bài đang sửa không
 * bao giờ ở `session` nên không bị đụng.
 */
export function orphanUploads(session: Iterable<string>, kept: readonly string[]): string[] {
  const keep = new Set(kept);
  return [...new Set(session)].filter((p) => !keep.has(p));
}

// ── Chặn người: gỡ ngay trên màn (AC15) ───────────────────────────────────

/**
 * Bỏ khỏi danh sách đang hiện MỌI dấu vết của người mình vừa chặn: bài của họ, bình luận nổi
 * của họ dưới bài người khác, thẻ bài gốc của họ trong bài đăng lại (⇒ "không còn", như máy chủ
 * trả ở lần tải sau). Không chặn ai ⇒ trả nguyên danh sách.
 */
export function hideBlocked(list: readonly KairosPost[], blocked: ReadonlySet<string>): KairosPost[] {
  if (!blocked.size) return list as KairosPost[];
  const by = (a: KairosAuthor | null | undefined) => !!a && blocked.has(a.profileId);
  return list
    .filter((p) => !by(p.author))
    .map((p) => {
      const tops = p.topComments.filter((c) => !by(c.author));
      const gone = !!p.reshareOf && by(p.reshareOf.author);
      if (tops.length === p.topComments.length && !gone) return p;
      return { ...p, topComments: tops, ...(gone ? { reshareOf: null, reshareGone: true } : {}) };
    });
}

// ── Bình luận ───────────────────────────────────────────────────────────

export interface Thread {
  root: KairosComment;
  replies: KairosComment[];
}

/** Giờ tăng dần, trùng giờ thì so id — nối trang 2 hay chèn bình luận vừa gửi đều về đúng chỗ. */
function theoGio(a: KairosComment, b: KairosComment): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  const d = (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
  return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Danh sách phẳng (nhiều trang, có thể lẫn bình luận vừa gửi) ⇒ luồng 1 cấp: gốc và trả lời
 * trong từng luồng XẾP THEO GIỜ tăng dần (trùng giờ so id), không theo thứ tự đến. Trả lời mà
 * gốc chưa tải tới (trang sau) / đã xoá ⇒ đứng như gốc để không mất chữ. Trùng id (trang chồng)
 * ⇒ giữ bản sau.
 */
export function threadComments(list: readonly KairosComment[]): Thread[] {
  const byId = new Map<string, KairosComment>();
  for (const c of list) byId.set(c.id, c);
  const roots: Thread[] = [];
  const idx = new Map<string, Thread>();
  const all = [...byId.values()].sort(theoGio);
  for (const c of all) {
    if (c.parentId && byId.has(c.parentId)) continue;
    const t = { root: c, replies: [] };
    idx.set(c.id, t);
    roots.push(t);
  }
  for (const c of all) if (c.parentId && idx.has(c.parentId)) idx.get(c.parentId)!.replies.push(c);
  return roots;
}

/**
 * Trả lời được HIỆN của một luồng (như FB "Xem N phản hồi"): 1 trả lời ⇒ hiện luôn; ≥2 ⇒ gập
 * hết, trừ khi luồng đang mở (`moSet` chứa id gốc) hoặc chứa bình luận được trỏ tới (`#bl-<id>`
 * từ thông báo).
 */
export function traLoiHien(thread: Thread, moSet: ReadonlySet<string>, idTroToi?: string | null): KairosComment[] {
  const r = thread.replies;
  if (r.length <= 1 || moSet.has(thread.root.id)) return r;
  if (idTroToi && r.some((c) => c.id === idTroToi)) return r;
  return [];
}

/** Trả lời một trả lời ⇒ gắn vào gốc kèm "@tên " ở đầu (14 §3.4). Trả lời gốc ⇒ không chèn. */
export function replyTarget(c: KairosComment): { parentId: string; prefix: string } {
  return c.parentId ? { parentId: c.parentId, prefix: `@${c.author.handle} ` } : { parentId: c.id, prefix: "" };
}

/**
 * Chữ gửi đi của ô bình luận. Ô KHÔNG chèn "@tên" khi bấm Trả lời (viên "Trả lời …" nói thay);
 * lúc gửi mới ghép: chỉ khi đang trả lời MỘT TRẢ LỜI và chữ chưa mở đầu bằng đúng tiền tố đó.
 */
export function ghepTraLoi(text: string, replyTo: { handle: string } | null, laTraLoiCuaTraLoi: boolean): string {
  if (!replyTo || !laTraLoiCuaTraLoi) return text;
  const pre = `@${replyTo.handle} `;
  return text.startsWith(pre) ? text : `${pre}${text}`;
}

/**
 * Nháp cũ (bản chèn "@tên " vào ô) ⇒ bóc tiền tố khi mở lại. Chỉ bóc khi khớp ĐÚNG một tên đã
 * biết (tên gọi có dấu cách nên không đoán theo khoảng trắng); tên dài nhất thắng.
 */
export function bocTienTo(text: string, handles: Iterable<string>): string {
  if (!text.startsWith("@")) return text;
  let best = "";
  for (const h of handles) {
    const pre = `@${h} `;
    if (h && text.startsWith(pre) && pre.length > best.length) best = pre;
  }
  return best ? text.slice(best.length) : text;
}

/**
 * Khung soạn có gì để mất không (bấm × / Escape mới hỏi Lưu nháp · Bỏ bài · Viết tiếp).
 * Bài mới / đăng lại: có chữ hoặc có ảnh. Sửa bài: so với nội dung cũ — không đổi gì ⇒ đóng ngay.
 */
export function khungCoThayDoi(text: string, images: readonly string[], cu?: { body: string; images: readonly string[] } | null): boolean {
  if (!cu) return !!text.trim() || images.length > 0;
  return text.trim() !== cu.body.trim() || images.length !== cu.images.length || images.some((u, i) => u !== cu.images[i]);
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

/** Tên miền hiện trên dải thẻ link bài báo ("laodong.vn") — bỏ "www.", link hỏng ⇒ "". */
export function tenMien(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
