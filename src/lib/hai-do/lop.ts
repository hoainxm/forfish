/*
  CHẾ ĐỘ HẢI ĐỒ — ĐỢT 3 (2026-11-04): khay Lớp + tô nông + tự đổi màu theo mặt trời
  + báo va chạm AIS. Thuần, có test.

  Đối chiếu: OpenCPN Display Category (Base · Standard · All), Shallow/Safety/Deep +
  "two shades"; iSailor ChartOptions All/Custom/Simplified, Daylight/Dusk/Night,
  CPA/TCPA alarm. Chỉ chức năng — màu, ngưỡng tự đặt.
*/

import { DEPTH_BANDS } from "@/lib/ocean-map";
import type { BangMau } from "@/lib/hai-do/bang-mau";
import type { MucTieu } from "@/lib/ais-cpa";

/* ── MỨC HIỂN THỊ ─────────────────────────────────────────────────────────── */

export type MucHienThi = "co-ban" | "chuan" | "du";
export const MUC_HIEN_THI: readonly MucHienThi[] = ["co-ban", "chuan", "du"];
export const NHAN_MUC: Record<MucHienThi, string> = { "co-ban": "Cơ bản", chuan: "Chuẩn", du: "Đủ" };

export interface NhomLop {
  /** phao, tiêu, báo hiệu Cục Hàng hải */
  baoHieu: boolean;
  /** tuyến, luồng, phân luồng */
  luong: boolean;
  /** cáp ngầm, ống dẫn, giàn khoan, vùng cấm */
  camCap: boolean;
}

/**
 * Cơ bản = bờ, đảo, đẳng sâu, đường an toàn, đèn biển, xác tàu (thứ PHẢI thấy để
 * không mắc cạn, đâm vật). Chuẩn = + báo hiệu. Đủ = + luồng, cáp, ống, giàn, vùng cấm.
 * Xác tàu + đèn biển + đường an toàn KHÔNG tắt được ở mức nào (an toàn).
 */
export function nhomTheoMuc(m: MucHienThi): NhomLop {
  return { baoHieu: m !== "co-ban", luong: m === "du", camCap: m === "du" };
}

/* ── TÔ NÔNG THEO ĐƯỜNG AN TOÀN (hai sắc kiểu OpenCPN) ─────────────────────── */

/** Màu nước NÔNG hơn đường an toàn — lam rõ hơn nền, nét đẳng sâu vẫn ≥ 3:1 (test). */
export const MAU_NONG = "#c4dceb";

/**
 * Màu từng dải độ sâu khi tô nông: dải nào có ĐÁY (toM) ≤ đường an toàn ⇒ MAU_NONG,
 * còn lại giữ màu gốc. Trả map id lớp style → màu (sea-bg là dải 0–10).
 */
export function mauDaiToNong(anToanM: number): Record<string, string> {
  // lớp style của buildMapStyle: sea-bg (0–10), isobath-du-nuoc (≥10 → tới 20), isobath-dai-2 (≥20), isobath-dai-3 (≥50)
  const ids = ["sea-bg", "isobath-du-nuoc", "isobath-dai-2", "isobath-dai-3"];
  const out: Record<string, string> = {};
  DEPTH_BANDS.forEach((b, k) => {
    const day = k === 0 ? 0 : DEPTH_BANDS[k - 1].toM; // mức nông nhất của dải
    out[ids[k]] = day < anToanM ? MAU_NONG : b.color;
  });
  return out;
}

/* ── TỰ ĐỔI MÀU THEO MẶT TRỜI ─────────────────────────────────────────────── */

/** Độ cao mặt trời (độ) tại vị trí + thời điểm — công thức NOAA rút gọn, sai số < 1°. */
export function doCaoMatTroi(lat: number, lon: number, ms: number): number {
  const d = ms / 86400000 + 2440587.5 - 2451545.0; // ngày từ J2000
  const g = ((357.529 + 0.98560028 * d) % 360) * (Math.PI / 180);
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);
  const e = (23.439 - 0.00000036 * d) * (Math.PI / 180);
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * Math.PI) / 180 - ra;
  const phi = (lat * Math.PI) / 180;
  return (Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha)) * 180) / Math.PI;
}

/** Ngày khi mặt trời > 6°, chiều (hoàng hôn dân sự) −6…6°, đêm < −6°. */
export function bangTheoTroi(doCao: number): BangMau {
  return doCao > 6 ? "ngay" : doCao >= -6 ? "chieu" : "dem";
}

/* ── BÁO VA CHẠM AIS ──────────────────────────────────────────────────────── */

/** Ngưỡng báo: gần nhất < 0,5 hải lý trong vòng 12 phút tới (iSailor/OpenCPN chỉnh được; đây mặc định). */
export const CPA_NM = 0.5;
export const TCPA_PHUT = 12;

/** Câu báo cho tàu NGUY nhất (null = không có). `hl` = hàm in hải lý theo đơn vị bà con chọn. */
export function cauCpa(ds: readonly MucTieu[], hl: (nm: number) => string): string | null {
  const nguy = ds
    .filter((m) => !m.tinCu && m.cpaNm != null && m.tcpaPhut != null && m.tcpaPhut >= 0 && m.cpaNm < CPA_NM && m.tcpaPhut <= TCPA_PHUT)
    .sort((a, b) => (a.tcpaPhut ?? 0) - (b.tcpaPhut ?? 0))[0];
  if (!nguy) return null;
  const ten = nguy.tau.ten ? `Tàu ${nguy.tau.ten}` : "Một tàu";
  return `${ten} sẽ cách ${hl(nguy.cpaNm!)} sau ${Math.max(1, Math.round(nguy.tcpaPhut!))} phút`;
}
