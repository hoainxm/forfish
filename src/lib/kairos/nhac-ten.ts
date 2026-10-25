// KAIROS — NHẮC TÊN (@tag) KIỂU FACEBOOK (14 §3.12, migration 0071). THUẦN — dùng chung máy chủ + máy bà con.
//
// Chữ "@Tên" nằm thẳng trong body; cột `mentions` [{id, ten}] nói đoạn "@ten" nào là người nào (tên lúc tag —
// đổi tên sau vẫn trỏ đúng trang người). Máy chủ chỉ giữ người mà "@ten" CÓ trong chữ (`locNhacTen`); xoá chữ
// "@ten" khi sửa ⇒ hết tag. Ô viết: gõ "@" + vài chữ ⇒ `dangGo` tìm đoạn đang gõ, `goiY` lọc người, `chenTen`
// thay đoạn đó bằng "@Tên " và trả chỗ con trỏ mới.

import { foldVn } from "@/lib/market/text";

export interface NhacTen {
  /** profileId (uuid công khai — KHÔNG SĐT) */
  id: string;
  /** tên gọi lúc tag */
  ten: string;
}

export const NHAC_TOI_DA = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bản lưu DB / JSON khách gửi (có thể hỏng) ⇒ danh sách hợp lệ, không trùng id, ≤10. */
export function docNhacTen(raw: unknown): NhacTen[] {
  if (!Array.isArray(raw)) return [];
  const out: NhacTen[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || !UUID.test(r.id) || typeof r.ten !== "string" || !r.ten.trim()) continue;
    const id = r.id.toLowerCase();
    if (out.some((m) => m.id === id)) continue;
    out.push({ id, ten: r.ten.trim().slice(0, 40) });
    if (out.length >= NHAC_TOI_DA) break;
  }
  return out;
}

/** id người được tag do khách gửi (chỉ id; tên máy chủ tự lấy) ⇒ uuid hợp lệ, không trùng, ≤10. */
export function docIdNhac(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    const id = typeof x === "string" ? x : x && typeof x === "object" ? (x as { id?: unknown }).id : null;
    if (typeof id !== "string" || !UUID.test(id)) continue;
    const v = id.toLowerCase();
    if (!out.includes(v)) out.push(v);
    if (out.length >= NHAC_TOI_DA) break;
  }
  return out;
}

const laChuSo = (c: string | undefined) => !!c && /[\p{L}\p{N}_]/u.test(c);

/** Vị trí "@ten" đứng riêng (trước là đầu/khoảng trắng/dấu câu, sau không dính chữ) — so không phân biệt hoa. */
function viTri(body: string, ten: string): number[] {
  const out: number[] = [];
  const b = body.toLowerCase();
  const k = `@${ten}`.toLowerCase();
  for (let i = b.indexOf(k); i >= 0; i = b.indexOf(k, i + 1)) {
    if (laChuSo(body[i - 1]) || laChuSo(body[i + k.length])) continue;
    out.push(i);
  }
  return out;
}

/** Giữ người mà "@ten" có trong chữ. */
export function locNhacTen(body: string, ds: readonly NhacTen[]): NhacTen[] {
  return docNhacTen(ds).filter((m) => viTri(body, m.ten).length > 0);
}

export type DoanChu = { chu: string } | { chu: string; nhac: NhacTen };

/** Chia chữ thành đoạn thường + đoạn "@Tên" (tên dài trước — "@Hải Âu Nhỏ" không bị cắt thành "@Hải Âu"). */
export function chiaDoan(body: string, ds: readonly NhacTen[]): DoanChu[] {
  const cac: { i: number; n: number; m: NhacTen }[] = [];
  for (const m of [...docNhacTen(ds)].sort((a, b) => b.ten.length - a.ten.length)) {
    for (const i of viTri(body, m.ten)) {
      const n = m.ten.length + 1;
      if (cac.some((c) => i < c.i + c.n && c.i < i + n)) continue;
      cac.push({ i, n, m });
    }
  }
  cac.sort((a, b) => a.i - b.i);
  const out: DoanChu[] = [];
  let k = 0;
  for (const c of cac) {
    if (c.i > k) out.push({ chu: body.slice(k, c.i) });
    out.push({ chu: body.slice(c.i, c.i + c.n), nhac: c.m });
    k = c.i + c.n;
  }
  if (k < body.length) out.push({ chu: body.slice(k) });
  return out;
}

/**
 * Đoạn "@…" đang gõ ngay trước con trỏ: "@" đứng đầu hoặc sau khoảng trắng/xuống dòng, sau đó ≤30 ký tự, tối đa 2
 * khoảng trắng (tên có dấu cách: "@Hải Âu"), không xuống dòng. Không có ⇒ null.
 */
export function dangGo(text: string, caret: number): { start: number; q: string } | null {
  const truoc = text.slice(0, caret);
  const at = truoc.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(truoc[at - 1])) return null;
  const q = truoc.slice(at + 1);
  if (q.length > 30 || /[\n@]/.test(q) || (q.match(/ /g)?.length ?? 0) > 2 || /^\s/.test(q)) return null;
  return { start: at, q };
}

/** Thay đoạn "@q" bằng "@Tên " ⇒ chữ mới + chỗ con trỏ. */
export function chenTen(text: string, start: number, caret: number, ten: string): { text: string; caret: number } {
  const chen = `@${ten} `;
  const sau = text.slice(caret).replace(/^ /, "");
  return { text: text.slice(0, start) + chen + sau, caret: start + chen.length };
}

/** Lọc người theo chữ đang gõ: mỗi từ gõ khớp ĐẦU một từ trong tên (bỏ dấu); q rỗng ⇒ cả danh sách. */
export function goiY<T extends { ten: string }>(q: string, ds: readonly T[], toiDa = 6): T[] {
  const tu = foldVn(q).split(" ").filter(Boolean);
  const hop = ds.filter((d) => {
    const ten = foldVn(d.ten).split(" ");
    return tu.every((t) => ten.some((w) => w.startsWith(t)));
  });
  return hop.slice(0, toiDa);
}
