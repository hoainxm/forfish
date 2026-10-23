// KAIROS — KIỂM KHOÁ MÁY THU TIN / AGENT KIỂM DUYỆT (14 §7, AC17/AC21/AC24). THUẦN.
//
// /api/kairos/nhap và /api/kairos/kiem chỉ mở cho máy GPU nhà mang header `x-kairos-key`.
// Khoá hiệu lực: env KAIROS_INGEST_KEY nếu đặt (đè), không thì `app_config.kairos_ingest_key`
// (admin đổi ở /quan-tri tab Hệ thống). Thiếu CẢ HAI ⇒ "unconfigured" ⇒ route 503 — không
// bao giờ hiểu "chưa đặt khoá" là "ai cũng vào được".
//
// So sánh thời-gian-hằng: băm sha256 hai bên rồi `timingSafeEqual` trên 32 byte — độ dài khoá
// gửi lên không lộ qua thời gian trả lời (timingSafeEqual trần ném khi lệch độ dài).

import { createHash, timingSafeEqual } from "node:crypto";

export const INGEST_KEY_HEADER = "x-kairos-key";

/** Khoá hiệu lực: env (đè) rồi DB. Chuỗi rỗng/khoảng trắng coi như không đặt. */
export function effectiveIngestKey(envVal: string | null | undefined, dbVal: string | null | undefined): string | null {
  const e = envVal?.trim();
  if (e) return e;
  const d = dbVal?.trim();
  return d || null;
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

export function checkIngestKey(
  given: string | null | undefined,
  expected: string | null,
): "ok" | "bad" | "unconfigured" {
  if (!expected) return "unconfigured";
  const g = given?.trim() ?? "";
  if (!g || g.length > 500) return "bad";
  return timingSafeEqual(digest(g), digest(expected)) ? "ok" : "bad";
}
