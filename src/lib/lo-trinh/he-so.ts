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
  chang?: Partial<Record<Nghe, { aGio?: number; vKn?: number; p80HeSo?: number }>>;
  /** giờ máy chạy (≥ 1,5 kn, ngoài pha chạy) mỗi NGÀY ở bãi — trung vị đội tàu cùng nghề (research §10.5) */
  gioMayBai?: Partial<Record<Nghe, number>>;
  /** hệ số loại đáy theo nghề (day-nghe.ts) — độ ưa đo từ vết ÷ nước sâu, kẹp ≤ 1 */
  dayNghe?: Partial<Record<Nghe, Partial<Record<"ran" | "n2" | "n4" | "n12" | "sau" | "gan", number>>>>;
  /** "i,j" ô cá 0,25° → tỉ phần [ran, n2, n4, n12, sau, gan]; vắng = toàn nước sâu */
  dayO?: Record<string, number[]>;
  /** giờ ra cảng hay gặp nhất theo nghề (giờ VN) — mặc định ô "Giờ đi" (đo lượt ra cảng thật 08–10/2026) */
  gioDiThuong?: Partial<Record<Nghe, number>>;
  /** cửa phụ thuộc con nước đo từ lượt ra/vào thật: [lat, lon, id trạm, ngưỡng m (số 0 trạm), tỉ phần lượt lúc nước thấp, số lượt] */
  cuaCang?: [number, number, string, number, number, number][];
  /** DẦU TRUNG BÌNH theo nghề (09/11, anh Long "bỏ cái lít dầu đi, lấy trung bình"): lít mỗi giờ máy chạy + lít dầu máy
   *  phát chong đèn mỗi đêm (chỉ nghề đèn). Nguồn + cách tính ở `_ghi` của lo-trinh-params.json. */
  dauTrungBinh?: Partial<Record<Nghe, { litGio?: number; litDem?: number }>>;
}

/** Dầu trung bình của nghề. Thiếu/hỏng từng số ⇒ null (chỗ gọi lùi số mặc định / không cộng dầu đèn). */
export function dauTrungBinh(nghe: Nghe, p: ModelParams | null = getModelParams()): { litGio: number | null; litDem: number | null } {
  const d = loTrinhParams(p).dauTrungBinh?.[nghe];
  const so = (v: unknown, tran: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= tran ? v : null);
  return { litGio: so(d?.litGio, 500), litDem: so(d?.litDem, 2000) };
}

/** Giờ máy chạy mỗi ngày ở bãi của nghề (dầu lúc đánh). null = chưa nạp tham số ⇒ chỗ gọi nói "chưa tính". */
export function gioMayBai(nghe: Nghe, p: ModelParams | null = getModelParams()): number | null {
  const v = loTrinhParams(p).gioMayBai?.[nghe];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 24 ? v : null;
}

/**
 * HỆ SỐ BÃI (2026-11-08, anh Long: "mỗi nghề … dẫn tới bãi đánh riêng"): điểm cá nhân với mức tàu CÙNG NGHỀ đánh
 * ở ô đó mùa này (lớp mật độ tàu, `/api/fleet-density`, điểm nền 0–100 so với chỗ đông nhất quanh đó).
 * Ô tàu cùng nghề không đánh (dưới ngưỡng/không có) vẫn giữ SAN_BAI điểm cá — cá có thể mới tới, nhưng nghề
 * đó thường không làm được ở đó (đáy không kéo được, quá sâu cho rê…), nên kéo xuống mạnh.
 * nợ: SAN_BAI 0,25 là số chọn, chưa fit; nâng khi backtest được "ô có tàu cùng nghề" vs sản lượng chuyến.
 */
export const SAN_BAI = 0.25;
export function heSoBai(x: number | null): number {
  if (x == null || !Number.isFinite(x)) return 1;
  return SAN_BAI + (1 - SAN_BAI) * Math.max(0, Math.min(1, x));
}

/** Mô hình giờ một chặng: giờ = aGio + hải lý / vKn (P50); P80 = P50 × p80HeSo. */
export interface MoHinhChang {
  aGio: number;
  vKn: number;
  p80HeSo: number;
  /** true = số đo đội tàu cùng nghề (model-params); false = mặc định dè dặt (chưa nạp tham số) */
  doDuoc: boolean;
}

/**
 * MẶC ĐỊNH DÈ DẶT khi máy chưa nạp tham số (docs/research/vet-tau-pha-nghe-2026-11.md §7 B0): 5 kn + 1,5 giờ/chặng,
 * P80 ×1,15. CỐ Ý không quay về 7 kn — số đo cho thấy 7 kn ước thiếu ~3 giờ mỗi chặng, sai về phía nguy hiểm
 * (giờ về, dầu đều lạc quan). Số tròn chọn dè dặt, không phải số fit.
 */
export const CHANG_DE_DAT: MoHinhChang = { aGio: 1.5, vKn: 5, p80HeSo: 1.15, doDuoc: false };

/** Mô hình chặng của nghề — số đo qua model-params; thiếu/hỏng ⇒ CHANG_DE_DAT. */
export function moHinhChang(nghe: Nghe, p: ModelParams | null = getModelParams()): MoHinhChang {
  const c = loTrinhParams(p).chang?.[nghe];
  const ok = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  if (!c || !ok(c.aGio, 0, 6) || !ok(c.vKn, 2, 15) || !ok(c.p80HeSo, 1, 2)) return CHANG_DE_DAT;
  return { aGio: c.aGio, vKn: c.vKn, p80HeSo: c.p80HeSo, doDuoc: true };
}

/**
 * Giờ một chặng `km` (P50). Tốc độ bà con khai là TRẦN, không thay số đo (§7 B0): v = min(khai, đo). Chặng 0 km ⇒ 0.
 */
export function gioChang(km: number, m: MoHinhChang, tocDoKhaiKn?: number | null): number {
  if (!(km > 0)) return 0;
  const v = tocDoKhaiKn != null && Number.isFinite(tocDoKhaiKn) && tocDoKhaiKn > 0 ? Math.min(tocDoKhaiKn, m.vKn) : m.vKn;
  return m.aGio + km / 1.852 / v;
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

/** Nghề đã có SỐ ĐO trăng (kể cả 0 = đo rồi, không thấy hiệu ứng — cào đơn 09/11) hay chưa nạp/chưa đo. */
export function daDoTrang(nghe: Nghe, p: ModelParams | null = getModelParams()): boolean {
  const v = loTrinhParams(p).hieuUngRam?.[nghe];
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1;
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
