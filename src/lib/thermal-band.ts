// src/lib/thermal-band.ts
// ─────────────────────────────────────────────────────────────────────────────
// DẢI NHIỆT LAI — cao nguyên [b,c] co/giãn theo KHÍ HẬU SST của vùng–tháng,
// biên chịu đựng [a,d] của hồ sơ loài GIỮ NGUYÊN.
//
// VÌ SAO (rà 40 loài 2026-10-03, report-algorithm.md B6/C3): lớp lỗi lớn nhất
// là "dải nhiệt sinh học cố định" có trần c THẤP HƠN nước VN mùa hè (29 °C khi
// ven bờ đang 29,75–30,4) hoặc sàn b CAO HƠN nước vụ đông VBB ⇒ loài TẮT đúng
// vụ (ngừ ồ, bạc má, ngừ chấm, mực ống…). Đợt 1 đã sửa tay ~25 dải — vẫn là
// sửa tay, lần sau nước đổi lại sai. Chữa gốc: lấy phân vị SST nhiều năm của
// chính vùng–tháng (p25, p75) làm cao nguyên khi nó RỘNG hơn cao nguyên hồ sơ.
//
// CÔNG THỨC (chỉ NỚI, không bao giờ CO):
//   b' = min(b, max(a + δ, p25))      c' = max(c, min(d − δ, p75))      δ = 0,5 °C
// · Chỉ nới: nếu co theo khí hậu thì "mất bảng khí hậu" làm điểm TĂNG — vi phạm
//   bất biến "mất nguồn không tăng điểm" (test khoá). Nới-thôi ⇒ có khí hậu ≥
//   không có, mất khí hậu rơi về hành vi cũ.
// · Không vượt [a+δ, d−δ]: biên chịu đựng sinh học là chốt cuối; giữ δ để hai
//   mép còn dốc (vẫn phân biệt ô nóng/mát hơn phần đông nước vùng).
// · Dùng p25/p75 chứ không p10/p90: mục tiêu là PHẦN LỚN ô trong vùng/tháng
//   đang vụ không bị phạt nhiệt oan, nhưng ¼ ô nóng nhất và ¼ ô mát nhất vẫn
//   phân hoá — nếu lấy p10/p90 thì 80% ô = 1, cổng nhiệt mất sức phân biệt
//   (đúng khuôn lỗi "dải khai rộng hơn phân bố" ở chlFit/thermoFit).
// · CHỈ áp khi cổng nhiệt đang chấm SST MẶT. Loài đáy đang chấm nhiệt ĐÁY HYCOM
//   thì khí hậu mặt không liên quan — caller tự quyết (fish-predict.ts).
//
// NGUỒN BẢNG: src/data/sst-climatology.v1.json — scripts/collect-sst-climatology.mjs
// (CoralTemp 2021–2025, gộp theo FISH_REGIONS). Thiếu vùng/tháng ⇒ dải hồ sơ.
// ─────────────────────────────────────────────────────────────────────────────

/** Phân vị SST (°C) của một vùng–tháng, gộp nhiều năm × nhiều ngày × mọi ô biển */
export interface SstClimoCell {
  p10?: number;
  p25: number;
  p50?: number;
  p75: number;
  p90?: number;
  /** số mẫu (ô × lát) — để biết bảng gầy hay béo, không dùng để chấm */
  n: number;
}

/** regionId → tháng ("1".."12") → phân vị */
export type SstClimatology = Record<string, Record<string, SstClimoCell>>;

export type ThermalBand = [number, number, number, number];

/** Khoảng cách tối thiểu giữ lại ở mỗi mép, để dải lai còn dốc (°C) */
export const CLIMO_EDGE_MARGIN_C = 0.5;

/**
 * Dải trapezoid lai cho MỘT loài tại MỘT vùng–tháng. Thiếu bảng/vùng/tháng/số
 * không hữu hạn ⇒ trả đúng `profile` (hành vi cũ). Kết quả luôn thoả
 * a ≤ b' ≤ b, c ≤ c' ≤ d, b' ≤ c' — tức chỉ NỚI cao nguyên trong [a,d].
 */
export function seasonalThermalBand(
  profile: ThermalBand,
  regionId: string,
  month: number,
  climo: SstClimatology | null | undefined,
): ThermalBand {
  const [a, b, c, d] = profile;
  const cell = climo?.[regionId]?.[String(month)];
  if (!cell || !Number.isFinite(cell.p25) || !Number.isFinite(cell.p75)) return profile;
  const m = CLIMO_EDGE_MARGIN_C;
  const b2 = Math.min(b, Math.max(a + m, cell.p25));
  const c2 = Math.max(c, Math.min(d - m, cell.p75));
  if (b2 === b && c2 === c) return profile;
  return [a, b2, c2, d];
}
