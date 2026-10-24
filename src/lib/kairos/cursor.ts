// KAIROS — CON TRỎ PHÂN TRANG (14 §3.2, §3.4, AC02). THUẦN.
//
// Dòng tin xếp `(feed_at desc, id desc)` (giờ bài LÊN dòng tin — bài báo: lúc được cho đạt), bình luận `(created_at asc, id asc)`. Con trỏ =
// cặp (giờ, id) của bài CUỐI trang trước, mã base64url để client coi như chuỗi mờ. Không dùng
// offset: bài mới chen vào đầu thì offset trượt, cuộn vô tận lặp bài.

const SEP = "|";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Cursor {
  /** ISO */
  at: string;
  id: string;
}

function toB64Url(s: string): string {
  const b64 = typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
}

export function encodeCursor(c: Cursor): string {
  return toB64Url(`${new Date(c.at).toISOString()}${SEP}${c.id}`);
}

/** Chuỗi lạ / hỏng ⇒ null (route coi như trang đầu — KHÔNG ném 500 vì một tham số URL). */
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw || raw.length > 120 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  let s: string;
  try {
    s = fromB64Url(raw);
  } catch {
    return null;
  }
  const i = s.indexOf(SEP);
  if (i < 0) return null;
  const at = s.slice(0, i);
  const id = s.slice(i + 1);
  const t = Date.parse(at);
  if (!Number.isFinite(t) || !UUID_RE.test(id)) return null;
  return { at: new Date(t).toISOString(), id: id.toLowerCase() };
}

/** Hàng `a` đứng SAU con trỏ trong thứ tự giảm dần (dòng tin) — dùng cho kho file dev. */
export function isAfterDesc(a: { at: string; id: string }, c: Cursor): boolean {
  const ta = Date.parse(a.at);
  const tc = Date.parse(c.at);
  return ta < tc || (ta === tc && a.id.toLowerCase() < c.id);
}

/** Hàng `a` đứng SAU con trỏ trong thứ tự tăng dần (bình luận). */
export function isAfterAsc(a: { at: string; id: string }, c: Cursor): boolean {
  const ta = Date.parse(a.at);
  const tc = Date.parse(c.at);
  return ta > tc || (ta === tc && a.id.toLowerCase() > c.id);
}

/**
 * Lấy một trang từ mảng ĐÃ XẾP + con trỏ trang sau (null = hết). Lấy dư 1 để biết còn hay hết,
 * khỏi phải đếm. Dùng chung cho kho file dev và để test.
 */
export function pageOf<T>(
  sorted: readonly T[],
  key: (row: T) => { at: string; id: string },
  cursor: Cursor | null,
  size: number,
  order: "desc" | "asc" = "desc",
): { items: T[]; next: string | null } {
  const after = order === "desc" ? isAfterDesc : isAfterAsc;
  const rest = cursor ? sorted.filter((r) => after(key(r), cursor)) : sorted;
  const items = rest.slice(0, size);
  const last = items[items.length - 1];
  return { items, next: rest.length > size && last ? encodeCursor(key(last)) : null };
}
