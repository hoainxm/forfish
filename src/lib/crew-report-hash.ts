import "server-only";
import { createHash } from "node:crypto";
import { normalizeCccd } from "@/lib/crew";

// Khoá tra cảnh báo = HASH(CCCD) — KHÔNG lưu CCCD thô làm khoá tìm để không ai
// dò/duyệt được cả danh sách (muốn tra phải BIẾT đúng CCCD đang nhập). Pepper
// bí mật ở env CREW_CCCD_PEPPER (KHÔNG hardcode). Thiếu pepper → null: route
// từ chối, không âm thầm hash bằng khoá rỗng (fail-closed).

export function cccdPepper(): string | null {
  const p = process.env.CREW_CCCD_PEPPER;
  return p && p.length >= 16 ? p : null;
}

/** SHA-256(pepper + cccd12). Trả null nếu CCCD sai định dạng hoặc thiếu pepper. */
export function hashCccd(rawCccd: string): string | null {
  const pepper = cccdPepper();
  if (!pepper) return null;
  const cccd = normalizeCccd(rawCccd);
  if (!/^\d{12}$/.test(cccd)) return null;
  return createHash("sha256").update(`${pepper}:${cccd}`).digest("hex");
}
