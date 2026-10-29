// NHẮC MỐC NGHĨA VỤ KHAI BÁO (B2, roadmap 01-product §7 / 06-jtbd nhóm E) —
// ForFish CHỈ NHẮC mốc theo cỡ tàu, KHÔNG khai hộ, KHÔNG tích hợp hệ thống
// nhà nước (khai báo eCDT/NKKT thuộc hệ thống nhà nước / sản phẩm NKKT riêng —
// quyết định phạm vi 2026-06-10). Mốc lấy từ TT 81/2025 (06-jtbd §4).

import { daysUntil } from "@/lib/days";
import { formatVnDate } from "@/lib/format";

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
  const ecdtDays = daysUntil("2026-03-01", today);
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
    const d = daysUntil(nkkt, today);
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

/** Nhóm cỡ tàu theo đúng ngưỡng của `nkktDate` — chữ đời thường cho dòng nhắc. */
function nhomCo(lengthM: number): string {
  if (lengthM >= 24) return "Tàu từ 24 m";
  if (lengthM >= 15) return "Tàu 15–24 m";
  if (lengthM >= 12) return "Tàu 12–15 m";
  return "Tàu dưới 12 m";
}

/**
 * MỘT DÒNG MỐC NGHĨA VỤ cho Tủ giấy tờ (2026-10-29, F-brd P1-2: checklist xuất bến đã gỡ nên
 * mốc NKKT/eCDT không còn hiện ở đâu). Lấy mốc GẦN NHẤT theo cỡ tàu đang chọn:
 *  · còn mốc sắp tới ⇒ mốc đó + số ngày còn lại;
 *  · không còn ⇒ mốc nặng nhất đã hiệu lực (NKKT nếu cỡ tàu phải ghi, không thì eCDT).
 * Chưa biết chiều dài (thiếu/0/lạ) ⇒ null — không đoán cỡ tàu, không nói sai mốc.
 * App CHỈ NHẮC — khai trên hệ thống nhà nước (01 §7).
 */
export function dongMocNghiaVu(lengthM: number | null | undefined, today: Date): string | null {
  if (typeof lengthM !== "number" || !Number.isFinite(lengthM) || lengthM <= 0) return null;
  const ms = complianceMilestones(lengthM, today);
  const co = nhomCo(lengthM);
  const sapToi = ms.filter((m) => m.status === "upcoming").sort((a, b) => a.daysUntil - b.daysUntil)[0];
  if (sapToi) {
    const viec = sapToi.id === "nkkt" ? "phải ghi nhật ký khai thác điện tử" : "phải khai ra/vào cảng điện tử (eCDT)";
    return `${co}: từ ${formatVnDate(sapToi.effectiveDate)} ${viec} — còn ${sapToi.daysUntil} ngày.`;
  }
  const nkkt = ms.find((m) => m.id === "nkkt");
  if (nkkt) return `${co}: đã phải ghi nhật ký khai thác điện tử từ ${formatVnDate(nkkt.effectiveDate)}.`;
  const ecdt = ms.find((m) => m.id === "ecdt");
  return ecdt
    ? `${co}: phải khai ra/vào cảng điện tử (eCDT) từ ${formatVnDate(ecdt.effectiveDate)}; chưa bắt buộc nhật ký điện tử.`
    : null;
}
