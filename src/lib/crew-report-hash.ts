import "server-only";
import { createHash } from "node:crypto";
import { isValidCccd, normalizeCccd } from "@/lib/crew";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";

// Khoá tra cảnh báo = HASH(định danh) — KHÔNG lưu CCCD/SĐT thô làm khoá tìm để
// không ai dò/duyệt được cả danh sách (muốn tra phải BIẾT đúng CCCD/SĐT đang
// nhập). Định danh chấp nhận CCCD HOẶC SĐT (1 trong 2). Pepper bí mật ở env
// CREW_CCCD_PEPPER (KHÔNG hardcode). Thiếu pepper → null: route từ chối, không
// âm thầm hash bằng khoá rỗng (fail-closed).

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

/** SHA-256(pepper + "phone:" + SĐT chuẩn hoá). Tiền tố "phone:" tách miền khỏi
 *  hash CCCD (khỏi đụng nhau). Null nếu SĐT sai hoặc thiếu pepper. */
export function hashPhone(rawPhone: string): string | null {
  const pepper = cccdPepper();
  if (!pepper) return null;
  if (!isValidVnPhone(rawPhone)) return null;
  const phone = normalizeVnPhone(rawPhone);
  return createHash("sha256").update(`${pepper}:phone:${phone}`).digest("hex");
}

/** Cột định danh (thô + hash) cho INSERT crew_reports từ CCCD và/hoặc SĐT.
 *  Bắt buộc ÍT NHẤT một định danh hợp lệ; định danh nào sai → mã lỗi rõ. Dùng
 *  chung cho báo cáo của chủ tàu lẫn staff tự thêm. */
export type SubjectIdentityFields = {
  subject_cccd: string | null;
  subject_cccd_hash: string | null;
  subject_phone: string | null;
  subject_phone_hash: string | null;
};

export function subjectIdentity(
  cccd?: string | null,
  phone?: string | null,
):
  | { ok: true; fields: SubjectIdentityFields }
  | { ok: false; code: string } {
  const fields: SubjectIdentityFields = {
    subject_cccd: null,
    subject_cccd_hash: null,
    subject_phone: null,
    subject_phone_hash: null,
  };
  if (cccd) {
    if (!isValidCccd(cccd)) return { ok: false, code: "bad_cccd" };
    const h = hashCccd(cccd);
    if (!h) return { ok: false, code: "cccd_pepper_missing" };
    fields.subject_cccd = normalizeCccd(cccd);
    fields.subject_cccd_hash = h;
  }
  if (phone) {
    if (!isValidVnPhone(phone)) return { ok: false, code: "bad_phone" };
    const h = hashPhone(phone);
    if (!h) return { ok: false, code: "cccd_pepper_missing" };
    fields.subject_phone = normalizeVnPhone(phone);
    fields.subject_phone_hash = h;
  }
  if (!fields.subject_cccd_hash && !fields.subject_phone_hash)
    return { ok: false, code: "bad_input" };
  return { ok: true, fields };
}
