// KAIROS — KIỂM ĐẦU VÀO Ở RANH GIỚI (14 §3.3, §3.4, §3.10, AC07/AC10/AC15/AC21). THUẦN.
//
// Route gọi các hàm này TRƯỚC khi chạm DB; khung soạn gọi cùng hàm để báo sớm. Không tin body:
// mọi trường đều kiểm kiểu, độ dài, mã. Chữ bậy + chủ quyền chạy ở đây ⇒ gọi thẳng route
// (bỏ qua app) vẫn bị chặn. Độ dài đếm theo KÝ TỰ (code point) — khớp `char_length` của Postgres,
// không phải `.length` UTF-16 (một biểu tượng đếm 2).

import { badWordHit } from "./loc-chu";
import { chuQuyenFlag } from "./chu-quyen.mjs";
import { isTopic, type Topic } from "./chu-de.mjs";
import { LIMITS, REPORT_REASONS, type Checked, type ReportReason } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Đường ảnh trong kho kairos-media: `<profileId>/<uuid>.<jpg|png|webp>`. */
const IMAGE_PATH_RE = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;
/** Số cảng gắn tối đa vào một bài bà con. */
export const MAX_POST_PORTS = 3;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Đường kho là ảnh trong thư mục của CHÍNH người này (`<profileId>/<uuid>.<ext>`). */
export function isOwnMediaPath(p: unknown, profileId: string): p is string {
  const m = typeof p === "string" ? p.match(IMAGE_PATH_RE) : null;
  return !!m && m[1].toLowerCase() === profileId.toLowerCase();
}

/** Trần một lượt xoá ảnh vừa tải (bằng trần tải ảnh mỗi ngày — A1). */
export const MAX_DISCARD = 30;

/**
 * DELETE /api/kairos/upload `{paths}` — Huỷ khung soạn xoá ảnh mình vừa tải. Chỉ ảnh trong thư
 * mục của mình; một đường lạ ⇒ cả gói 400 (không xoá nửa vời theo ý người gọi).
 */
export function validateDiscard(body: unknown, profileId: string): Checked<string[]> {
  const raw = (body as { paths?: unknown } | null)?.paths;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_DISCARD) return { ok: false, code: "bad_body" };
  if (!raw.every((p) => isOwnMediaPath(p, profileId))) return { ok: false, code: "bad_image" };
  return { ok: true, value: [...new Set(raw as string[])] };
}

/** Số ký tự như Postgres đếm. */
export function charLen(s: string): number {
  return [...s].length;
}

/** Làm sạch chữ người gõ: NFC, bỏ ký tự điều khiển (giữ xuống dòng), gộp >2 dòng trống, cắt hai đầu. */
export function cleanText(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Chữ bậy rồi chủ quyền — mã lỗi đầu tiên trúng. */
export function contentFlag(text: string): { code: "bad_words" | "sovereignty"; term: string } | null {
  const bad = badWordHit(text);
  if (bad) return { code: "bad_words", term: bad };
  const sov = chuQuyenFlag(text);
  if (sov) return { code: "sovereignty", term: sov };
  return null;
}

export interface PostInput {
  body: string;
  images: string[];
  topic: Topic;
  ports: string[];
  reshareOf: string | null;
}

/**
 * Bài bà con (tạo hoặc sửa). `profileId` = hồ sơ người đăng — ảnh phải nằm trong thư mục của
 * CHÍNH họ (không mượn ảnh người khác rồi xoá bài là xoá ảnh của người ta).
 * `portIds` = tập mã cảng hợp lệ (danh mục fishing-ports.ts).
 * Rỗng chữ vẫn được khi có ảnh hoặc là bài đăng lại.
 */
export function validatePost(
  raw: unknown,
  ctx: { profileId: string; portIds: ReadonlySet<string> },
): Checked<PostInput> {
  if (!raw || typeof raw !== "object") return { ok: false, code: "empty" };
  const r = raw as Record<string, unknown>;

  if (r.body != null && typeof r.body !== "string") return { ok: false, code: "empty" };
  const body = cleanText((r.body as string | undefined) ?? "");
  if (charLen(body) > LIMITS.postBody) return { ok: false, code: "too_long" };

  const imgs = r.images ?? [];
  if (!Array.isArray(imgs)) return { ok: false, code: "bad_image" };
  if (imgs.length > LIMITS.images) return { ok: false, code: "too_many_images" };
  const images: string[] = [];
  for (const p of imgs) {
    if (!isOwnMediaPath(p, ctx.profileId)) return { ok: false, code: "bad_image" };
    if (!images.includes(p)) images.push(p);
  }

  const topic = r.topic ?? "nghe-ca";
  if (!isTopic(topic)) return { ok: false, code: "bad_topic" };

  const portsRaw = r.ports ?? [];
  if (!Array.isArray(portsRaw) || portsRaw.length > MAX_POST_PORTS) return { ok: false, code: "bad_port" };
  const ports: string[] = [];
  for (const id of portsRaw) {
    if (typeof id !== "string" || !ctx.portIds.has(id)) return { ok: false, code: "bad_port" };
    if (!ports.includes(id)) ports.push(id);
  }

  const reshareOf = r.reshareOf ?? null;
  if (reshareOf !== null && !isUuid(reshareOf)) return { ok: false, code: "empty" };

  if (!body && !images.length && !reshareOf) return { ok: false, code: "empty" };
  const flag = contentFlag(body);
  if (flag) return { ok: false, code: flag.code, term: flag.term };
  return { ok: true, value: { body, images, topic, ports, reshareOf: reshareOf as string | null } };
}

export interface CommentInput {
  body: string;
  parentId: string | null;
}

/** Bình luận / trả lời. Trả lời một trả lời ⇒ route quy về bình luận gốc (`replyRoot`). */
export function validateComment(raw: unknown): Checked<CommentInput> {
  if (!raw || typeof raw !== "object") return { ok: false, code: "empty" };
  const r = raw as Record<string, unknown>;
  if (typeof r.body !== "string") return { ok: false, code: "empty" };
  const body = cleanText(r.body);
  if (!body) return { ok: false, code: "empty" };
  if (charLen(body) > LIMITS.commentBody) return { ok: false, code: "too_long" };
  const parentId = r.parentId ?? null;
  if (parentId !== null && !isUuid(parentId)) return { ok: false, code: "empty" };
  const flag = contentFlag(body);
  if (flag) return { ok: false, code: flag.code, term: flag.term };
  return { ok: true, value: { body, parentId: parentId as string | null } };
}

/**
 * Trả lời đúng 1 cấp: đích là bình luận gốc ⇒ giữ; đích là một trả lời ⇒ gắn vào gốc của nó
 * (khung soạn chèn "@tên"). Trigger 0065 là lưới cuối.
 */
export function replyRoot(target: { id: string; parentId: string | null }): string {
  return target.parentId ?? target.id;
}

export interface ReportInput {
  targetType: "post" | "comment";
  targetId: string;
  reason: ReportReason;
  note: string | null;
}

export function validateReport(raw: unknown): Checked<ReportInput> {
  if (!raw || typeof raw !== "object") return { ok: false, code: "bad_reason" };
  const r = raw as Record<string, unknown>;
  if (r.targetType !== "post" && r.targetType !== "comment") return { ok: false, code: "bad_reason" };
  if (!isUuid(r.targetId)) return { ok: false, code: "bad_reason" };
  if (typeof r.reason !== "string" || !(REPORT_REASONS as readonly string[]).includes(r.reason)) {
    return { ok: false, code: "bad_reason" };
  }
  if (r.note != null && typeof r.note !== "string") return { ok: false, code: "bad_reason" };
  const note = cleanText((r.note as string | undefined) ?? "");
  if (charLen(note) > LIMITS.reportNote) return { ok: false, code: "too_long" };
  // Ghi chú báo xấu được phép TRÍCH chữ bậy/xuyên tạc (để người trực biết) — không lọc ở đây.
  return {
    ok: true,
    value: { targetType: r.targetType, targetId: r.targetId as string, reason: r.reason as ReportReason, note: note || null },
  };
}
