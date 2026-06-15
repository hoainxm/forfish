// NHẮC MỐC NGHĨA VỤ KHAI BÁO (B2, roadmap 01-product §7 / 06-jtbd nhóm E) —
// ForFish CHỈ NHẮC mốc theo cỡ tàu, KHÔNG khai hộ, KHÔNG tích hợp hệ thống
// nhà nước (khai báo eCDT/NKKT thuộc hệ thống nhà nước / sản phẩm NKKT riêng —
// quyết định phạm vi 2026-06-10). Mốc lấy từ TT 81/2025 (06-jtbd §4).

export interface ComplianceMilestone {
  id: string;
  label: string;
  /** ISO yyyy-mm-dd mốc hiệu lực */
  effectiveDate: string;
  /** đã hiệu lực với cỡ tàu này hay còn sắp tới */
  status: "active" | "upcoming";
  /** số ngày tới mốc; âm = đã qua */
  daysUntil: number;
  note: string;
}

function daysBetween(isoDate: string, today: Date): number {
  const target = new Date(isoDate + "T00:00:00Z");
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target.getTime() - base) / 86_400_000);
}

/** Mốc NKKT điện tử bắt buộc theo chiều dài (TT 81/2025). null = chưa bắt buộc. */
function nkktDate(lengthM: number): string | null {
  if (lengthM >= 24) return "2026-07-01";
  if (lengthM >= 15) return "2026-09-01";
  if (lengthM >= 12) return "2027-01-01";
  return null; // <12m chưa bắt buộc nhật ký điện tử
}

export function complianceMilestones(
  lengthM: number,
  today: Date,
): ComplianceMilestone[] {
  const out: ComplianceMilestone[] = [];

  // eCDT — khai báo ra/vào cảng, áp dụng MỌI tàu (hiệu lực 01/3/2026)
  const ecdtDays = daysBetween("2026-03-01", today);
  out.push({
    id: "ecdt",
    label: "Khai báo ra/vào cảng điện tử (eCDT)",
    effectiveDate: "2026-03-01",
    status: ecdtDays <= 0 ? "active" : "upcoming",
    daysUntil: ecdtDays,
    note: "Khai trước khi rời/cập cảng. App chỉ nhắc — khai trên hệ thống nhà nước.",
  });

  // NKKT điện tử theo cỡ tàu
  const nkkt = nkktDate(lengthM);
  if (nkkt) {
    const d = daysBetween(nkkt, today);
    out.push({
      id: "nkkt",
      label: "Nhật ký khai thác điện tử (NKKT)",
      effectiveDate: nkkt,
      status: d <= 0 ? "active" : "upcoming",
      daysUntil: d,
      note: "Ghi nhật ký từng mẻ. Khai trên hệ thống nhà nước / sản phẩm NKKT.",
    });
  }

  return out;
}
