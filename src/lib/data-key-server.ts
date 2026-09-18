// KHOÁ DỮ LIỆU SDF2 PHÍA SERVER — thuần, có test (2026-09-16).
//
// Một khoá chủ 32 byte trong env `SDFISH_DATA_KEY` (hex 64 ký tự). Script build
// dùng nó mã file; route `/api/data-key` giao nó cho tài khoản đã đăng nhập.
// Đổi khoá = đổi env rồi deploy lại (file mã lại cùng lúc, id mới).
//
// Tạo khoá:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import { createHash } from "node:crypto";
import { bytesOfHex, hexOf } from "@/lib/data-codec.mjs";
import type { RateWindow } from "@/lib/rate-limit";

export const DATA_KEY_ENV = "SDFISH_DATA_KEY";

/** 30 lượt xin khoá / 24 giờ cho một SĐT — máy thật xin 1 lần rồi cất. */
export const DATA_KEY_RATE: RateWindow = { limit: 30, windowMs: 24 * 60 * 60 * 1000 };

/** Env → 32 byte, hoặc null nếu thiếu/sai dạng. */
export function parseDataKeyHex(v: string | undefined | null): Uint8Array | null {
  if (typeof v !== "string") return null;
  const raw = bytesOfHex(v.trim());
  return raw && raw.length === 32 ? raw : null;
}

/** key id = 8 byte đầu SHA-256(khoá) — CÙNG công thức với `keyIdOf` phía client. */
export function keyIdOfSync(raw: Uint8Array): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/** Thân phản hồi của /api/data-key. */
export function dataKeyPayload(raw: Uint8Array): { ok: true; id: string; key: string } {
  return { ok: true, id: keyIdOfSync(raw), key: hexOf(raw) };
}
