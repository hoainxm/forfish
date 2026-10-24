// KAIROS — KIỂM PATCH /api/kairos/me (14 §3.7–§3.8, AC08/AC12/AC13). THUẦN.
// Trường lạ bị bỏ qua; trường có mặt mà sai kiểu ⇒ lỗi (không đoán). Tên gọi qua validateHandle
// (ten-goi.ts). Ảnh đại diện + ảnh bìa phải nằm trong thư mục kho của CHÍNH hồ sơ (như ảnh bài).
// Giới thiệu (0067): quê = mã tỉnh khu-vuc.mjs · nghề = mã ho-so.NGHE · cảng nhà = mã
// fishing-ports (bên gọi truyền tập mã) · giới thiệu ≤150 ký tự, một dòng, lọc chữ bậy +
// chủ quyền. Mỗi trường gửi `null` (hoặc "" với giới thiệu) = xoá.

import { GIOI_THIEU_MAX, isNghe, isTinh } from "./ho-so";
import { validateHandle } from "./ten-goi";
import { charLen, cleanText, contentFlag, isOwnMediaPath } from "./validate";
import type { KairosErrorCode } from "./types";

export interface MePatch {
  handle?: { handle: string; norm: string };
  /** null = bỏ ảnh tự chọn, về chữ cái đầu */
  avatarPath?: string | null;
  /** null = bỏ ảnh bìa, về nền màu */
  coverPath?: string | null;
  showBoat?: boolean;
  acceptRules?: true;
  queTinh?: string | null;
  nghe?: string | null;
  /** null = xoá */
  gioiThieu?: string | null;
  homePort?: string | null;
}

export type MePatchCode = KairosErrorCode | "bad_body" | "bad_avatar" | "bad_cover" | "bad_province" | "bad_job";

export function validateMePatch(
  raw: unknown,
  profileId: string,
  portIds: ReadonlySet<string> = new Set(),
): { ok: true; value: MePatch } | { ok: false; code: MePatchCode; term?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "bad_body" };
  const r = raw as Record<string, unknown>;
  const out: MePatch = {};
  if ("handle" in r) {
    const h = validateHandle(r.handle);
    if (!h.ok) return { ok: false, code: h.code, term: h.term };
    out.handle = h.value;
  }
  if ("avatarPath" in r) {
    if (r.avatarPath === null) out.avatarPath = null;
    else if (isOwnMediaPath(r.avatarPath, profileId)) out.avatarPath = r.avatarPath;
    else return { ok: false, code: "bad_avatar" };
  }
  if ("coverPath" in r) {
    if (r.coverPath === null) out.coverPath = null;
    else if (isOwnMediaPath(r.coverPath, profileId)) out.coverPath = r.coverPath;
    else return { ok: false, code: "bad_cover" };
  }
  if ("showBoat" in r) {
    if (typeof r.showBoat !== "boolean") return { ok: false, code: "bad_body" };
    out.showBoat = r.showBoat;
  }
  if ("acceptRules" in r) {
    if (r.acceptRules !== true) return { ok: false, code: "bad_body" };
    out.acceptRules = true;
  }
  if ("queTinh" in r) {
    if (r.queTinh !== null && !isTinh(r.queTinh)) return { ok: false, code: "bad_province" };
    out.queTinh = r.queTinh as string | null;
  }
  if ("nghe" in r) {
    if (r.nghe !== null && !isNghe(r.nghe)) return { ok: false, code: "bad_job" };
    out.nghe = r.nghe as string | null;
  }
  if ("homePort" in r) {
    if (r.homePort !== null && (typeof r.homePort !== "string" || !portIds.has(r.homePort))) return { ok: false, code: "bad_port" };
    out.homePort = r.homePort as string | null;
  }
  if ("gioiThieu" in r) {
    if (r.gioiThieu !== null && typeof r.gioiThieu !== "string") return { ok: false, code: "bad_body" };
    // một dòng: xuống dòng ⇒ dấu cách
    const g = r.gioiThieu === null ? "" : cleanText(r.gioiThieu as string).replace(/\s+/g, " ");
    if (charLen(g) > GIOI_THIEU_MAX) return { ok: false, code: "too_long" };
    const flag = g ? contentFlag(g) : null;
    if (flag) return { ok: false, code: flag.code, term: flag.term };
    out.gioiThieu = g || null;
  }
  if (!Object.keys(out).length) return { ok: false, code: "bad_body" };
  return { ok: true, value: out };
}
