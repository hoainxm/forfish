// Thuyền viên — domain logic. Theo nghiên cứu docs/research/02-lao-dong-tren-tau.md:
// · chứng chỉ thuyền trưởng/máy trưởng hạng I/II/III theo cỡ tàu (TT 22/2018),
//   sai hạng phạt 5–10 triệu; không bảo hiểm phạt 15–20 triệu/thuyền viên
// · CCCD là ĐỊNH DANH thuyền viên toàn hệ thống — nền cho cảnh báo chéo giữa
//   các chủ tàu (xem lib/crew-report.ts + /api/crew-reports).
//
// 2026-07-27: BỎ phần tiền khỏi hồ sơ thuyền viên (ăn chia/số phần + sổ ứng) —
// màn Bạn thuyền chỉ còn ĐỊNH DANH + GIẤY TỜ + CẢNH BÁO, không dính tiền
// (chốt với chủ dự án). Máy chia tiền chuyến cũng gỡ khỏi app cùng đợt.

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

export type CrewIssueLevel = "danger" | "warn" | "ok";

export interface CrewIssue {
  level: CrewIssueLevel;
  label: string;
}

const SOON_DAYS = 30;

function daysUntil(isoDate: string, today: Date): number {
  const target = new Date(isoDate + "T00:00:00Z");
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target.getTime() - base) / 86_400_000);
}

/**
 * Vấn đề cần để ý nhất của một thuyền viên, ưu tiên:
 * không bảo hiểm > giấy tờ quá hạn > sắp hết hạn > ổn.
 */
export function crewIssue(m: CrewMember, today: Date): CrewIssue {
  if (!m.hasInsurance) {
    return { level: "danger", label: "Chưa có bảo hiểm" };
  }
  const expiries: { what: string; date: string }[] = [];
  if (m.insuranceExpiry)
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
      };
    if (worst.days <= SOON_DAYS)
      return { level: "warn", label: `${worst.what} còn ${worst.days} ngày` };
  }
  return { level: "ok", label: "Giấy tờ ổn" };
}

/** Demo seed — màn hình tự giải thích chính nó khi chưa có dữ liệu. */
export function demoCrew(today: Date): CrewMember[] {
  const d = (offsetDays: number) => {
    const t = new Date(today);
    t.setUTCDate(t.getUTCDate() + offsetDays);
    return t.toISOString().slice(0, 10);
  };
  return [
    {
      id: "demo-c1",
      name: "Nguyễn Văn Hai",
      cccd: "079090001234",
      role: "thuyen_truong",
      phone: "0901234567",
      hasInsurance: true,
      insuranceExpiry: d(120),
      certLabel: "Thuyền trưởng hạng II",
      certExpiry: d(20),
    },
    {
      id: "demo-c2",
      name: "Trần Minh Bảo",
      cccd: "079091005678",
      role: "may_truong",
      phone: "0912345678",
      hasInsurance: true,
      insuranceExpiry: d(200),
      certLabel: "Máy trưởng hạng II",
      certExpiry: d(180),
    },
    {
      id: "demo-c3",
      name: "Lê Thành Tâm",
      cccd: "079092009012",
      role: "thuyen_vien",
      hasInsurance: false,
    },
  ];
}
