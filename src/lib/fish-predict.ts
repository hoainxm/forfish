// Trục 1 — DỰ BÁO CÁ (PFZ — vùng cá tiềm năng): tính từ dữ liệu vệ tinh MỚI NHẤT
// theo đúng công thức ngành mà các app thương mại dùng:
//
//   điểm ô biển = hợp-nhiệt(loài) × ( mồi(phù du) + ranh nóng-lạnh(front) )
//   có lọc theo MÙA VỤ + VÙNG của từng loài (src/data/fish-seasons.ts)
//
// Nguồn lưới: NOAA ERDDAP (công khai, không key) — SST blended không lỗ mây
// + phù du DINEOF đã vá mây; tuỳ chọn thêm SSHA (xoáy), dị thường nhiệt CRW
// (nước trồi) và dòng chảy blended u,v (hội tụ gom mồi). Đổi nguồn chỉ sửa
// URL builder + parser ở đây.
//
// TRUNG THỰC: đây là vùng CÓ KHẢ NĂNG, tính từ ảnh trễ ~2 ngày, độ phân giải
// ~25 km — không phải lời hứa "có cá", UI phải luôn ghi rõ.

import { FISH_SEASONS, nearestRegionWithin } from "@/data/fish-seasons";
import { apiUrl } from "@/lib/api-base";

// Bán kính (độ) gán ô biển về vùng gần nhất — đủ phủ kín toàn EEZ + Hoàng Sa/
// Trường Sa, vẫn loại nước ngoài xa hẳn (Hải Nam, Philippines). PFZ tính cho
// MỌI ô biển VN, không chỉ trong các đa giác khoanh sẵn.
const REGION_REACH_DEG = 2.0;

/* ----------------------------------------------------------------------------
   Khẩu vị loài — dải nhiệt (trapezoid °C) + mồi (log10 chlorophyll mg/m³)
   + trọng số mồi/front. Tổng hợp từ tài liệu sinh học nghề cá công khai
   (FAO species catalogue, RIMF) — mức THAM KHẢO, đủ cho phân vùng 25 km.
---------------------------------------------------------------------------- */
/** Nhóm loài — cho bộ chọn loài + màu riêng từng nhóm (kiểu OceanFishMap) */
export type SpeciesCategory =
  | "pelagic-large" // cá nổi lớn xa bờ (ngừ, thu, cờ…)
  | "pelagic-small" // cá nổi nhỏ ven bờ (cơm, trích, nục…)
  | "cephalopod" // mực, bạch tuộc
  | "demersal" // cá đáy mềm (mối, đổng, phèn…)
  | "reef" // cá rạn (hồng, mú, kẽm)
  | "crustacean"; // giáp xác (tôm, ghẹ, cua, ruốc)

/**
 * Ảnh vệ tinh MẶT BIỂN dự báo được loài này tốt tới đâu — quyết định TRUNG THỰC:
 *   high   — cá nổi bám đúng front/xoáy/nước trồi mặt biển → dự báo điểm tin được
 *   medium — bán nổi / theo mùa rõ → dự báo có cơ sở nhưng vừa phải
 *   low    — loài ĐÁY/RẠN/cửa sông, ảnh mặt biển ít giúp → app lùi về MÙA VỤ + ĐỘ SÂU,
 *            KHÔNG vẽ điểm nóng giả, UI nói rõ
 */
export type SurfaceSignal = "high" | "medium" | "low";

/** Hệ số tin cậy theo tín hiệu mặt biển — kéo habitat về trung tính khi loài khó đoán */
export const SURFACE_CONF: Record<SurfaceSignal, number> = {
  high: 1,
  medium: 0.6,
  low: 0.25,
};

/* ── Hằng chấm điểm (VIỆC 3 — chốt bằng calibrate trên lưới THẬT, xem
   scripts/fish-predict-viec3-calib.mjs). Thay TRUNG BÌNH CỘNG có trọng số (nén
   phương sai, gần hết ô rơi 0.3–0.5, 40 loài ra 1 bản đồ) bằng:
     cổng nhiệt (nhân) × mồi (giới hạn mềm) × soft-OR cơ chế gom cá × cổng độ sâu
   có nền sàn. ─────────────────────────────────────────────────────────────── */
// Bộ hằng CHỐT bằng calibrate trên lưới THẬT (ERDDAP 3 ngày tháng 7 + 1 ngày
// tháng 1, +ETOPO), TRƯỚC→SAU trên "Mọi loài" (s):
//   median 42→36 (t7), 47→44 (t1) · %diện tích điểm nóng s≥50 27.5%→18.5% (t7),
//   36.4%→26.6% (t1) · chồng lấn hotspot chéo loài (Jaccard) 0.12→0.11.
//   Cá đáy mùa đông KHÔNG biến mất: cá mối/tôm bạc/ghẹ đều có ô s≥50 (716/36/32).
// Xem scripts/fish-predict-viec3-calib.mjs (chạy lại: npx tsx …).
/** Hệ số soft-OR: <1 để nhiều cơ chế VỪA-PHẢI không cộng dồn thành "sáng rực" */
const SOFTOR_SCALE = 0.4;
/** Nền sàn tổ hợp cơ chế: 0 = điểm nóng CHỈ do cơ chế gom cá thật (front/xoáy/
 *  nước trồi) quyết → co vùng nóng về ~18% (trước ~50%), trung thực hơn. Đã đo:
 *  nền >0 (thử 0.12) nâng điểm MỌI ô → vùng đỏ phình to hơn cả bản cũ (t7 30%,
 *  t1 55%), phá mục tiêu co điểm nóng → GIỮ 0. "Mọi loài" median vẫn 36 (không
 *  trống); loài đáy có nền NEUTRAL_AGG riêng nên không dính. */
const AGG_FLOOR = 0.0;
/** Tổ hợp trung tính cho loài ĐÁY/RẠN (vệ tinh không thấy) — lùi về MÙA VỤ+nhiệt+
 *  mồi. Đủ cao (0.6) để vùng hợp mùa/nhiệt của cá đáy vượt sàn hiển thị 50 (nếu
 *  không, chọn cá mối/tôm/ghẹ ra bản đồ TRỐNG); loài nổi (conf 1) KHÔNG dùng số này */
const NEUTRAL_AGG = 0.6;
/** Sàn giới hạn mồi: mồi=0 chỉ hạ điểm còn FOOD_FLOOR, KHÔNG zero hẳn (nhiễu mồi) */
const FOOD_FLOOR = 0.45;
/** Ngưỡng GIỮ ô/loài trong payload (điểm 0–100). Client lọc theo sàn hiển thị 50. */
const KEEP_MIN = 25;
/** VIỆC 2 — bán kính (độ) so nước với VÙNG BÊN CẠNH (dị thường KHÔNG GIAN).
 *  Trừ trung vị lân cận = bỏ phần đồng đều cả-bồn (mùa steric / anomaly nhiều
 *  năm sáng-tối đồng loạt), giữ lại cấu trúc nước trồi/xoáy ĐỊA PHƯƠNG. */
const SPATIAL_RADIUS_DEG = 2.5;
// CALIBRATE trên lưới THẬT (30 ngày ERDDAP, xem scripts/fish-predict-viec2-spatial.mjs):
//   p90(|dị thường không gian|): anom 0.43 °C, sla 0.092 m.
//   BẰNG CHỨNG fix có tác dụng — std KHÔNG GIAN của yếu tố (giữa các ô) TRƯỚC→SAU:
//     upwTerm 0.068→0.311 (mùa hè anomaly DƯƠNG cả bồn → upwTerm cũ ~0 KHẮP NƠI,
//       chết như tín hiệu xếp hạng; nay trải rộng → "lần đầu chỉ vào chỗ cụ thể").
//     coldStr 0.304→0.293 (sla mùa cả-bồn YẾU trong cửa sổ này, std giữa-ngày
//       0.011 m < 0.02 → SSHA thô đã mang cấu trúc cục bộ; dị thường không gian
//       vô hại, đúng nguyên tắc, sẽ có ích ở mùa sla nền mạnh).
//   %diện tích điểm nóng (s≥50) CŨ→MỚI: 14.9%→16.6% (Δ+1.7, KHÔNG phình).
/** Chuẩn hoá dị thường KHÔNG GIAN của anomaly nhiệt (°C) → upwTerm 0..1. Trên
 *  p90=0.43 một chút để giữ %điểm nóng không phình (Δ≤2) mà upwTerm vẫn trải rộng. */
const UPW_SCALE = 0.55;
/** Chuẩn hoá dị thường KHÔNG GIAN của SSHA (m) → coldStrength 0..1. ≈ p90=0.092. */
const COLD_SCALE = 0.09;

export interface SpeciesProfile {
  /** khớp đúng chuỗi `species` trong FISH_SEASONS */
  species: string;
  /** tên ngắn in lên ô bản đồ / chip chọn loài */
  short: string;
  /** nhóm loài — màu + sắp xếp */
  category: SpeciesCategory;
  /** ảnh vệ tinh đoán được tới đâu (trung thực) */
  surfaceSignal: SurfaceSignal;
  /** màu riêng của loài trên bản đồ (NỘI DUNG dữ liệu bản đồ, không phải token UI) */
  color: string;
  /** tầng nước/độ sâu — hiện cho bà con khi chạm điểm */
  depthBand: string;
  /** trapezoid nhiệt: [min, optMin, optMax, max] °C */
  sst: [number, number, number, number];
  /**
   * TẦNG NHIỆT dùng để chấm cổng nhiệt `tFit`:
   *   "surface" (mặc định) — nhiệt độ MẶT (SST) — cá nổi/loài bám mặt
   *   "bottom"  — nhiệt độ ĐÁY (HYCOM) — CHỈ loài ĐÁY MỀM thềm/cửa sông (7 cá
   *               đáy mềm + 4 giáp xác; nước đáy lạnh hơn mặt → phân bố có cấu
   *               trúc, hết mảng tô đều, loại đúng khỏi nước sâu). KHÔNG dùng cho
   *               cá RẠN (hồng/mú/kẽm) — rạn nông 2–50m, cube HYCOM ~53km rìa
   *               thềm lấy nhầm nhiệt nước sâu → co footprint artifact + độ-chính-
   *               xác-giả (rạn `low`, ta không có dữ liệu định vị rạn). Dải `sst[]`
   *               khi tempSource="bottom" hiểu là dải nhiệt ĐÁY của loài.
   *   "deep"    — nhiệt tầng ~250 m (HYCOM) — cá ngừ mắt to lặn ngày.
   * FALLBACK: thiếu lưới tương ứng / ô NaN → dùng SST mặt (không regress khi
   * HYCOM fail) — hành vi hệt loài "surface".
   */
  tempSource?: "surface" | "bottom" | "deep";
  /**
   * Dải nhiệt MẶT dự phòng [min,optMin,optMax,max] °C — CHỈ dùng khi tempSource
   * là "bottom"/"deep" NHƯNG thiếu lưới tầng sâu (HYCOM fail) hoặc ô NaN. Cần khi
   * dải `sst[]` đã đặt theo nhiệt tầng sâu (vd cá ngừ mắt to 250 m ~8–15°C): nếu
   * fallback dùng luôn `sst[]` với nhiệt mặt sẽ ra tFit=0 → loài BIẾN MẤT lúc
   * HYCOM fail. Bỏ trống = fallback dùng chính `sst[]` (hợp lệ khi `sst[]` vẫn là
   * dải nhiệt mặt/ambient — như 14 loài đáy giữ nguyên dải cũ).
   */
  sstFallback?: [number, number, number, number];
  /** dải mồi ưa thích theo log10(chl): [lo, hi] (mg/m³ đã log10) */
  chlLog: [number, number];
  /**
   * trọng số từng yếu tố môi trường tụ cá (KHÔNG cần cộng đúng 1 — code tự
   * chuẩn hoá; yếu tố nào thiếu dữ liệu thì bỏ và chia lại):
   *   food · thermFront · chlFront · eddy · upw (nước trồi) · conv (hội tụ dòng)
   */
  w: {
    food: number;
    thermFront: number;
    chlFront: number;
    eddy: number;
    upw: number;
    conv: number;
    /** tầng nhiệt (độ sâu đẳng nhiệt 20°C, HYCOM) — CHỦ YẾU cho cá ngừ/cá nổi
     *  lớn & mực xà đại dương; bỏ qua/để 0 cho loài ven bờ/đáy. Mặc định 0. */
    thermo?: number;
  };
  /** true = ưa nước trồi/xoáy LẠNH (cá nổi nhỏ ăn mồi); false = ưa rìa xoáy ấm (cá nổi lớn) */
  coldCore: boolean;
  /**
   * CỔNG ĐỘ SÂU ĐÁY cho loài XA BỜ: `[a, b]` mét — nước nông < a m loại hẳn
   * (điểm ×0), ≥ b m hợp đủ (×1), dốc tuyến tính ở giữa. Chỉ đặt cho loài nổi
   * lớn/đại dương (cá ngừ, cờ, mực xà…) để chúng KHÔNG hiện sát bờ nơi nước cạn.
   * Bỏ trống = không chặn theo độ sâu (loài ven bờ/đáy thềm giữ nguyên). Cần
   * lưới độ sâu (ETOPO) truyền vào buildFishForecast mới có tác dụng.
   */
  offshore?: [number, number];
}

// Bộ khẩu vị 39 loài ngư dân VN khai thác nhiều nhất (đủ để ~90% bà con tìm
// được loài mình đánh). SST/dải mồi/đặc tính tổng hợp từ FAO Species Catalogue,
// FishBase, bản tin Viện Hải sản (RIMF) + tài liệu nghề cá công khai (2026-06-10).
// Màu mỗi loài theo họ nhóm cho dễ phân biệt: cá nổi lớn = xanh dương, cá nổi
// nhỏ = xanh lá, mực = tím, cá đáy = cam nâu, cá rạn = đỏ, giáp xác = hồng sen.
export const SPECIES_PROFILES: SpeciesProfile[] = [
  // ── CÁ NỔI LỚN xa bờ — săn ở rìa xoáy ấm + front + hội tụ dòng ───────────
  // Cá ngừ đại dương TÁCH 2 LOÀI (2026-07-25) — khác nhau chính ở TẦNG NƯỚC:
  // vây vàng bám mặt/đỉnh nêm nhiệt (ảnh mặt biển tin được, thermo nhẹ);
  // mắt to ngày lặn sâu 200–500 m gắn nêm nhiệt (ảnh mặt biển kém chỉ điểm →
  // surfaceSignal "medium", thermo NẶNG). Nguồn: Weng PSAT, Schaefer archival
  // tags, nghiên cứu tầng nhiệt cá ngừ Biển Đông (Fishes 2023), WCPFC VN.
  { species: "Cá ngừ vây vàng", short: "ngừ vây vàng", category: "pelagic-large", surfaceSignal: "high", color: "#1d4ed8", depthBand: "tầng mặt 0–100 m (lớp trộn & đỉnh nêm nhiệt), xa bờ", sst: [23.5, 26, 30, 31.5], chlLog: [-1.1, -0.1], w: { food: 0.25, thermFront: 0.3, chlFront: 0.15, eddy: 0.3, upw: 0.1, conv: 0.25, thermo: 0.2 }, coldCore: false, offshore: [50, 200] },
  // Cá ngừ mắt to: GIỮ cổng nhiệt MẶT (không dùng tempSource "deep"). VALIDATE
  // trên số HYCOM thật (scripts/fish-predict-viec4-bottom.mjs) cho thấy nhiệt tầng
  // ~250 m gần như ĐỒNG NHẤT khắp vùng (p10–p90 chỉ 12.5–13.5°C) → cổng nhiệt-sâu
  // ≈1 mọi nơi, KHÔNG tạo biến thiên không gian, lại BỎ phần ghìm của cổng mặt mùa
  // hè → %điểm nóng phình +14đ. Tín hiệu không gian thật của mắt to là ĐỘ SÂU nêm
  // nhiệt (D20) — đã có qua w.thermo. (Hạ tầng "deep"/deepTemp giữ sẵn, chưa gán.)
  { species: "Cá ngừ mắt to", short: "ngừ mắt to", category: "pelagic-large", surfaceSignal: "medium", color: "#4338ca", depthBand: "đêm tầng mặt <50 m, ngày lặn sâu 200–500 m (quanh/dưới nêm nhiệt), xa bờ", sst: [22, 25, 29, 31], chlLog: [-1.3, -0.3], w: { food: 0.15, thermFront: 0.3, chlFront: 0.1, eddy: 0.35, upw: 0.05, conv: 0.15, thermo: 0.5 }, coldCore: false, offshore: [100, 300] },
  { species: "Cá ngừ vằn", short: "ngừ vằn", category: "pelagic-large", surfaceSignal: "high", color: "#2563eb", depthBand: "tầng mặt 0–260 m", sst: [23, 25, 29.5, 31], chlLog: [-1.0, 0.0], w: { food: 0.25, thermFront: 0.3, chlFront: 0.15, eddy: 0.3, upw: 0.05, conv: 0.2, thermo: 0.2 }, coldCore: false, offshore: [50, 200] },
  { species: "Cá ngừ chù", short: "ngừ chù", category: "pelagic-large", surfaceSignal: "medium", color: "#0891b2", depthBand: "tầng mặt 0–50 m", sst: [24, 28, 31, 32], chlLog: [-1.1, -0.5], w: { food: 0.25, thermFront: 0.2, chlFront: 0.25, eddy: 0.15, upw: 0.05, conv: 0.1, thermo: 0.2 }, coldCore: false },
  { species: "Cá ngừ ồ", short: "ngừ ồ", category: "pelagic-large", surfaceSignal: "medium", color: "#0e7490", depthBand: "tầng mặt 0–200 m, ven rạn", sst: [18, 24, 28, 30], chlLog: [-0.8, 0.3], w: { food: 0.3, thermFront: 0.25, chlFront: 0.2, eddy: 0.1, upw: 0.1, conv: 0.05, thermo: 0.15 }, coldCore: false },
  { species: "Cá ngừ chấm", short: "ngừ chấm", category: "pelagic-large", surfaceSignal: "medium", color: "#0d9488", depthBand: "ven bờ 0–80 m", sst: [16, 24, 27, 31], chlLog: [-0.7, 0.4], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.05, upw: 0.15, conv: 0.1, thermo: 0.1 }, coldCore: false },
  { species: "Cá thu", short: "cá thu", category: "pelagic-large", surfaceSignal: "high", color: "#155e75", depthBand: "tầng mặt – đáy 5–170 m, ven bờ", sst: [16, 23, 29, 31], chlLog: [-0.7, 0.4], w: { food: 0.25, thermFront: 0.35, chlFront: 0.2, eddy: 0.1, upw: 0.1, conv: 0.15, thermo: 0.05 }, coldCore: false },
  { species: "Cá cờ (cá cờ buồm)", short: "cá cờ", category: "pelagic-large", surfaceSignal: "high", color: "#3b82f6", depthBand: "tầng mặt 0–200 m", sst: [20, 25, 28, 30], chlLog: [-1.4, -0.2], w: { food: 0.1, thermFront: 0.3, chlFront: 0.15, eddy: 0.3, upw: 0.05, conv: 0.1, thermo: 0.3 }, coldCore: false, offshore: [50, 200] },
  { species: "Cá nục heo", short: "nục heo", category: "pelagic-large", surfaceSignal: "high", color: "#06b6d4", depthBand: "tầng mặt 0–85 m, quanh vật nổi", sst: [21, 26, 30, 31], chlLog: [-1.2, -0.3], w: { food: 0.1, thermFront: 0.25, chlFront: 0.15, eddy: 0.25, upw: 0.05, conv: 0.2, thermo: 0.2 }, coldCore: false, offshore: [30, 120] },
  { species: "Cá ngân", short: "cá ngân", category: "pelagic-large", surfaceSignal: "medium", color: "#1e3a8a", depthBand: "tầng mặt – trung tầng 0–200 m", sst: [18, 23, 27, 30], chlLog: [-1.2, -0.3], w: { food: 0.15, thermFront: 0.35, chlFront: 0.15, eddy: 0.2, upw: 0.05, conv: 0.1, thermo: 0.15 }, coldCore: false },
  // ── CÁ NỔI NHỎ ven bờ — mê mồi dày + nước trồi lạnh ──────────────────────
  { species: "Cá nục", short: "cá nục", category: "pelagic-small", surfaceSignal: "high", color: "#22c55e", depthBand: "tầng mặt 10–80 m", sst: [22, 24, 29, 31.5], chlLog: [-0.4, 0.8], w: { food: 0.8, thermFront: 0.6, chlFront: 0.65, eddy: 0.25, upw: 0.65, conv: 0.3 }, coldCore: true },
  { species: "Cá cơm", short: "cá cơm", category: "pelagic-small", surfaceSignal: "high", color: "#16a34a", depthBand: "tầng mặt ven bờ 0–50 m", sst: [24, 26, 30.5, 32], chlLog: [-0.4, 0.8], w: { food: 0.5, thermFront: 0.12, chlFront: 0.2, eddy: 0.18, upw: 0.25, conv: 0.15 }, coldCore: true },
  { species: "Cá trích", short: "cá trích", category: "pelagic-small", surfaceSignal: "high", color: "#15803d", depthBand: "tầng mặt ven bờ 10–70 m", sst: [23, 25, 30, 31.5], chlLog: [-0.5, 0.7], w: { food: 0.45, thermFront: 0.15, chlFront: 0.2, eddy: 0.2, upw: 0.2, conv: 0.15 }, coldCore: true },
  { species: "Cá bạc má", short: "bạc má", category: "pelagic-small", surfaceSignal: "high", color: "#4d7c0f", depthBand: "tầng mặt ven bờ 20–70 m", sst: [23, 25, 28, 30], chlLog: [-0.2, 0.9], w: { food: 0.85, thermFront: 0.55, chlFront: 0.7, eddy: 0.2, upw: 0.6, conv: 0.35 }, coldCore: true },
  { species: "Cá tráo (mắt to)", short: "cá tráo", category: "pelagic-small", surfaceSignal: "high", color: "#65a30d", depthBand: "tầng nổi sát mặt 0–50 m", sst: [22, 26, 29, 31], chlLog: [-0.3, 0.8], w: { food: 0.8, thermFront: 0.5, chlFront: 0.65, eddy: 0.25, upw: 0.6, conv: 0.3 }, coldCore: true },
  { species: "Cá sòng", short: "cá sòng", category: "pelagic-small", surfaceSignal: "medium", color: "#84cc16", depthBand: "tầng mặt 20–100 m", sst: [23, 25, 29, 31], chlLog: [-0.4, 0.6], w: { food: 0.65, thermFront: 0.55, chlFront: 0.5, eddy: 0.3, upw: 0.4, conv: 0.25 }, coldCore: false },
  { species: "Cá chỉ vàng", short: "chỉ vàng", category: "pelagic-small", surfaceSignal: "high", color: "#eab308", depthBand: "ven bờ nông ≤50 m", sst: [24, 25.5, 30, 31.5], chlLog: [-0.5, 0.7], w: { food: 0.4, thermFront: 0.2, chlFront: 0.2, eddy: 0.2, upw: 0.15, conv: 0.15 }, coldCore: true },
  { species: "Cá lầm", short: "cá lầm", category: "pelagic-small", surfaceSignal: "high", color: "#059669", depthBand: "tầng mặt ven bờ 10–75 m", sst: [26, 27, 30, 32], chlLog: [-0.1, 1.0], w: { food: 0.9, thermFront: 0.35, chlFront: 0.75, eddy: 0.15, upw: 0.55, conv: 0.45 }, coldCore: false },
  { species: "Cá đối", short: "cá đối", category: "pelagic-small", surfaceSignal: "medium", color: "#10b981", depthBand: "cực nông 0–20 m, cửa sông", sst: [18, 22, 28, 30], chlLog: [-0.2, 0.8], w: { food: 0.7, thermFront: 0.3, chlFront: 0.55, eddy: 0.1, upw: 0.3, conv: 0.5 }, coldCore: false },
  { species: "Cá hố", short: "cá hố", category: "demersal", surfaceSignal: "medium", color: "#64748b", depthBand: "tầng đáy – giữa 20–100 m", sst: [22, 24, 29, 31], chlLog: [-0.6, 0.6], w: { food: 0.4, thermFront: 0.25, chlFront: 0.15, eddy: 0.2, upw: 0.15, conv: 0.15 }, coldCore: true },
  // ── MỰC & BẠCH TUỘC ─────────────────────────────────────────────────────
  { species: "Mực xà", short: "mực xà", category: "cephalopod", surfaceSignal: "high", color: "#6d28d9", depthBand: "tầng nước 10–50 m đêm, xa bờ", sst: [25, 26.5, 30, 31], chlLog: [-1.0, -0.1], w: { food: 0.25, thermFront: 0.3, chlFront: 0.15, eddy: 0.3, upw: 0.05, conv: 0.15, thermo: 0.25 }, coldCore: false, offshore: [80, 250] },
  { species: "Mực ống", short: "mực ống", category: "cephalopod", surfaceSignal: "medium", color: "#7c3aed", depthBand: "tầng mặt 10–50 m đêm (ăn đèn)", sst: [22, 24.5, 29.5, 31], chlLog: [-0.7, 0.5], w: { food: 0.35, thermFront: 0.25, chlFront: 0.15, eddy: 0.25, upw: 0.1, conv: 0.15 }, coldCore: false },
  { species: "Mực lá", short: "mực lá", category: "cephalopod", surfaceSignal: "medium", color: "#8b5cf6", depthBand: "ven bờ 0–100 m, rạn & cỏ biển", sst: [22, 24, 29, 32], chlLog: [-0.5, 0.3], w: { food: 0.4, thermFront: 0.4, chlFront: 0.3, eddy: 0.2, upw: 0.2, conv: 0.5 }, coldCore: false },
  { species: "Mực nang", short: "mực nang", category: "cephalopod", surfaceSignal: "low", color: "#a855f7", depthBand: "đáy 0–130 m, cát & cỏ biển", sst: [22, 25, 29, 31], chlLog: [-0.3, 0.5], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.1, upw: 0.2, conv: 0.3 }, coldCore: false },
  { species: "Bạch tuộc", short: "bạch tuộc", category: "cephalopod", surfaceSignal: "low", color: "#9333ea", depthBand: "đáy 0–100 m, hang & rạn", sst: [23, 26, 30, 32], chlLog: [-0.2, 0.5], w: { food: 0.4, thermFront: 0.1, chlFront: 0.1, eddy: 0.1, upw: 0.2, conv: 0.3 }, coldCore: false },
  // ── CÁ ĐÁY mềm (lưới kéo) — ảnh vệ tinh ít giúp, theo MÙA + ĐỘ SÂU ────────
  { species: "Cá mối", short: "cá mối", category: "demersal", surfaceSignal: "low", color: "#c2410c", tempSource: "bottom", depthBand: "đáy bùn cát 20–100 m", sst: [18, 23, 29, 31], chlLog: [-0.5, 1.2], w: { food: 0.25, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá đổng (cá lượng)", short: "cá đổng", category: "demersal", surfaceSignal: "low", color: "#ea580c", tempSource: "bottom", depthBand: "đáy bùn cát 50–100 m", sst: [24, 25, 29, 30], chlLog: [-0.3, 1.0], w: { food: 0.2, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá phèn", short: "cá phèn", category: "demersal", surfaceSignal: "low", color: "#d97706", tempSource: "bottom", depthBand: "đáy bùn cát 10–60 m", sst: [22, 25, 30, 32], chlLog: [-0.2, 1.2], w: { food: 0.2, thermFront: 0.1, chlFront: 0.2, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá đù (cá sủ)", short: "cá đù", category: "demersal", surfaceSignal: "medium", color: "#b45309", tempSource: "bottom", depthBand: "đáy cửa sông ven bờ 0–80 m", sst: [20, 22, 28, 30], chlLog: [0.0, 1.4], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.1, upw: 0.15, conv: 0.1 }, coldCore: false },
  { species: "Cá khoai", short: "cá khoai", category: "demersal", surfaceSignal: "low", color: "#92400e", tempSource: "bottom", depthBand: "đáy bùn cửa sông 5–50 m", sst: [24, 26, 30, 32], chlLog: [0.2, 1.4], w: { food: 0.2, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá chim", short: "cá chim", category: "demersal", surfaceSignal: "medium", color: "#a16207", tempSource: "bottom", depthBand: "đáy bùn 5–110 m", sst: [22, 24, 29, 31], chlLog: [-0.3, 0.8], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.1, upw: 0.1, conv: 0.1 }, coldCore: false },
  { species: "Cá bơn", short: "cá bơn", category: "demersal", surfaceSignal: "low", color: "#78350f", tempSource: "bottom", depthBand: "đáy cát bùn 20–50 m", sst: [26, 27, 29, 31], chlLog: [-0.3, 1.0], w: { food: 0.15, thermFront: 0.05, chlFront: 0.1, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  // ── CÁ RẠN (câu rạn) — gắn rạn, ảnh mặt biển gần như không giúp ──────────
  { species: "Cá hồng", short: "cá hồng", category: "reef", surfaceSignal: "low", color: "#dc2626", depthBand: "rạn & đáy cứng 12–100 m", sst: [23, 25, 29, 31], chlLog: [-1.0, 0.2], w: { food: 0.15, thermFront: 0.05, chlFront: 0.05, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  { species: "Cá mú (cá song)", short: "cá mú", category: "reef", surfaceSignal: "low", color: "#b91c1c", depthBand: "rạn & đáy cứng 5–50 m", sst: [24, 25, 29, 31], chlLog: [-1.2, 0.1], w: { food: 0.15, thermFront: 0.05, chlFront: 0.05, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  { species: "Cá kẽm", short: "cá kẽm", category: "reef", surfaceSignal: "low", color: "#e11d48", depthBand: "rạn nước trong 2–25 m", sst: [26, 27, 29, 31], chlLog: [-1.2, 0.0], w: { food: 0.15, thermFront: 0.05, chlFront: 0.05, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  // ── GIÁP XÁC — sống ĐÁY/CỬA SÔNG, theo MÙA VỤ + VÙNG, không vẽ điểm giả ──
  //  SỬA SINH HỌC: 4 loài đáy dưới trước để `conv` (hội tụ DÒNG CHẢY MẶT, lưới
  //  25 km) làm trọng số LỚN NHẤT — sai: chúng sống ĐÁY bùn/cửa sông, dòng mặt
  //  không gom chúng. Giảm conv về ~0.12 và dồn sang MỒI (phù du/mùn bã — thứ
  //  thật sự dẫn giáp xác cửa sông) + nước trồi. LƯU Ý: mồi vào bản đồ qua HAI
  //  đường ĐÃ tính KHÔNG cần trọng số `food`: (1) chlFit→foodLimiter (nhân,
  //  chlLog cao = nước giàu mồi) và (2) cơ chế `chlFront`. Trọng số `w.food`
  //  hiện KHÔNG được đọc trong chấm điểm (soft-OR + limiter) → nâng nó chỉ ghi
  //  Ý ĐỊNH, không đổi số; đòn bẩy THẬT thay conv là `upw` (nước trồi = năng
  //  suất) + chlFront/chlFit sẵn có. Vì surfaceSignal="low" đã kéo về trung
  //  tính, thay đổi này chỉ chỉnh HÌNH DÁNG tương đối — validate: không loài nào biến mất.
  { species: "Tôm bạc (tôm he)", short: "tôm bạc", category: "crustacean", surfaceSignal: "low", color: "#db2777", tempSource: "bottom", depthBand: "đáy bùn cát cửa sông 5–55 m", sst: [24, 26, 30, 33], chlLog: [0.0, 1.4], w: { food: 0.25, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.15, conv: 0.12 }, coldCore: false }, // tôm he đáy cát cửa sông: theo nước giàu mồi + trồi ven bờ, KHÔNG theo hội tụ dòng mặt
  { species: "Tôm sú biển", short: "tôm sú", category: "crustacean", surfaceSignal: "low", color: "#be185d", tempSource: "bottom", depthBand: "đáy bùn cát 10–80 m", sst: [22, 25, 30, 34], chlLog: [0.0, 1.5], w: { food: 0.2, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.15, conv: 0.13 }, coldCore: false }, // tôm sú đáy bùn cát: mồi đáy + trồi; dòng mặt không dồn con sống đáy
  { species: "Ghẹ xanh", short: "ghẹ xanh", category: "crustacean", surfaceSignal: "low", color: "#9d174d", tempSource: "bottom", depthBand: "đáy cát bùn cận bờ 4–40 m", sst: [23, 26, 30, 32], chlLog: [0.0, 1.4], w: { food: 0.25, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.15, conv: 0.12 }, coldCore: false }, // ghẹ đáy cát bùn cận bờ: mồi đáy + trồi ven bờ; hội tụ mặt không liên quan
  { species: "Cua biển", short: "cua biển", category: "crustacean", surfaceSignal: "low", color: "#831843", tempSource: "bottom", depthBand: "đáy bùn cửa sông 0–20 m", sst: [23, 25, 30, 33], chlLog: [0.2, 1.5], w: { food: 0.2, thermFront: 0.05, chlFront: 0.1, eddy: 0.05, upw: 0.15, conv: 0.12 }, coldCore: false }, // cua bùn cửa sông 0–20 m: SỐNG ĐÁY hẳn, mùn bã giàu mồi dẫn; conv 0.55 cũ là sai rõ nhất
  { species: "Ruốc", short: "ruốc", category: "crustacean", surfaceSignal: "medium", color: "#f472b6", depthBand: "tầng mặt ven bờ 0–30 m", sst: [22, 24, 29, 31], chlLog: [-0.3, 0.9], w: { food: 0.55, thermFront: 0.1, chlFront: 0.2, eddy: 0.15, upw: 0.25, conv: 0.15 }, coldCore: true },
];

/** Tra cứu nhanh meta theo tên ngắn — cho UI (màu, nhóm, độ tin, độ sâu) */
export interface SpeciesMeta {
  full: string;
  short: string;
  category: SpeciesCategory;
  surfaceSignal: SurfaceSignal;
  color: string;
  depthBand: string;
}
export const SPECIES_META: Record<string, SpeciesMeta> = Object.fromEntries(
  SPECIES_PROFILES.map((p) => [
    p.short,
    {
      full: p.species,
      short: p.short,
      category: p.category,
      surfaceSignal: p.surfaceSignal,
      color: p.color,
      depthBand: p.depthBand,
    },
  ]),
);

/** Nhãn nhóm loài tiếng Việt đời thường + thứ tự hiển thị bộ chọn */
export const CATEGORY_LABEL: Record<SpeciesCategory, string> = {
  "pelagic-large": "Cá nổi lớn",
  "pelagic-small": "Cá nổi nhỏ",
  cephalopod: "Mực, bạch tuộc",
  demersal: "Cá đáy",
  reef: "Cá rạn",
  crustacean: "Tôm, ghẹ, cua",
};

/* ----------------------------------------------------------------------------
   Toán thuần — test được
---------------------------------------------------------------------------- */

/** Hợp dải trapezoid: 0 ngoài [a,d], 1 trong [b,c], dốc tuyến tính ở mép */
export function trapezoid(v: number, a: number, b: number, c: number, d: number): number {
  if (!Number.isFinite(v) || v <= a || v >= d) return 0;
  if (v < b) return (v - a) / (b - a);
  if (v <= c) return 1;
  return (d - v) / (d - c);
}

/** Hợp mồi theo log10(chl), mép thoải ±0.45 quanh dải ưa thích */
export function chlFit(chl: number, lo: number, hi: number): number {
  if (!Number.isFinite(chl) || chl <= 0) return 0;
  const l = Math.log10(chl);
  return trapezoid(l, lo - 0.45, lo, hi, hi + 0.45);
}

/**
 * Hợp TẦNG NHIỆT cho cá nổi lớn: theo độ sâu đẳng nhiệt 20°C (D20, m).
 * Tốt nhất khi lớp nước ấm vừa phải (70–170 m) — đủ dày cho cá ngừ, vẫn có cấu
 * trúc tầng để dồn cá. Quá nông (<40 m, nước trồi lạnh sát mặt) hoặc quá sâu
 * (>230 m, không cấu trúc) thì kém. Hình thang [40, 70, 170, 230].
 */
export function thermoFit(d20: number): number {
  return trapezoid(d20, 40, 70, 170, 230);
}

/**
 * Hợp ĐỘ SÂU ĐÁY cho loài xa bờ: nước càng sâu càng hợp — 0 khi nông < a m,
 * dốc tuyến tính a→b, 1 khi ≥ b m. `depthM` là độ sâu ĐÁY dương (mét). Thiếu
 * độ sâu (NaN) → trả 1 (không phạt oan). Đây là "high-pass" chặn loài xa bờ
 * hiện ở ô nước cạn sát bờ (đáp ứng: cá nổi lớn không sát bờ).
 */
export function deepWaterFit(depthM: number, a: number, b: number): number {
  if (!Number.isFinite(depthM)) return 1;
  if (b <= a) return depthM >= b ? 1 : 0;
  return Math.max(0, Math.min(1, (depthM - a) / (b - a)));
}

/**
 * SOFT-OR tổ hợp các cơ chế gom cá — "chỉ cần MỘT cơ chế mạnh là đủ sáng ô":
 *   = 1 − Π_k ( 1 − scale · (w_k / wMax) · clamp01(x_k) )
 * Thay TRUNG BÌNH CỘNG có trọng số (nén phương sai: 6 yếu tố yếu pha loãng 1
 * yếu tố mạnh → mọi ô về 0.3–0.5) bằng phép HỢP xác suất: một front/xoáy/nước
 * trồi mạnh kéo điểm lên, không bị các yếu tố yếu dìm. Trọng số chuẩn hoá theo
 * wMax nên cơ chế QUAN TRỌNG NHẤT của loài có ảnh hưởng đầy đủ (=scale khi x=1);
 * `scale`<1 ghìm để nhiều cơ chế vừa-phải không cộng dồn thành sáng rực.
 * terms rỗng (hoặc mọi trọng số ≤0) → 0. x ngoài [0,1] hoặc NaN → kẹp/bỏ.
 */
export function softOrHabitat(terms: [number, number][], scale: number): number {
  if (terms.length === 0) return 0;
  let wMax = 0;
  for (const [w] of terms) if (w > wMax) wMax = w;
  if (wMax <= 0) return 0;
  let prod = 1;
  for (const [w, x] of terms) {
    if (w <= 0) continue;
    const xc = Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
    prod *= 1 - scale * (w / wMax) * xc;
  }
  return 1 - prod;
}

/**
 * Hạng phân vị (0..1) của `v` trong mảng ĐÃ SẮP TĂNG DẦN — vị trí tương đối
 * trong phân bố (midrank cho giá trị trùng). Dùng khi cần TƯƠNG PHẢN theo-vùng
 * (điểm tuyệt đối quá đều). Mảng RỖNG → trả `v` (không có phân bố để so).
 */
export function percentileRank(sortedAsc: number[], v: number): number {
  const n = sortedAsc.length;
  if (n === 0) return v;
  let lo = 0;
  let hi = 0;
  for (const x of sortedAsc) {
    if (x < v) lo++;
    if (x <= v) hi++;
  }
  return (lo + hi) / (2 * n);
}

export const KELVIN_OFFSET = 273.15;

export interface ScalarGrid {
  /** lat tăng dần */
  lats: number[];
  /** lon tăng dần */
  lons: number[];
  /** values[iLat][iLon], NaN = thiếu */
  values: number[][];
  /** ngày dữ liệu YYYY-MM-DD */
  date: string;
}

/** Bảng ERDDAP .json → lưới; cột: [time, (alt), lat, lon, value] */
export function parseErddapGrid(
  json: unknown,
  opts: { hasAltitude: boolean; kelvin?: boolean },
): ScalarGrid {
  const table = (json as { table?: { rows?: unknown[][] } })?.table;
  const rows = (table?.rows ?? []) as (string | number | null)[][];
  const iLat = opts.hasAltitude ? 2 : 1;
  const iLon = iLat + 1;
  const iVal = iLon + 1;

  const latSet = new Set<number>();
  const lonSet = new Set<number>();
  for (const r of rows) {
    latSet.add(r[iLat] as number);
    lonSet.add(r[iLon] as number);
  }
  const lats = [...latSet].sort((a, b) => a - b);
  const lons = [...lonSet].sort((a, b) => a - b);
  const latIdx = new Map(lats.map((v, i) => [v, i]));
  const lonIdx = new Map(lons.map((v, i) => [v, i]));

  const values = lats.map(() => lons.map(() => NaN));
  let date = "";
  for (const r of rows) {
    const v = r[iVal];
    if (!date && typeof r[0] === "string") date = (r[0] as string).slice(0, 10);
    const li = latIdx.get(r[iLat] as number)!;
    const oi = lonIdx.get(r[iLon] as number)!;
    if (typeof v === "number" && Number.isFinite(v)) {
      values[li][oi] = opts.kelvin ? v - KELVIN_OFFSET : v;
    }
  }
  return { lats, lons, values, date };
}

/**
 * Độ mạnh "front" (ranh) tại từng ô của MỘT lưới bất kỳ: |gradient| sai phân
 * giữa, chuẩn hoá theo `full` (mức gradient/ô coi là rõ = 1).
 * Dùng cho front nhiệt (full ~0.5 °C/ô), front mồi (log chl, ~0.25/ô),
 * rìa xoáy (mực nước SSHA, ~0.08 m/ô).
 */
export function gradientStrength(values: number[][], full: number): number[][] {
  const H = values.length;
  const W = H ? values[0].length : 0;
  const out = values.map((row) => row.map(() => 0));
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < W; j++) {
      if (!Number.isFinite(values[i][j])) continue;
      const up = i + 1 < H ? values[i + 1][j] : NaN;
      const dn = i - 1 >= 0 ? values[i - 1][j] : NaN;
      const rt = j + 1 < W ? values[i][j + 1] : NaN;
      const lf = j - 1 >= 0 ? values[i][j - 1] : NaN;
      const gy = Number.isFinite(up) && Number.isFinite(dn) ? (up - dn) / 2 : 0;
      const gx = Number.isFinite(rt) && Number.isFinite(lf) ? (rt - lf) / 2 : 0;
      out[i][j] = Math.min(1, Math.hypot(gx, gy) / full);
    }
  }
  return out;
}

/** Front nhiệt (giữ tên cũ cho test/đọc) — gradient SST, full 0.5 °C/ô */
export function frontStrength(grid: ScalarGrid): number[][] {
  return gradientStrength(grid.values, 0.5);
}

/**
 * Độ HỘI TỤ dòng chảy mặt tại từng ô: -(du/dx + dv/dy) sai phân giữa, chỉ
 * lấy phần DƯƠNG (nước dồn VÀO — gom mồi nổi, rác nổi → cá tụ), chuẩn hoá
 * theo `full` (m/s chênh trên 1 ô coi là hội tụ rõ; ~0.1 cho lưới 0.25°).
 */
export function convergenceStrength(
  u: number[][],
  v: number[][],
  full: number,
): number[][] {
  const H = u.length;
  const W = H ? u[0].length : 0;
  const out = u.map((row) => row.map(() => 0));
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < W; j++) {
      if (!Number.isFinite(u[i][j]) || !Number.isFinite(v[i][j])) continue;
      const rt = j + 1 < W ? u[i][j + 1] : NaN;
      const lf = j - 1 >= 0 ? u[i][j - 1] : NaN;
      const up = i + 1 < H ? v[i + 1][j] : NaN;
      const dn = i - 1 >= 0 ? v[i - 1][j] : NaN;
      const dudx = Number.isFinite(rt) && Number.isFinite(lf) ? (rt - lf) / 2 : 0;
      const dvdy = Number.isFinite(up) && Number.isFinite(dn) ? (up - dn) / 2 : 0;
      out[i][j] = Math.min(1, Math.max(0, -(dudx + dvdy) / full));
    }
  }
  return out;
}

/** Lưới log10(chl) (NaN giữ NaN) — để tính front mồi và lấy mẫu */
export function logChlGrid(chl: ScalarGrid): number[][] {
  return chl.values.map((row) =>
    row.map((v) => (Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN)),
  );
}

/** Tìm chỉ số gần nhất trong mảng tăng dần */
export function nearestIndex(arr: number[], v: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - v);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Trung vị của mảng số (đã bỏ NaN). Rỗng → NaN. KHÔNG đột biến đầu vào. */
function median(a: number[]): number {
  const n = a.length;
  if (n === 0) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  const m = n >> 1;
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * VIỆC 2 — dị thường KHÔNG GIAN: mỗi ô trừ TRUNG VỊ (median) các ô HỮU HẠN
 * trong bán kính `radiusDeg` (đơn vị độ, khoảng cách Euclid trên lat/lon).
 * So nước với VÙNG BÊN CẠNH (không so nhiều năm/cả bồn) → bỏ phần sáng-tối
 * ĐỒNG LOẠT của cả miền (mùa steric SSHA, anomaly nhiều năm), chỉ còn cấu trúc
 * nước trồi/xoáy lạnh ĐỊA PHƯƠNG — thứ THỰC SỰ xếp hạng được ô nào hơn ô nào.
 * Ô NaN giữ NaN; NaN bị loại khỏi median (median robust hơn mean với ô biên/khuyết).
 * O(ô × cửa-sổ): lats/lons tăng dần nên bỏ sớm ngoài dải ±radius.
 */
export function spatialAnomaly(
  values: number[][],
  lats: number[],
  lons: number[],
  radiusDeg: number,
): number[][] {
  const H = values.length;
  const W = H ? values[0].length : 0;
  const r2 = radiusDeg * radiusDeg;
  const out = values.map((row) => row.map(() => NaN));
  const buf: number[] = [];
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < W; j++) {
      const v0 = values[i][j];
      if (!Number.isFinite(v0)) continue; // ô NaN giữ NaN
      const lat0 = lats[i];
      const lon0 = lons[j];
      buf.length = 0;
      for (let i2 = 0; i2 < H; i2++) {
        const dLat = lats[i2] - lat0;
        if (dLat < -radiusDeg) continue;
        if (dLat > radiusDeg) break; // lats tăng dần → hết dải
        const row = values[i2];
        const dLat2 = dLat * dLat;
        for (let j2 = 0; j2 < W; j2++) {
          const dLon = lons[j2] - lon0;
          if (dLon < -radiusDeg) continue;
          if (dLon > radiusDeg) break; // lons tăng dần → hết dải
          if (dLat2 + dLon * dLon > r2) continue; // ngoài hình tròn
          const v = row[j2];
          if (Number.isFinite(v)) buf.push(v);
        }
      }
      out[i][j] = v0 - median(buf); // buf luôn chứa v0 → không rỗng
    }
  }
  return out;
}

export interface FishCell {
  lat: number;
  lon: number;
  /** điểm 0–100 (loài tốt nhất tại ô) */
  s: number;
  /** tên ngắn các loài đạt ngưỡng, tốt nhất trước */
  top: string[];
  /** điểm theo TỪNG loài (tên ngắn → 0–100) — để lọc theo loài trên bản đồ */
  sp: Record<string, number>;
  /** nhiệt độ nước °C (1 số lẻ) — hiện cho bà con khi chạm điểm */
  t: number;
  /** phù du mg/m³ (2 số lẻ), null nếu thiếu */
  c: number | null;
}

export interface FishForecast {
  ok: true;
  /** ngày ảnh cũ hơn trong 2 nguồn (trung thực) */
  date: string;
  cells: FishCell[];
  /** loài có mặt trong dự báo hôm nay, loài mạnh nhất trước — cho bộ chọn */
  species: string[];
  /**
   * ISO lúc MÁY CHỦ TÍNH bản này (route gắn vào) — KHÁC `date` (ngày ẢNH vệ tinh).
   * Service worker giữ lại response nên bản trong máy có thể rất cũ.
   * HIỆN KHÔNG HIỂN THỊ RA MÀN HÌNH (quyết định sản phẩm 2026-07-25: bỏ hẳn mọi
   * chỗ nói tuổi lớp cá cho màn hình gọn) — vẫn giữ trong payload vì gần như
   * không tốn gì và cần cho việc đối chiếu/kiểm tra sau này.
   */
  generatedAt?: string;
}

/** Cặp lưới dòng chảy mặt u (đông+) / v (bắc+) — CÙNG trục lat/lon */
export interface CurrentGrids {
  u: ScalarGrid;
  v: ScalarGrid;
}

/**
 * Ghép các trường vệ tinh → ô dự báo cá (PFZ). Đầu vào tối thiểu SST + phù du;
 * các trường sau là TUỲ CHỌN — thiếu thì trọng số chia lại (không phạt oan):
 *   `sla`  — dị thường mực nước SSHA (m): rìa xoáy + nước trồi lạnh
 *   `anom` — dị thường nhiệt so với nhiều năm (°C): ÂM = nước trồi/xáo trộn
 *   `cur`  — dòng chảy mặt u,v (m/s): độ HỘI TỤ = nơi gom mồi nổi
 *
 * Điểm mỗi loài tại ô (VIỆC 3):
 *   fit = cổng-nhiệt(trapezoid) × mồi(giới hạn mềm) × habitat × cổng-độ-sâu
 * trong đó `habitat = AGG_FLOOR + (1−AGG_FLOOR)·aggEff`, `aggEff` kéo về trung
 * tính theo độ tin mặt biển, và tổ hợp cơ chế gom cá (front nhiệt · front mồi ·
 * rìa xoáy · nước trồi · hội tụ dòng · tầng nhiệt) dùng SOFT-OR chứ KHÔNG trung
 * bình cộng (tránh nén phương sai → 40 loài ra 40 bản đồ khác nhau). Mồi tách
 * ra làm GIỚI HẠN MỀM. Chỉ giữ ô có loài ĐANG VỤ tại VÙNG đó và ≥ 25/100 (client
 * tự lọc theo sàn hiển thị 50).
 */
export function buildFishForecast(
  sst: ScalarGrid,
  chl: ScalarGrid,
  sla: ScalarGrid | null,
  month: number,
  extra?: {
    anom?: ScalarGrid | null;
    cur?: CurrentGrids | null;
    /** lưới độ sâu đẳng nhiệt 20°C (D20, m) — HYCOM; tầng cá ngừ */
    thermo?: ScalarGrid | null;
    /** lưới ĐỘ SÂU ĐÁY dương (m) — ETOPO; chặn loài xa bờ (offshore) khỏi ô cạn */
    depth?: ScalarGrid | null;
    /** lưới NHIỆT ĐỘ ĐÁY (°C) — HYCOM; cổng nhiệt loài đáy (tempSource "bottom") */
    bottomTemp?: ScalarGrid | null;
    /** lưới NHIỆT tầng ~250 m (°C) — HYCOM; cổng nhiệt cá ngừ mắt to (tempSource "deep") */
    deepTemp?: ScalarGrid | null;
  },
): FishForecast {
  const anom = extra?.anom ?? null;
  const cur = extra?.cur ?? null;
  const thermo = extra?.thermo ?? null;
  const depth = extra?.depth ?? null;
  const bottomTemp = extra?.bottomTemp ?? null;
  const deepTemp = extra?.deepTemp ?? null;
  const thermFront = frontStrength(sst);
  const logChl = logChlGrid(chl);
  const chlFront = gradientStrength(logChl, 0.25);
  // rìa xoáy = GRADIENT của SSHA (giữ nguyên — cấu trúc cục bộ sẵn có)
  const eddyEdge = sla ? gradientStrength(sla.values, 0.08) : null;
  // VIỆC 2 — ĐỘ LỚN nước trồi/xoáy lạnh dùng DỊ THƯỜNG KHÔNG GIAN (so vùng bên
  // cạnh), KHÔNG dùng anomaly nhiều năm / SSHA thô (chúng sáng-tối cả bồn theo
  // mùa → chỉ chỉnh độ sáng toàn miền, không xếp hạng ô). Precompute 1 lần.
  const slaSpatial = sla
    ? spatialAnomaly(sla.values, sla.lats, sla.lons, SPATIAL_RADIUS_DEG)
    : null;
  const anomSpatial = anom
    ? spatialAnomaly(anom.values, anom.lats, anom.lons, SPATIAL_RADIUS_DEG)
    : null;
  // hội tụ dòng chảy mặt (chỉ khi có u,v) — full 0.1 m/s mỗi ô 0.25°
  const convGrid = cur
    ? convergenceStrength(cur.u.values, cur.v.values, 0.1)
    : null;

  const cells: FishCell[] = [];
  const speciesBest = new Map<string, number>();

  for (let i = 0; i < sst.lats.length; i++) {
    for (let j = 0; j < sst.lons.length; j++) {
      const t = sst.values[i][j];
      if (!Number.isFinite(t)) continue; // đất liền
      const lat = sst.lats[i];
      const lon = sst.lons[j];
      // gán vùng GẦN NHẤT (phủ kín toàn vùng biển VN, không còn lỗ hổng giữa
      // các đa giác thô); null = xa hẳn mọi vùng → ngoài vùng biển VN
      const region = nearestRegionWithin(lat, lon, REGION_REACH_DEG);
      if (!region) continue;

      const inSeason = FISH_SEASONS.filter(
        (f) => f.months.includes(month) && f.regions.includes(region.id),
      );
      if (inSeason.length === 0) continue;

      // lấy mẫu các trường về ô SST đang xét
      const ci = nearestIndex(chl.lats, lat);
      const cj = nearestIndex(chl.lons, lon);
      const c = chl.values[ci]?.[cj];
      const fThermFront = thermFront[i][j];
      const fChlFront = chlFront[ci]?.[cj] ?? 0;
      let fEddy = 0;
      let coldStrength = 0;
      if (sla && eddyEdge) {
        const si = nearestIndex(sla.lats, lat);
        const sj = nearestIndex(sla.lons, lon);
        fEddy = eddyEdge[si]?.[sj] ?? 0;
        // mực nước THẤP HƠN VÙNG LÂN CẬN (dị thường không gian âm) = xoáy/nước
        // trồi lạnh cục bộ, năng suất cao — KHÔNG so mực tuyệt đối (mùa cả bồn).
        const slaAnomV = slaSpatial?.[si]?.[sj];
        coldStrength = Number.isFinite(slaAnomV)
          ? Math.min(1, Math.max(0, -(slaAnomV as number) / COLD_SCALE))
          : 0;
      }
      // nước trồi/xáo trộn: LẠNH HƠN VÙNG LÂN CẬN (dị thường không gian nhiệt
      // âm rõ); null = thiếu. So vùng bên cạnh, không so anomaly nhiều năm.
      let upwTerm: number | null = null;
      if (anom) {
        const ai = nearestIndex(anom.lats, lat);
        const aj = nearestIndex(anom.lons, lon);
        const a = anomSpatial?.[ai]?.[aj];
        if (Number.isFinite(a))
          upwTerm = Math.min(1, Math.max(0, -(a as number) / UPW_SCALE));
      }
      // hội tụ dòng chảy mặt tại ô; null = thiếu dữ liệu
      let convTerm: number | null = null;
      if (cur && convGrid) {
        const ui = nearestIndex(cur.u.lats, lat);
        const uj = nearestIndex(cur.u.lons, lon);
        const cv = convGrid[ui]?.[uj];
        if (cv != null && Number.isFinite(cur.u.values[ui]?.[uj])) convTerm = cv;
      }
      // tầng nhiệt: hợp theo độ sâu đẳng nhiệt 20°C (HYCOM); null = thiếu
      let thermoTerm: number | null = null;
      if (thermo) {
        const ti = nearestIndex(thermo.lats, lat);
        const tj = nearestIndex(thermo.lons, lon);
        const d20 = thermo.values[ti]?.[tj];
        if (Number.isFinite(d20)) thermoTerm = thermoFit(d20);
      }
      // độ sâu đáy tại ô (m, dương) — để CHẶN loài xa bờ (offshore) ở nước cạn
      let cellDepthM: number | null = null;
      if (depth) {
        const dpi = nearestIndex(depth.lats, lat);
        const dpj = nearestIndex(depth.lons, lon);
        const dv = depth.values[dpi]?.[dpj];
        if (Number.isFinite(dv)) cellDepthM = dv;
      }
      // nhiệt độ ĐÁY / tầng 250 m tại ô (°C) — cổng nhiệt loài đáy / ngừ mắt to.
      // Thiếu lưới hoặc ô NaN → null → chấm bằng SST mặt (fallback, không regress).
      const sampleT = (g: ScalarGrid | null): number | null => {
        if (!g) return null;
        const gi = nearestIndex(g.lats, lat);
        const gj = nearestIndex(g.lons, lon);
        const v = g.values[gi]?.[gj];
        return Number.isFinite(v) ? (v as number) : null;
      };
      const tBottom = sampleT(bottomTemp);
      const tDeep = sampleT(deepTemp);

      const scored: { short: string; fit: number; low: boolean }[] = [];
      for (const f of inSeason) {
        const p = SPECIES_PROFILES.find((x) => x.species === f.species);
        if (!p) continue;
        // CỔNG NHIỆT (nhân): chấm ở TẦNG của loài — mặt (mặc định), đáy (loài
        // đáy), hay 250 m (ngừ mắt to). Có lưới tầng → chấm nhiệt tầng với dải
        // `sst[]` (đã tuned cho tầng đó). THIẾU lưới/ô NaN → FALLBACK nhiệt MẶT
        // `t` với dải `sstFallback` (nếu có) hoặc `sst[]` — loài KHÔNG biến mất
        // khi HYCOM fail. 14 loài đáy giữ dải mặt cũ nên fallback = hành vi cũ.
        const tierT =
          p.tempSource === "bottom"
            ? tBottom
            : p.tempSource === "deep"
              ? tDeep
              : t;
        const band = tierT != null ? p.sst : (p.sstFallback ?? p.sst);
        const tGate = tierT != null ? tierT : t;
        const tFit = trapezoid(tGate, band[0], band[1], band[2], band[3]);
        if (tFit === 0) continue;
        // MỒI = GIỚI HẠN MỀM (tách khỏi soft-OR): mồi=0 chỉ hạ điểm còn
        // FOOD_FLOOR, không zero hẳn để loài KHÔNG biến mất vì nhiễu ảnh mồi.
        const food = chlFit(c, p.chlLog[0], p.chlLog[1]);
        const foodLimiter = FOOD_FLOOR + (1 - FOOD_FLOOR) * food;
        // loài ưa nước trồi lạnh: rìa xoáy HOẶC nước lõm lạnh, lấy mạnh hơn
        const eddyTerm = sla
          ? p.coldCore
            ? Math.max(fEddy, coldStrength)
            : fEddy
          : null;

        // SOFT-OR trên các CƠ CHẾ GOM CÁ (một cơ chế mạnh là đủ), loại yếu tố
        // thiếu dữ liệu. Trọng số dùng p.w.* hiện có (chuẩn hoá theo wMax trong
        // softOrHabitat). Mồi ĐÃ tách ra làm limiter, không nằm ở đây.
        const mech: [number, number][] = [
          [p.w.thermFront, fThermFront],
          [p.w.chlFront, fChlFront],
        ];
        if (eddyTerm != null) mech.push([p.w.eddy, eddyTerm]);
        if (upwTerm != null) mech.push([p.w.upw, upwTerm]);
        if (convTerm != null) mech.push([p.w.conv, convTerm]);
        // tầng nhiệt: chỉ tính cho loài CÓ trọng số (cá ngừ/cá nổi lớn, mực xà)
        if (thermoTerm != null && (p.w.thermo ?? 0) > 0)
          mech.push([p.w.thermo as number, thermoTerm]);
        const agg = softOrHabitat(mech, SOFTOR_SCALE);
        // TRUNG THỰC: loài đáy/rạn ảnh vệ tinh ít nói được → kéo tổ hợp về trung
        // tính, không vẽ điểm nóng giả. Loài nổi (high) giữ nguyên.
        const conf = SURFACE_CONF[p.surfaceSignal];
        const aggEff = conf * agg + (1 - conf) * NEUTRAL_AGG;
        // nền sàn: mùa+nhiệt+mồi vẫn quyết điểm ngay cả khi cơ chế trơ
        const habitat = AGG_FLOOR + (1 - AGG_FLOOR) * aggEff;
        // CỔNG ĐỘ SÂU: loài xa bờ (offshore) ở nước cạn → điểm kéo về 0
        const depthFit =
          p.offshore && cellDepthM != null
            ? deepWaterFit(cellDepthM, p.offshore[0], p.offshore[1])
            : 1;
        const fit = tFit * foodLimiter * habitat * depthFit;
        if (fit > 0)
          scored.push({ short: p.short, fit, low: p.surfaceSignal === "low" });
      }
      if (scored.length === 0) continue;
      scored.sort((a, b) => b.fit - a.fit);
      // điểm + điểm nóng của lớp "Mọi loài" CHỈ tính loài ĐỊNH VỊ ĐƯỢC bằng
      // vệ tinh (không low) — để bản đồ tổng không bị cá đáy tô lan man.
      const locatable = scored.filter((x) => !x.low);
      const s = locatable.length ? Math.round(locatable[0].fit * 100) : 0;
      const sp: Record<string, number> = {};
      for (const x of scored) {
        const v = Math.round(x.fit * 100);
        if (v >= KEEP_MIN) {
          sp[x.short] = v;
          const prev = speciesBest.get(x.short) ?? 0;
          if (v > prev) speciesBest.set(x.short, v);
        }
      }
      // giữ ô nếu "Mọi loài" đạt ngưỡng HOẶC có loài nào (kể cả đáy) đạt ngưỡng.
      // Ngưỡng hạ về KEEP_MIN=25 (trước 35): client (sàn hiển thị 50) tự lọc,
      // đây chỉ quyết payload — giữ đủ ô cho legend kéo-thả xuống dưới 50.
      const anySp = Object.values(sp).some((v) => v >= KEEP_MIN);
      if (s < KEEP_MIN && !anySp) continue;
      cells.push({
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
        s,
        top: locatable.filter((x) => x.fit >= KEEP_MIN / 100).slice(0, 3).map((x) => x.short),
        sp,
        t: Math.round(t * 10) / 10,
        c: Number.isFinite(c) ? Math.round((c as number) * 100) / 100 : null,
      });
    }
  }

  const date =
    [sst.date, chl.date, sla?.date, anom?.date, cur?.u.date, thermo?.date]
      .filter(Boolean)
      .sort()[0] ?? "";
  const species = [...speciesBest.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([short]) => short);
  return { ok: true, date, cells, species };
}

/* ----------------------------------------------------------------------------
   URL nguồn (server route dùng) — bbox vùng biển VN, lưới ~0.25°
---------------------------------------------------------------------------- */
const ERDDAP = "https://coastwatch.noaa.gov/erddap/griddap";

/**
 * User-Agent BẮT BUỘC cho NOAA coastwatch ERDDAP: server chặn 403 nếu UA là
 * undici/node mặc định (trả HTML lỗi → parse JSON vỡ → {ok:false} = cá không
 * chạy). Gửi UA "thật" thì 200. Dùng chung cho route fish-forecast + sea-scalar.
 */
export const ERDDAP_UA =
  "Mozilla/5.0 (compatible; SDFish/1.0; +https://github.com/Long-Forfun/ForFish)";

export function sstGridUrl(): string {
  // 0.05° × stride 5 = 0.25°; lat tăng dần
  return `${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst%5B(last)%5D%5B(5.0):5:(22.0)%5D%5B(102.0):5:(118.0)%5D`;
}

/**
 * Độ sâu đáy biển ETOPO 2022 15s (NOAA PIFSC OceanWatch ERDDAP) — TĨNH (đáy
 * không đổi), stride 60 = 0.25° khớp lưới SST. Trả `z` (mét, ÂM = dưới biển).
 * Host KHÁC coastwatch nên URL đầy đủ; vẫn gửi ERDDAP_UA phòng chặn undici.
 * Dùng để CHẶN loài xa bờ (SpeciesProfile.offshore) hiện ở ô nước cạn sát bờ.
 */
export function bathyGridUrl(): string {
  return "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z%5B(5.0):60:(22.0)%5D%5B(102.0):60:(118.0)%5D";
}

/**
 * Bảng ETOPO .json (cột [lat, lon, z]) → lưới ĐỘ SÂU ĐÁY DƯƠNG (mét). Đất liền
 * / z ≥ 0 → NaN (deepWaterFit coi NaN = không phạt; ô đất SST đã NaN nên bỏ).
 * ETOPO KHÔNG có cột time/altitude nên parse riêng, không dùng parseErddapGrid.
 */
export function parseBathyGrid(json: unknown): ScalarGrid {
  const rows = ((json as { table?: { rows?: (number | null)[][] } })?.table
    ?.rows ?? []) as (number | null)[][];
  const latSet = new Set<number>();
  const lonSet = new Set<number>();
  for (const r of rows) {
    latSet.add(r[0] as number);
    lonSet.add(r[1] as number);
  }
  const lats = [...latSet].sort((a, b) => a - b);
  const lons = [...lonSet].sort((a, b) => a - b);
  const latIdx = new Map(lats.map((v, i) => [v, i]));
  const lonIdx = new Map(lons.map((v, i) => [v, i]));
  const values = lats.map(() => lons.map(() => NaN as number));
  for (const r of rows) {
    const z = r[2];
    const li = latIdx.get(r[0] as number);
    const oi = lonIdx.get(r[1] as number);
    if (li == null || oi == null) continue;
    // z âm = dưới biển → độ sâu dương = −z; đất/z≥0 giữ NaN
    if (typeof z === "number" && Number.isFinite(z) && z < 0) values[li][oi] = -z;
  }
  return { lats, lons, values, date: "" };
}

export function slaGridUrl(): string {
  // dị thường mực nước (SSHA) mét — bước 0.5° đủ cho cấu trúc xoáy
  return `${ERDDAP}/noaacwBLENDEDsshDaily.json?sla%5B(last)%5D%5B(5.0):2:(22.0)%5D%5B(102.0):2:(118.0)%5D`;
}

export function chlGridUrl(): string {
  // 0.083° × stride 3 = 0.25°; trục lat GIẢM dần + có chiều altitude
  return `${ERDDAP}/noaacwNPPN20VIIRSDINEOFDaily.json?chlor_a%5B(last)%5D%5B(0.0)%5D%5B(22.0):3:(5.0)%5D%5B(102.0):3:(118.0)%5D`;
}

export function anomGridUrl(): string {
  // dị thường nhiệt Coral Reef Watch 0.05° × stride 5 = 0.25°; lat GIẢM dần,
  // không altitude; trễ ~1 ngày (tươi nhất trong các nguồn)
  return `${ERDDAP}/noaacrwsstanomalyDaily.json?sea_surface_temperature_anomaly%5B(last)%5D%5B(22.0):5:(5.0)%5D%5B(102.0):5:(118.0)%5D`;
}

export function currentGridUrl(comp: "u" | "v"): string {
  // dòng chảy mặt blended (altimetry) 0.25°; lat tăng dần, không altitude
  return `${ERDDAP}/noaacwBLENDEDNRTcurrentsDaily.json?${comp}_current%5B(last)%5D%5B(5.0):1:(22.0)%5D%5B(102.0):1:(118.0)%5D`;
}

/* ----------------------------------------------------------------------------
   Client gọi route nội bộ
---------------------------------------------------------------------------- */
export type FishForecastResult = FishForecast | { ok: false };

export async function fetchFishForecast(): Promise<FishForecastResult> {
  try {
    // Timeout client (invariant 02 §5): route lần lạnh ~30s (lưới ERDDAP nặng,
    // maxDuration 60) → cho 35s để nhận data thật; quá thì hủy → pill thử lại.
    // Sau lần đầu, ISR cache (revalidate 6h) trả tức thì.
    const r = await fetch(apiUrl("/api/fish-forecast"), {
      signal: AbortSignal.timeout(35000),
    });
    if (!r.ok) return { ok: false };
    return (await r.json()) as FishForecastResult;
  } catch {
    return { ok: false };
  }
}
