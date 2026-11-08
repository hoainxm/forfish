// HỆ SỐ NGÀY CHO LỘ TRÌNH — TRĂNG × SÓNG GIÓ (2026-11-08, anh Long: "tính chuyến phải tính lịch trăng sóng
// gió, các yếu tố dữ liệu phải đưa ra, xác định tỷ trọng").
//
// Giá trị một ngày đánh ở một vùng = ĐIỂM CÁ (theo nghề) × HỆ SỐ TRĂNG (theo nghề) × HỆ SỐ BIỂN (sóng gió).
// Phép NHÂN chứ không cộng có trọng số: biển động mạnh phải kéo cả ngày về 0 dù cá dày tới đâu — cộng thì
// cá 100 + biển 0 vẫn ra "khá", tức đẩy tàu vào chỗ không thả được câu.
//
// TỶ TRỌNG — đều có nguồn, không đặt tay:
//  · Trăng: % sản lượng đêm rằm so đêm không trăng, đo trên sổ tàu. SỐ ĐO ở `src/data/lo-trinh-params.json`,
//    đi xuống máy qua `model-params` (SDF2, cất offline) — KHÔNG viết cứng ở đây (khong-lo-nguon nợ #9).
//    Chưa nạp tham số ⇒ hệ số trăng = 1 (trung tính, không bịa).
//    nợ: số một năm, CI câu ngừ chứa 0; nâng khi chạy lại bước 15 trên năm nhãn 2027.
//  · Sóng gió: cùng thang "Điểm đi biển" của cả app (`scoreDay` lib/sea.ts) — một thước cho Bản đồ, Trang
//    chủ và lộ trình. Biển êm (≥75) giữ nguyên; động nhẹ (50–75) trừ dần tới 40 %; động mạnh (<50) trừ
//    tiếp, ≤25 coi như không đánh được ngày đó.
// THUẦN, chạy không cần mạng.

import { scoreDay } from "@/lib/sea";
import { getModelParams, type ModelParams } from "@/lib/model-params";
import type { Nghe } from "./types";

/** Khối `loTrinh` trong model-params (scripts/build-model-params.mjs). Thiếu/hỏng ⇒ {}. */
export interface LoTrinhParams {
  hieuUngRam?: Partial<Record<Nghe, number>>;
  loaiTheoNghe?: Partial<Record<Nghe, readonly string[]>>;
}
export function loTrinhParams(p: ModelParams | null = getModelParams()): LoTrinhParams {
  const x = p?.loTrinh;
  return x && typeof x === "object" ? (x as LoTrinhParams) : {};
}

/** Đêm rằm so đêm tối (tỉ lệ đổi sản lượng) của nghề — từ model-params; chưa nạp ⇒ 0 (trăng không đổi gì). */
export function hieuUngRam(nghe: Nghe, p: ModelParams | null = getModelParams()): number {
  const v = loTrinhParams(p).hieuUngRam?.[nghe];
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1 ? v : 0;
}

const SYNODIC_DAYS = 29.530588853;
const REF_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);

/** Phần mặt trăng được chiếu sáng (0 = trăng non, 1 = rằm) tại mốc `ms` — cùng mốc với lib/moon.ts. */
export function doRoiTrang(ms: number): number {
  const days = (ms - REF_NEW_MOON_UTC) / 86_400_000;
  const frac = (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;
  return (1 - Math.cos(2 * Math.PI * frac)) / 2;
}

export function heSoTrang(nghe: Nghe, doRoi: number): number {
  const r = Math.max(0, Math.min(1, doRoi));
  return 1 + hieuUngRam(nghe) * r;
}

/** Ngưỡng thang Điểm đi biển (lib/sea.ts levelOf): ≥75 êm, ≥50 động nhẹ. */
const DIEM_EM = 75;
const DIEM_DONG_NHE = 50;
/** Điểm đi biển ≤ ngần này ⇒ ngày đó không đánh được (hệ số 0). */
export const DIEM_BO_NGAY = 25;

/**
 * Hệ số biển từ sóng cao nhất ngày (m) + gió mạnh nhất ngày (km/h). null = thiếu cả hai (chỗ gọi coi như 1
 * và PHẢI nói "chưa có dự báo"). Lưới đủ vùng không có mưa/dông/gió giật ⇒ chấm bằng sóng + gió.
 */
export function heSoBien(songM: number | null, gioKmh: number | null): { heSo: number; diem: number } | null {
  if (songM == null && gioKmh == null) return null;
  const diem = scoreDay({
    date: "",
    waveMaxM: Math.max(0, songM ?? 0),
    windMaxKmh: Math.max(0, gioKmh ?? 0),
    gustMaxKmh: 0,
    precipMm: 0,
  });
  let heSo: number;
  if (diem >= DIEM_EM) heSo = 1;
  else if (diem >= DIEM_DONG_NHE) heSo = 0.6 + (0.4 * (diem - DIEM_DONG_NHE)) / (DIEM_EM - DIEM_DONG_NHE);
  else if (diem > DIEM_BO_NGAY) heSo = (0.6 * (diem - DIEM_BO_NGAY)) / (DIEM_DONG_NHE - DIEM_BO_NGAY);
  else heSo = 0;
  return { heSo, diem };
}
