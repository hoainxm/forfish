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
/** habitat trung tính khi vệ tinh không nói được gì (loài đáy) — tránh điểm nóng giả */
const NEUTRAL_HABITAT = 0.45;

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
}

// Bộ khẩu vị 39 loài ngư dân VN khai thác nhiều nhất (đủ để ~90% bà con tìm
// được loài mình đánh). SST/dải mồi/đặc tính tổng hợp từ FAO Species Catalogue,
// FishBase, bản tin Viện Hải sản (RIMF) + tài liệu nghề cá công khai (2026-06-10).
// Màu mỗi loài theo họ nhóm cho dễ phân biệt: cá nổi lớn = xanh dương, cá nổi
// nhỏ = xanh lá, mực = tím, cá đáy = cam nâu, cá rạn = đỏ, giáp xác = hồng sen.
export const SPECIES_PROFILES: SpeciesProfile[] = [
  // ── CÁ NỔI LỚN xa bờ — săn ở rìa xoáy ấm + front + hội tụ dòng ───────────
  { species: "Cá ngừ đại dương (vây vàng, mắt to)", short: "ngừ đại dương", category: "pelagic-large", surfaceSignal: "high", color: "#1d4ed8", depthBand: "tầng mặt 0–250 m, xa bờ", sst: [24, 26, 30, 31.5], chlLog: [-1.1, -0.2], w: { food: 0.2, thermFront: 0.3, chlFront: 0.15, eddy: 0.35, upw: 0.05, conv: 0.2, thermo: 0.3 }, coldCore: false },
  { species: "Cá ngừ vằn", short: "ngừ vằn", category: "pelagic-large", surfaceSignal: "high", color: "#2563eb", depthBand: "tầng mặt 0–260 m", sst: [23, 25, 29.5, 31], chlLog: [-1.0, 0.0], w: { food: 0.25, thermFront: 0.3, chlFront: 0.15, eddy: 0.3, upw: 0.05, conv: 0.2, thermo: 0.2 }, coldCore: false },
  { species: "Cá ngừ chù", short: "ngừ chù", category: "pelagic-large", surfaceSignal: "medium", color: "#0891b2", depthBand: "tầng mặt 0–50 m", sst: [24, 28, 31, 32], chlLog: [-1.1, -0.5], w: { food: 0.25, thermFront: 0.2, chlFront: 0.25, eddy: 0.15, upw: 0.05, conv: 0.1, thermo: 0.2 }, coldCore: false },
  { species: "Cá ngừ ồ", short: "ngừ ồ", category: "pelagic-large", surfaceSignal: "medium", color: "#0e7490", depthBand: "tầng mặt 0–200 m, ven rạn", sst: [18, 24, 28, 30], chlLog: [-0.8, 0.3], w: { food: 0.3, thermFront: 0.25, chlFront: 0.2, eddy: 0.1, upw: 0.1, conv: 0.05, thermo: 0.15 }, coldCore: false },
  { species: "Cá ngừ chấm", short: "ngừ chấm", category: "pelagic-large", surfaceSignal: "medium", color: "#0d9488", depthBand: "ven bờ 0–80 m", sst: [16, 24, 27, 31], chlLog: [-0.7, 0.4], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.05, upw: 0.15, conv: 0.1, thermo: 0.1 }, coldCore: false },
  { species: "Cá thu", short: "cá thu", category: "pelagic-large", surfaceSignal: "high", color: "#155e75", depthBand: "tầng mặt – đáy 5–170 m, ven bờ", sst: [16, 23, 29, 31], chlLog: [-0.7, 0.4], w: { food: 0.25, thermFront: 0.35, chlFront: 0.2, eddy: 0.1, upw: 0.1, conv: 0.15, thermo: 0.05 }, coldCore: false },
  { species: "Cá cờ (cá cờ buồm)", short: "cá cờ", category: "pelagic-large", surfaceSignal: "high", color: "#3b82f6", depthBand: "tầng mặt 0–200 m", sst: [20, 25, 28, 30], chlLog: [-1.4, -0.2], w: { food: 0.1, thermFront: 0.3, chlFront: 0.15, eddy: 0.3, upw: 0.05, conv: 0.1, thermo: 0.3 }, coldCore: false },
  { species: "Cá nục heo", short: "nục heo", category: "pelagic-large", surfaceSignal: "high", color: "#06b6d4", depthBand: "tầng mặt 0–85 m, quanh vật nổi", sst: [21, 26, 30, 31], chlLog: [-1.2, -0.3], w: { food: 0.1, thermFront: 0.25, chlFront: 0.15, eddy: 0.25, upw: 0.05, conv: 0.2, thermo: 0.2 }, coldCore: false },
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
  { species: "Mực xà", short: "mực xà", category: "cephalopod", surfaceSignal: "high", color: "#6d28d9", depthBand: "tầng nước 10–50 m đêm, xa bờ", sst: [25, 26.5, 30, 31], chlLog: [-1.0, -0.1], w: { food: 0.25, thermFront: 0.3, chlFront: 0.15, eddy: 0.3, upw: 0.05, conv: 0.15, thermo: 0.25 }, coldCore: false },
  { species: "Mực ống", short: "mực ống", category: "cephalopod", surfaceSignal: "medium", color: "#7c3aed", depthBand: "tầng mặt 10–50 m đêm (ăn đèn)", sst: [22, 24.5, 29.5, 31], chlLog: [-0.7, 0.5], w: { food: 0.35, thermFront: 0.25, chlFront: 0.15, eddy: 0.25, upw: 0.1, conv: 0.15 }, coldCore: false },
  { species: "Mực lá", short: "mực lá", category: "cephalopod", surfaceSignal: "medium", color: "#8b5cf6", depthBand: "ven bờ 0–100 m, rạn & cỏ biển", sst: [22, 24, 29, 32], chlLog: [-0.5, 0.3], w: { food: 0.4, thermFront: 0.4, chlFront: 0.3, eddy: 0.2, upw: 0.2, conv: 0.5 }, coldCore: false },
  { species: "Mực nang", short: "mực nang", category: "cephalopod", surfaceSignal: "low", color: "#a855f7", depthBand: "đáy 0–130 m, cát & cỏ biển", sst: [22, 25, 29, 31], chlLog: [-0.3, 0.5], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.1, upw: 0.2, conv: 0.3 }, coldCore: false },
  { species: "Bạch tuộc", short: "bạch tuộc", category: "cephalopod", surfaceSignal: "low", color: "#9333ea", depthBand: "đáy 0–100 m, hang & rạn", sst: [23, 26, 30, 32], chlLog: [-0.2, 0.5], w: { food: 0.4, thermFront: 0.1, chlFront: 0.1, eddy: 0.1, upw: 0.2, conv: 0.3 }, coldCore: false },
  // ── CÁ ĐÁY mềm (lưới kéo) — ảnh vệ tinh ít giúp, theo MÙA + ĐỘ SÂU ────────
  { species: "Cá mối", short: "cá mối", category: "demersal", surfaceSignal: "low", color: "#c2410c", depthBand: "đáy bùn cát 20–100 m", sst: [18, 23, 29, 31], chlLog: [-0.5, 1.2], w: { food: 0.25, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá đổng (cá lượng)", short: "cá đổng", category: "demersal", surfaceSignal: "low", color: "#ea580c", depthBand: "đáy bùn cát 50–100 m", sst: [24, 25, 29, 30], chlLog: [-0.3, 1.0], w: { food: 0.2, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá phèn", short: "cá phèn", category: "demersal", surfaceSignal: "low", color: "#d97706", depthBand: "đáy bùn cát 10–60 m", sst: [22, 25, 30, 32], chlLog: [-0.2, 1.2], w: { food: 0.2, thermFront: 0.1, chlFront: 0.2, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá đù (cá sủ)", short: "cá đù", category: "demersal", surfaceSignal: "medium", color: "#b45309", depthBand: "đáy cửa sông ven bờ 0–80 m", sst: [20, 22, 28, 30], chlLog: [0.0, 1.4], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.1, upw: 0.15, conv: 0.1 }, coldCore: false },
  { species: "Cá khoai", short: "cá khoai", category: "demersal", surfaceSignal: "low", color: "#92400e", depthBand: "đáy bùn cửa sông 5–50 m", sst: [24, 26, 30, 32], chlLog: [0.2, 1.4], w: { food: 0.2, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.05 }, coldCore: false },
  { species: "Cá chim", short: "cá chim", category: "demersal", surfaceSignal: "medium", color: "#a16207", depthBand: "đáy bùn 5–110 m", sst: [22, 24, 29, 31], chlLog: [-0.3, 0.8], w: { food: 0.3, thermFront: 0.2, chlFront: 0.2, eddy: 0.1, upw: 0.1, conv: 0.1 }, coldCore: false },
  { species: "Cá bơn", short: "cá bơn", category: "demersal", surfaceSignal: "low", color: "#78350f", depthBand: "đáy cát bùn 20–50 m", sst: [26, 27, 29, 31], chlLog: [-0.3, 1.0], w: { food: 0.15, thermFront: 0.05, chlFront: 0.1, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  // ── CÁ RẠN (câu rạn) — gắn rạn, ảnh mặt biển gần như không giúp ──────────
  { species: "Cá hồng", short: "cá hồng", category: "reef", surfaceSignal: "low", color: "#dc2626", depthBand: "rạn & đáy cứng 12–100 m", sst: [23, 25, 29, 31], chlLog: [-1.0, 0.2], w: { food: 0.15, thermFront: 0.05, chlFront: 0.05, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  { species: "Cá mú (cá song)", short: "cá mú", category: "reef", surfaceSignal: "low", color: "#b91c1c", depthBand: "rạn & đáy cứng 5–50 m", sst: [24, 25, 29, 31], chlLog: [-1.2, 0.1], w: { food: 0.15, thermFront: 0.05, chlFront: 0.05, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  { species: "Cá kẽm", short: "cá kẽm", category: "reef", surfaceSignal: "low", color: "#e11d48", depthBand: "rạn nước trong 2–25 m", sst: [26, 27, 29, 31], chlLog: [-1.2, 0.0], w: { food: 0.15, thermFront: 0.05, chlFront: 0.05, eddy: 0.05, upw: 0.05, conv: 0.05 }, coldCore: false },
  // ── GIÁP XÁC — sống đáy/cửa sông, theo MÙA VỤ + VÙNG, không vẽ điểm giả ──
  { species: "Tôm bạc (tôm he)", short: "tôm bạc", category: "crustacean", surfaceSignal: "low", color: "#db2777", depthBand: "đáy bùn cát cửa sông 5–55 m", sst: [24, 26, 30, 33], chlLog: [0.0, 1.4], w: { food: 0.25, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.35 }, coldCore: false },
  { species: "Tôm sú biển", short: "tôm sú", category: "crustacean", surfaceSignal: "low", color: "#be185d", depthBand: "đáy bùn cát 10–80 m", sst: [22, 25, 30, 34], chlLog: [0.0, 1.5], w: { food: 0.2, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.1, conv: 0.4 }, coldCore: false },
  { species: "Ghẹ xanh", short: "ghẹ xanh", category: "crustacean", surfaceSignal: "low", color: "#9d174d", depthBand: "đáy cát bùn cận bờ 4–40 m", sst: [23, 26, 30, 32], chlLog: [0.0, 1.4], w: { food: 0.25, thermFront: 0.1, chlFront: 0.15, eddy: 0.05, upw: 0.05, conv: 0.4 }, coldCore: false },
  { species: "Cua biển", short: "cua biển", category: "crustacean", surfaceSignal: "low", color: "#831843", depthBand: "đáy bùn cửa sông 0–20 m", sst: [23, 25, 30, 33], chlLog: [0.2, 1.5], w: { food: 0.2, thermFront: 0.05, chlFront: 0.1, eddy: 0.05, upw: 0.05, conv: 0.55 }, coldCore: false },
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
 * Điểm mỗi loài tại ô = hợp-nhiệt(trapezoid) × habitat, trong đó habitat là
 * trung bình CÓ TRỌNG SỐ của: mồi · front nhiệt · front mồi · rìa xoáy ·
 * nước trồi · hội tụ dòng. Chỉ giữ ô có loài ĐANG VỤ tại VÙNG đó và ≥ 35/100.
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
  },
): FishForecast {
  const anom = extra?.anom ?? null;
  const cur = extra?.cur ?? null;
  const thermo = extra?.thermo ?? null;
  const thermFront = frontStrength(sst);
  const logChl = logChlGrid(chl);
  const chlFront = gradientStrength(logChl, 0.25);
  // rìa xoáy + cường độ nước trồi lạnh (chỉ khi có SSHA)
  const eddyEdge = sla ? gradientStrength(sla.values, 0.08) : null;
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
        const slaV = sla.values[si]?.[sj];
        // mực nước lõm (âm) = xoáy/nước trồi lạnh, năng suất cao
        coldStrength = Number.isFinite(slaV)
          ? Math.min(1, Math.max(0, -slaV / 0.12))
          : 0;
      }
      // nước trồi/xáo trộn: dị thường nhiệt ÂM rõ (−1.5 °C → 1); null = thiếu
      let upwTerm: number | null = null;
      if (anom) {
        const ai = nearestIndex(anom.lats, lat);
        const aj = nearestIndex(anom.lons, lon);
        const a = anom.values[ai]?.[aj];
        if (Number.isFinite(a)) upwTerm = Math.min(1, Math.max(0, -a / 1.5));
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

      const scored: { short: string; fit: number; low: boolean }[] = [];
      for (const f of inSeason) {
        const p = SPECIES_PROFILES.find((x) => x.species === f.species);
        if (!p) continue;
        const tFit = trapezoid(t, p.sst[0], p.sst[1], p.sst[2], p.sst[3]);
        if (tFit === 0) continue;
        const food = chlFit(c, p.chlLog[0], p.chlLog[1]);
        // loài ưa nước trồi lạnh: rìa xoáy HOẶC nước lõm lạnh, lấy mạnh hơn
        const eddyTerm = sla
          ? p.coldCore
            ? Math.max(fEddy, coldStrength)
            : fEddy
          : null;

        // trung bình có trọng số, loại yếu tố thiếu dữ liệu rồi chia lại
        const terms: [number, number][] = [
          [p.w.food, food],
          [p.w.thermFront, fThermFront],
          [p.w.chlFront, fChlFront],
        ];
        if (eddyTerm != null) terms.push([p.w.eddy, eddyTerm]);
        if (upwTerm != null) terms.push([p.w.upw, upwTerm]);
        if (convTerm != null) terms.push([p.w.conv, convTerm]);
        // tầng nhiệt: chỉ tính cho loài CÓ trọng số (cá ngừ/cá nổi lớn, mực xà)
        if (thermoTerm != null && (p.w.thermo ?? 0) > 0)
          terms.push([p.w.thermo as number, thermoTerm]);
        let wSum = 0;
        let acc = 0;
        for (const [w, v] of terms) {
          wSum += w;
          acc += w * v;
        }
        const habitat = wSum > 0 ? acc / wSum : 0;
        // TRUNG THỰC: loài đáy/rạn ảnh vệ tinh ít nói được → kéo habitat về
        // trung tính, không vẽ điểm nóng giả. Loài nổi (high) giữ nguyên.
        const conf = SURFACE_CONF[p.surfaceSignal];
        const habitatEff = conf * habitat + (1 - conf) * NEUTRAL_HABITAT;
        const fit = tFit * habitatEff;
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
        if (v >= 25) {
          sp[x.short] = v;
          const prev = speciesBest.get(x.short) ?? 0;
          if (v > prev) speciesBest.set(x.short, v);
        }
      }
      // giữ ô nếu "Mọi loài" đạt ngưỡng HOẶC có loài nào (kể cả đáy) đạt ngưỡng
      const anySp = Object.values(sp).some((v) => v >= 35);
      if (s < 35 && !anySp) continue;
      cells.push({
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
        s,
        top: locatable.filter((x) => x.fit >= 0.35).slice(0, 3).map((x) => x.short),
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

export function sstGridUrl(): string {
  // 0.05° × stride 5 = 0.25°; lat tăng dần
  return `${ERDDAP}/noaacwBLENDEDsstDaily.json?analysed_sst%5B(last)%5D%5B(5.0):5:(22.0)%5D%5B(102.0):5:(118.0)%5D`;
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
    const r = await fetch("/api/fish-forecast");
    if (!r.ok) return { ok: false };
    return (await r.json()) as FishForecastResult;
  } catch {
    return { ok: false };
  }
}
