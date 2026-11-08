// MỤC HIỂN THỊ loài cá — CHỈ tên, màu, nhóm, độ tin mặt biển, tầng nước (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #1).
// Đây là thứ DUY NHẤT về loài được đi xuống máy bà con. Thông số mô hình (dải nhiệt, phù du, trọng số, cổng bờ/khơi)
// nằm ở `SPECIES_PROFILES` (fish-predict.ts) — chỉ máy chủ/scripts import. Viết thẳng bảng (không dựng từ profiles):
// dựng từ profiles là kéo cả mảng thông số vào bundle. Test `species-meta.test.ts` canh hai bên khớp.

/** Nhóm loài — cho bộ chọn loài + màu riêng từng nhóm */
export type SpeciesCategory = "pelagic-large" | "pelagic-small" | "cephalopod" | "demersal" | "reef" | "crustacean";

/** Mức ảnh mặt biển dự báo được loài: high (bám mặt) · medium · low (đáy/rạn — app lùi về mùa vụ + độ sâu) */
export type SurfaceSignal = "high" | "medium" | "low";

/** Tra cứu nhanh meta theo tên ngắn — cho UI (màu, nhóm, độ tin, độ sâu) */
export interface SpeciesMeta {
  full: string;
  short: string;
  category: SpeciesCategory;
  surfaceSignal: SurfaceSignal;
  color: string;
  depthBand: string;
}

export const SPECIES_META: Record<string, SpeciesMeta> = {
  "ngừ vây vàng": { full: "Cá ngừ vây vàng", short: "ngừ vây vàng", category: "pelagic-large", surfaceSignal: "high", color: "var(--sp-ngu-vay-vang)", depthBand: "tầng mặt 0–100 m (lớp trộn & đỉnh nêm nhiệt), xa bờ" },
  "ngừ mắt to": { full: "Cá ngừ mắt to", short: "ngừ mắt to", category: "pelagic-large", surfaceSignal: "medium", color: "var(--sp-ngu-mat-to)", depthBand: "đêm tầng mặt <50 m, ngày lặn sâu 200–500 m (quanh/dưới nêm nhiệt), xa bờ" },
  "ngừ vằn": { full: "Cá ngừ vằn", short: "ngừ vằn", category: "pelagic-large", surfaceSignal: "high", color: "var(--sp-ngu-van)", depthBand: "tầng mặt 0–260 m" },
  "ngừ chù": { full: "Cá ngừ chù", short: "ngừ chù", category: "pelagic-large", surfaceSignal: "medium", color: "var(--sp-ngu-chu)", depthBand: "tầng mặt 0–50 m" },
  "ngừ ồ": { full: "Cá ngừ ồ", short: "ngừ ồ", category: "pelagic-large", surfaceSignal: "medium", color: "var(--sp-ngu-o)", depthBand: "tầng mặt ven bờ & quanh đảo, theo đàn cá cơm" },
  "ngừ chấm": { full: "Cá ngừ chấm", short: "ngừ chấm", category: "pelagic-large", surfaceSignal: "medium", color: "var(--sp-ngu-cham)", depthBand: "ven bờ 0–80 m" },
  "cá thu": { full: "Cá thu", short: "cá thu", category: "pelagic-large", surfaceSignal: "high", color: "var(--sp-ca-thu)", depthBand: "tầng mặt – đáy 5–170 m, ven bờ" },
  "cá cờ": { full: "Cá cờ (cá cờ buồm)", short: "cá cờ", category: "pelagic-large", surfaceSignal: "high", color: "var(--sp-ca-co)", depthBand: "tầng mặt 0–200 m" },
  "nục heo": { full: "Cá nục heo", short: "nục heo", category: "pelagic-large", surfaceSignal: "high", color: "var(--sp-nuc-heo)", depthBand: "tầng mặt 0–85 m, quanh vật nổi" },
  "cá ngân": { full: "Cá ngân", short: "cá ngân", category: "pelagic-small", surfaceSignal: "medium", color: "var(--sp-ca-ngan)", depthBand: "tầng mặt – trung tầng 0–200 m" },
  "cá nục": { full: "Cá nục", short: "cá nục", category: "pelagic-small", surfaceSignal: "high", color: "var(--sp-ca-nuc)", depthBand: "tầng mặt 10–80 m" },
  "cá cơm": { full: "Cá cơm", short: "cá cơm", category: "pelagic-small", surfaceSignal: "high", color: "var(--sp-ca-com)", depthBand: "tầng mặt ven bờ 0–50 m" },
  "cá trích": { full: "Cá trích", short: "cá trích", category: "pelagic-small", surfaceSignal: "high", color: "var(--sp-ca-trich)", depthBand: "tầng mặt ven bờ 10–70 m" },
  "bạc má": { full: "Cá bạc má", short: "bạc má", category: "pelagic-small", surfaceSignal: "medium", color: "var(--sp-bac-ma)", depthBand: "tầng mặt ven bờ 20–70 m" },
  "cá tráo": { full: "Cá tráo (mắt to)", short: "cá tráo", category: "pelagic-small", surfaceSignal: "high", color: "var(--sp-ca-trao)", depthBand: "tầng nổi sát mặt 0–50 m" },
  "cá sòng": { full: "Cá sòng", short: "cá sòng", category: "pelagic-small", surfaceSignal: "medium", color: "var(--sp-ca-song)", depthBand: "tầng mặt 20–100 m" },
  "chỉ vàng": { full: "Cá chỉ vàng", short: "chỉ vàng", category: "pelagic-small", surfaceSignal: "medium", color: "var(--sp-chi-vang)", depthBand: "ven bờ nông ≤50 m" },
  "cá lầm": { full: "Cá lầm", short: "cá lầm", category: "pelagic-small", surfaceSignal: "high", color: "var(--sp-ca-lam)", depthBand: "tầng mặt ven bờ 10–75 m" },
  "cá hố": { full: "Cá hố", short: "cá hố", category: "demersal", surfaceSignal: "medium", color: "var(--sp-ca-ho)", depthBand: "tầng đáy – giữa 20–100 m" },
  "mực xà": { full: "Mực xà", short: "mực xà", category: "cephalopod", surfaceSignal: "high", color: "var(--sp-muc-xa)", depthBand: "tầng nước 10–50 m đêm, xa bờ" },
  "mực ống": { full: "Mực ống", short: "mực ống", category: "cephalopod", surfaceSignal: "medium", color: "var(--sp-muc-ong)", depthBand: "tầng mặt 10–50 m đêm (ăn đèn)" },
  "mực lá": { full: "Mực lá", short: "mực lá", category: "cephalopod", surfaceSignal: "low", color: "var(--sp-muc-la)", depthBand: "ven bờ 0–100 m, rạn & cỏ biển" },
  "mực nang": { full: "Mực nang", short: "mực nang", category: "cephalopod", surfaceSignal: "low", color: "var(--sp-muc-nang)", depthBand: "đáy 0–130 m, cát & cỏ biển" },
  "bạch tuộc": { full: "Bạch tuộc", short: "bạch tuộc", category: "cephalopod", surfaceSignal: "low", color: "var(--sp-bach-tuoc)", depthBand: "đáy 0–100 m, hang & rạn" },
  "cá mối": { full: "Cá mối", short: "cá mối", category: "demersal", surfaceSignal: "low", color: "var(--sp-ca-moi)", depthBand: "đáy bùn cát 20–100 m" },
  "cá đổng": { full: "Cá đổng (cá lượng)", short: "cá đổng", category: "demersal", surfaceSignal: "low", color: "var(--sp-ca-dong)", depthBand: "đáy bùn cát 50–100 m" },
  "cá phèn": { full: "Cá phèn", short: "cá phèn", category: "demersal", surfaceSignal: "low", color: "var(--sp-ca-phen)", depthBand: "đáy bùn cát 10–60 m" },
  "cá đù": { full: "Cá đù (cá sủ)", short: "cá đù", category: "demersal", surfaceSignal: "medium", color: "var(--sp-ca-du)", depthBand: "đáy cửa sông ven bờ 0–80 m" },
  "cá khoai": { full: "Cá khoai", short: "cá khoai", category: "demersal", surfaceSignal: "low", color: "var(--sp-ca-khoai)", depthBand: "đáy bùn cửa sông 5–50 m" },
  "cá chim": { full: "Cá chim", short: "cá chim", category: "demersal", surfaceSignal: "medium", color: "var(--sp-ca-chim)", depthBand: "đáy bùn 5–110 m" },
  "cá bơn": { full: "Cá bơn", short: "cá bơn", category: "demersal", surfaceSignal: "low", color: "var(--sp-ca-bon)", depthBand: "đáy cát bùn 20–50 m" },
  "cá hồng": { full: "Cá hồng", short: "cá hồng", category: "reef", surfaceSignal: "low", color: "var(--sp-ca-hong)", depthBand: "rạn & đáy cứng 12–100 m" },
  "cá mú": { full: "Cá mú (cá song)", short: "cá mú", category: "reef", surfaceSignal: "low", color: "var(--sp-ca-mu)", depthBand: "rạn & đáy cứng 5–50 m" },
  "cá kẽm": { full: "Cá kẽm", short: "cá kẽm", category: "reef", surfaceSignal: "low", color: "var(--sp-ca-kem)", depthBand: "rạn nước trong 2–25 m" },
  "tôm bạc": { full: "Tôm bạc (tôm he)", short: "tôm bạc", category: "crustacean", surfaceSignal: "low", color: "var(--sp-tom-bac)", depthBand: "đáy bùn cát cửa sông 5–55 m" },
  "tôm sú": { full: "Tôm sú biển", short: "tôm sú", category: "crustacean", surfaceSignal: "low", color: "var(--sp-tom-su)", depthBand: "đáy bùn cát 10–80 m" },
  "ghẹ xanh": { full: "Ghẹ xanh", short: "ghẹ xanh", category: "crustacean", surfaceSignal: "low", color: "var(--sp-ghe-xanh)", depthBand: "đáy cát bùn cận bờ 4–40 m" },
  "ruốc": { full: "Ruốc", short: "ruốc", category: "crustacean", surfaceSignal: "medium", color: "var(--sp-ruoc)", depthBand: "tầng mặt ven bờ 0–30 m" },
};

/** Nhãn nhóm loài tiếng Việt đời thường + thứ tự hiển thị bộ chọn */
export const CATEGORY_LABEL: Record<SpeciesCategory, string> = {
  "pelagic-large": "Cá nổi lớn",
  "pelagic-small": "Cá nổi nhỏ",
  cephalopod: "Mực, bạch tuộc",
  demersal: "Cá đáy",
  reef: "Cá rạn",
  crustacean: "Tôm, ghẹ, cua",
};
