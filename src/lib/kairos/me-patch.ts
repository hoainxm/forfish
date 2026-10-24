// KAIROS — KIỂM PATCH /api/kairos/me (14 §3.7, AC08/AC12). THUẦN.
// Trường lạ bị bỏ qua; trường có mặt mà sai kiểu ⇒ lỗi (không đoán). Tên gọi qua validateHandle
// (ten-goi.ts). Ảnh đại diện phải nằm trong thư mục kho của CHÍNH hồ sơ (như ảnh bài).

import { validateHandle } from "./ten-goi";
import type { KairosErrorCode } from "./types";

const AVATAR_RE = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

export interface MePatch {
  handle?: { handle: string; norm: string };
  /** null = bỏ ảnh tự chọn, về chữ cái đầu */
  avatarPath?: string | null;
  showBoat?: boolean;
  acceptRules?: true;
}

export function validateMePatch(
  raw: unknown,
  profileId: string,
): { ok: true; value: MePatch } | { ok: false; code: KairosErrorCode | "bad_body" | "bad_avatar"; term?: string } {
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
    else {
      const m = typeof r.avatarPath === "string" ? r.avatarPath.match(AVATAR_RE) : null;
      if (!m || m[1].toLowerCase() !== profileId.toLowerCase()) return { ok: false, code: "bad_avatar" };
      out.avatarPath = r.avatarPath as string;
    }
  }
  if ("showBoat" in r) {
    if (typeof r.showBoat !== "boolean") return { ok: false, code: "bad_body" };
    out.showBoat = r.showBoat;
  }
  if ("acceptRules" in r) {
    if (r.acceptRules !== true) return { ok: false, code: "bad_body" };
    out.acceptRules = true;
  }
  if (!Object.keys(out).length) return { ok: false, code: "bad_body" };
  return { ok: true, value: out };
}
