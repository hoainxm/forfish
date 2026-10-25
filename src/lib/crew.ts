// Thuyền viên — domain logic. Theo nghiên cứu docs/research/02-lao-dong-tren-tau.md:
// · chứng chỉ thuyền trưởng/máy trưởng hạng I/II/III theo cỡ tàu (TT 22/2018),
//   sai hạng phạt 5–10 triệu; không bảo hiểm phạt 15–20 triệu/thuyền viên
// · CCCD là ĐỊNH DANH thuyền viên toàn hệ thống — nền cho cảnh báo chéo giữa
//   các chủ tàu (xem lib/crew-report.ts + /api/crew-reports).
//
// 2026-07-27: BỎ phần tiền khỏi hồ sơ thuyền viên (ăn chia/số phần + sổ ứng) —
// màn Bạn thuyền chỉ còn ĐỊNH DANH + GIẤY TỜ + CẢNH BÁO, không dính tiền
// (chốt với chủ dự án). Máy chia tiền chuyến cũng gỡ khỏi app cùng đợt.

import { SOON_DAYS_DOCS, daysUntil } from "@/lib/days";

export type CrewRole = "thuyen_truong" | "may_truong" | "thuyen_vien";

export const ROLE_LABELS: Record<CrewRole, string> = {
  thuyen_truong: "Thuyền trưởng",
  may_truong: "Máy trưởng",
  thuyen_vien: "Bạn thuyền",
};

export interface CrewMember {
  id: string;
  name: string;
  /** CCCD 12 số — ĐỊNH DANH toàn hệ thống (bắt buộc cho mọi vai từ 2026-07-27).
   *  Người cũ trong sổ có thể còn rỗng → nhắc bổ sung, không mất dữ liệu. */
  cccd: string;
  role: CrewRole;
  phone?: string;
  hasInsurance: boolean;
  insuranceExpiry?: string; // ISO
  /** văn bằng/chứng chỉ (chỉ thuyền trưởng/máy trưởng cần) */
  certLabel?: string; // vd "Thuyền trưởng hạng II"
  certExpiry?: string; // ISO
  note?: string;
}

// ── CCCD (định danh) ───────────────────────────────────────────────────────

/** Bỏ mọi ký tự không phải số — chấp nhận người dùng gõ có dấu cách/gạch. */
export function normalizeCccd(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/** CCCD hợp lệ = đúng 12 chữ số (căn cước công dân gắn chip). */
export function isValidCccd(raw: string): boolean {
  return /^\d{12}$/.test(normalizeCccd(raw));
}

/** Hiện CCCD dạng nhóm 4-4-4 cho dễ đọc; không hợp lệ thì trả nguyên. */
export function formatCccd(raw: string): string {
  const n = normalizeCccd(raw);
  if (n.length !== 12) return raw;
  return `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8, 12)}`;
}

/** neutral = CHƯA GHI (hạn bảo hiểm, hoặc chưa ghi bảo hiểm) — thiếu dữ liệu, không phải vi phạm; không dám nói "ổn" (T2, 2026-08-18) */
export type CrewIssueLevel = "danger" | "warn" | "neutral" | "ok";

export interface CrewIssue {
  level: CrewIssueLevel;
  label: string;
  /** số ngày (có dấu) tới hạn gần nhất — để dải khẩn xếp theo ngày THẬT (S3);
   *  neutral/ok = null */
  days: number | null;
}

/**
 * Vấn đề cần để ý nhất của một thuyền viên, ưu tiên (QUYET-DINH H, TAU-09, 2026-10-25):
 * giấy tờ quá hạn (kể cả HÔM NAY) > sắp hết hạn (≤30 ngày) > chưa ghi hạn bảo hiểm > chưa ghi bảo hiểm > ổn.
 * "Chưa ghi bảo hiểm" là XÁM trung tính: `hasInsurance=false` mặc định không phân biệt "không có" với
 * "chưa ghi" ⇒ là thiếu dữ liệu, không phải vi phạm — đỏ chỉ dành cho quá hạn (màu đỏ mất giá nếu
 * người vừa thêm đã đỏ 3 chỗ). Ngày tính theo lịch VN qua lib/days.ts (không UTC).
 */
export function crewIssue(m: CrewMember, today: Date): CrewIssue {
  const expiries: { what: string; date: string }[] = [];
  if (m.hasInsurance && m.insuranceExpiry)
    expiries.push({ what: "Bảo hiểm", date: m.insuranceExpiry });
  if (m.certExpiry)
    expiries.push({ what: m.certLabel || "Chứng chỉ", date: m.certExpiry });

  let worst: { what: string; days: number } | null = null;
  for (const e of expiries) {
    const d = daysUntil(e.date, today);
    if (worst === null || d < worst.days) worst = { what: e.what, days: d };
  }
  if (worst) {
    if (worst.days < 0)
      return {
        level: "danger",
        label: `${worst.what} quá hạn ${Math.abs(worst.days)} ngày`,
        days: worst.days,
      };
    if (worst.days === 0)
      return {
        level: "danger",
        label: `${worst.what} hết hạn hôm nay`,
        days: 0,
      };
    if (worst.days <= SOON_DAYS_DOCS)
      return {
        level: "warn",
        label: `${worst.what} còn ${worst.days} ngày`,
        days: worst.days,
      };
  }
  if (!m.hasInsurance) {
    return { level: "neutral", label: "Chưa ghi bảo hiểm", days: null };
  }
  // Có bảo hiểm mà không ghi ngày hết hạn: KHÔNG được xanh "Giấy tờ ổn" — app
  // không biết còn hạn hay không, phải nói là chưa ghi (T2, 2026-08-18).
  if (!m.insuranceExpiry) {
    return { level: "neutral", label: "Chưa ghi hạn bảo hiểm", days: null };
  }
  return { level: "ok", label: "Giấy tờ ổn", days: null };
}

/**
 * Đếm đầu màn Bạn thuyền (TAU-09): `quaHan` = người có giấy QUÁ HẠN/hết hạn hôm nay (đỏ "N kẹt giấy tờ");
 * `sapHet` = người chỉ SẮP hết hạn ≤30 ngày (vàng "N sắp hết hạn"). Chưa ghi bảo hiểm KHÔNG đếm,
 * không lên dải khẩn.
 */
export function demKet(list: CrewMember[], today: Date): { quaHan: number; sapHet: number } {
  let quaHan = 0;
  let sapHet = 0;
  for (const m of list) {
    const lv = crewIssue(m, today).level;
    if (lv === "danger") quaHan += 1;
    else if (lv === "warn") sapHet += 1;
  }
  return { quaHan, sapHet };
}
