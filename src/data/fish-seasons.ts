// Mùa vụ cá THAM KHẢO theo vùng biển Việt Nam — vẽ lớp "Cá mùa này" lên bản đồ.
//
// ⚠️ THAM KHẢO: đây là mùa vụ TRUNG BÌNH NHIỀU NĂM tổng hợp từ nguồn công khai,
// KHÔNG phải dự báo thời gian thực. Vị trí là VÙNG biển rộng (đa giác thô),
// không phải toạ độ điểm đánh bắt. Muốn dự báo ngư trường theo tuần/tháng,
// bà con theo dõi bản tin Dự báo ngư trường của Viện Nghiên cứu Hải sản (RIMF)
// phát qua đài duyên hải và website rimf.org.vn.
//
// Nguồn tổng hợp (đọc ngày 2026-06-10):
// - Viện Nghiên cứu Hải sản (rimf.org.vn): Trung tâm Dự báo ngư trường — bản tin
//   theo nghề/loài (câu cá ngừ đại dương, lưới vây/rê cá ngừ vằn, câu mực xà,
//   chụp mực, cá nổi nhỏ); bài "Hiện trạng nguồn lợi và tình hình khai thác cá
//   ngừ đại dương", "Thực trạng nghề câu mực xà ở Việt Nam" (ngư trường Hoàng
//   Sa–Trường Sa, >150 hải lý, vụ chính tháng 4–9).
// - Tạp chí Thuỷ sản Việt Nam (thuysanvietnam.com.vn): "Ngư trường, nguồn lợi
//   và khả năng khai thác cá ngừ đại dương" (chính vụ tháng 12–6, cá di chuyển
//   từ phía Bắc xuống Trường Sa); ngư trường cá ngừ vằn theo mùa gió; vụ cá Nam
//   miền Trung (cá cơm, cá nục, cá trích, mực).
// - Báo địa phương/TTXVN: Quảng Trị, Ninh Thuận trúng vụ cá Nam (cá cơm, cá nục
//   tháng 4–9); Thanh Hoá trúng vụ cá Bắc; Nhân Dân: mùa cá trích Vũng Tàu;
//   mùa ruốc xứ Thanh (vụ chính cuối năm tới đầu xuân, vụ phụ mùa hè).
// - Kiến thức nghề cá phổ biến: vụ cá Nam ~tháng 4–9 (gió Tây Nam),
//   vụ cá Bắc ~tháng 10–3 (gió Đông Bắc).
//
// Khi nguồn mâu thuẫn (mùa lệch theo địa phương), lấy KHOẢNG RỘNG và ghi note.

export type FishRegionId =
  | "vinh-bac-bo"
  | "trung-bo"
  | "hoang-sa"
  | "nam-trung-bo"
  | "truong-sa-dk1"
  | "dong-nam-bo"
  | "tay-nam-bo";

export interface FishRegion {
  id: FishRegionId;
  name: string;
  /**
   * Đa giác THÔ phủ vùng biển ([lng, lat], 7-9 đỉnh, không khép điểm cuối —
   * regionAt tự khép). Nằm TRONG ranh giới biển VN (xem vn-maritime-border.ts),
   * các vùng KHÔNG chồng lên nhau.
   */
  polygon: [number, number][];
  /** Điểm đặt nhãn [lng, lat] — giữa vùng, tránh nhãn chủ quyền có sẵn. */
  labelAt: [number, number];
}

export const FISH_REGIONS: FishRegion[] = [
  {
    id: "vinh-bac-bo",
    name: "Vịnh Bắc Bộ",
    // Móng Cái → đảo Bạch Long Vĩ → cửa vịnh (Cồn Cỏ), phía Tây đường phân định
    polygon: [
      [106.2, 20.4],
      [106.8, 20.9],
      [107.9, 21.15],
      [108.1, 20.5],
      [107.3, 19.6],
      [107.1, 18.8],
      [106.8, 17.8],
      [106.1, 18.5],
      [105.9, 19.5],
    ],
    labelAt: [106.6, 19.9],
  },
  {
    id: "trung-bo",
    name: "Biển Trung Bộ",
    // Dải ven bờ Quảng Bình → Bình Định, ra tới ~110.4°E (chưa tới Hoàng Sa)
    polygon: [
      [106.8, 17.3],
      [108.0, 17.2],
      [109.6, 16.2],
      [110.4, 15.2],
      [110.4, 13.8],
      [109.5, 13.8],
      [108.85, 15.4],
      [108.3, 16.3],
    ],
    labelAt: [109.3, 15.3],
  },
  {
    id: "hoang-sa",
    name: "Ngư trường Hoàng Sa",
    polygon: [
      [110.8, 16.3],
      [111.2, 17.2],
      [112.5, 17.3],
      [113.2, 16.8],
      [113.2, 15.6],
      [112.0, 15.2],
      [111.0, 15.4],
    ],
    labelAt: [112.3, 15.9],
  },
  {
    id: "nam-trung-bo",
    name: "Nam Trung Bộ",
    // Phú Yên → Bình Thuận (cái nôi nghề câu cá ngừ đại dương)
    polygon: [
      [109.4, 13.7],
      [110.6, 13.6],
      [111.3, 12.5],
      [111.3, 11.0],
      [110.0, 10.3],
      [108.6, 10.5],
      [108.5, 10.8],
      [109.5, 12.5],
    ],
    labelAt: [110.3, 11.8],
  },
  {
    id: "truong-sa-dk1",
    name: "Trường Sa – DK1",
    // Quần đảo Trường Sa, nhà giàn DK1, giữa Biển Đông
    polygon: [
      [112.2, 13.4],
      [115.5, 12.0],
      [115.6, 9.0],
      [113.5, 7.2],
      [111.5, 7.8],
      [111.2, 9.5],
      [111.5, 11.5],
    ],
    labelAt: [113.6, 10.8],
  },
  {
    id: "dong-nam-bo",
    name: "Đông Nam Bộ",
    // Vũng Tàu → Côn Sơn → cửa sông Cửu Long
    polygon: [
      [107.0, 10.2],
      [108.4, 10.2],
      [109.6, 9.0],
      [109.3, 7.0],
      [107.0, 6.6],
      [106.0, 7.5],
      [106.0, 8.8],
    ],
    labelAt: [107.9, 8.6],
  },
  {
    id: "tay-nam-bo",
    name: "Tây Nam Bộ",
    // Phú Quốc → mũi Cà Mau (vịnh Thái Lan)
    polygon: [
      [104.0, 10.45],
      [104.5, 10.2],
      [104.75, 9.3],
      [104.85, 8.45],
      [104.0, 7.4],
      [103.2, 8.0],
      [103.3, 9.5],
    ],
    labelAt: [103.9, 8.9],
  },
];

export interface FishSeason {
  species: string;
  /** Các tháng chính vụ (1-12). */
  months: number[];
  regions: FishRegionId[];
  note?: string;
}

// Một loài có thể xuất hiện 2 dòng nếu mùa vụ khác nhau theo vùng
// (vd mực ống: vịnh Bắc Bộ rộ hè, Phú Quốc rộ mùa khô).
export const FISH_SEASONS: FishSeason[] = [
  {
    species: "Cá ngừ đại dương (vây vàng, mắt to)",
    months: [12, 1, 2, 3, 4, 5, 6],
    regions: ["nam-trung-bo", "hoang-sa", "truong-sa-dk1"],
    note: "Chính vụ câu từ tháng 12 tới tháng 6; đầu vụ cá ở phía Bắc, cuối vụ dồn về Trường Sa.",
  },
  {
    species: "Cá ngừ vằn",
    months: [11, 12, 1, 2, 3, 4, 5],
    regions: ["trung-bo", "nam-trung-bo", "hoang-sa", "truong-sa-dk1"],
    note: "Có quanh năm, rộ mùa gió Đông Bắc (tháng 11–5); tháng 9–10 sản lượng thấp.",
  },
  {
    species: "Mực xà",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["hoang-sa", "truong-sa-dk1"],
    note: "Ngư trường xa bờ trên 150 hải lý, vụ chính tháng 4–9.",
  },
  {
    species: "Mực ống",
    months: [5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo", "trung-bo"],
    note: "Nghề chụp mực, câu mực rộ vụ cá Nam.",
  },
  {
    species: "Mực ống",
    months: [11, 12, 1, 2, 3, 4],
    regions: ["tay-nam-bo", "dong-nam-bo"],
    note: "Mùa khô biển êm, câu mực đêm rộ quanh Phú Quốc.",
  },
  {
    species: "Cá nục",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo"],
    note: "Rộ vụ cá Nam, đi theo đàn gần bờ.",
  },
  {
    species: "Cá cơm",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo"],
    note: "Rộ vụ cá Nam, lưới vây ven bờ.",
  },
  {
    species: "Cá cơm",
    months: [7, 8, 9, 10, 11, 12],
    regions: ["tay-nam-bo"],
    note: "Vùng Phú Quốc rộ nửa cuối năm — nguyên liệu nước mắm; mùa rộ thay đổi theo năm.",
  },
  {
    species: "Cá trích",
    months: [1, 2, 3, 4],
    regions: ["vinh-bac-bo", "trung-bo"],
    note: "Rộ đầu xuân (khoảng tháng Giêng tới tháng Ba âm lịch).",
  },
  {
    species: "Cá trích",
    months: [5, 6, 7, 8, 9, 10, 11],
    regions: ["dong-nam-bo"],
    note: "Vùng Vũng Tàu mùa cá trích kéo dài tháng 5–11.",
  },
  {
    species: "Cá thu",
    months: [10, 11, 12, 1, 2, 3],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo"],
    note: "Rộ vụ cá Bắc, được giá dịp giáp Tết.",
  },
  {
    species: "Cá hố",
    months: [3, 4, 5, 6, 7],
    regions: ["trung-bo", "vinh-bac-bo"],
    note: "Tham khảo: rộ cuối xuân – đầu hè ở miền Trung, mùa vụ lệch theo địa phương.",
  },
  {
    species: "Cá chỉ vàng",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Có gần quanh năm, rộ vụ cá Nam.",
  },
  {
    species: "Ruốc",
    months: [10, 11, 12, 1, 2, 3],
    regions: ["vinh-bac-bo", "trung-bo"],
    note: "Rộ theo con nước từ cuối năm tới đầu xuân; vài nơi có thêm vụ phụ mùa hè.",
  },
  {
    species: "Ruốc",
    months: [5, 6, 7, 8, 9, 10],
    regions: ["nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Vụ ruốc mùa mưa bão (rộ tháng 7–8 âm lịch), đàn nổi gần bờ — nghề te, dạ.",
  },

  // ── CÁ NỔI LỚN xa bờ (bổ sung 2026-06-10) ───────────────────────────────
  {
    species: "Cá ngừ chù",
    months: [3, 4, 5, 6, 7, 8, 9],
    regions: ["hoang-sa", "truong-sa-dk1", "nam-trung-bo", "dong-nam-bo"],
    note: "Cá ngừ nhỏ, xuất hiện xuân–hè ở Hoàng Sa, Trường Sa; bắt kèm câu tay ngừ vằn.",
  },
  {
    species: "Cá ngừ ồ",
    months: [11, 12, 1, 2, 3, 4, 5],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo"],
    note: "Đỉnh sản lượng tháng 11–2, bầy nổi ven bờ và quanh rạn, bắt kèm cá thu.",
  },
  {
    species: "Cá ngừ chấm",
    months: [1, 2, 3, 4, 5, 10, 11, 12],
    regions: ["vinh-bac-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Cá ngừ ven bờ (neritic), lưới vây/rê ở vịnh Thái Lan, Đông Nam Bộ, Vịnh Bắc Bộ.",
  },
  {
    species: "Cá cờ (cá cờ buồm)",
    months: [10, 11, 12, 1, 2, 3],
    regions: ["hoang-sa", "truong-sa-dk1", "nam-trung-bo", "dong-nam-bo"],
    note: "Chính vụ đông–xuân ở Hoàng Sa–Trường Sa, câu vàng/câu tay.",
  },
  {
    species: "Cá nục heo",
    months: [3, 4, 5, 6, 7, 8, 9],
    regions: ["hoang-sa", "truong-sa-dk1", "nam-trung-bo", "dong-nam-bo"],
    note: "Nhiều hơn vào xuân–hè, hay tụ quanh phao, rác nổi, vật trôi trên biển.",
  },
  {
    species: "Cá ngân",
    months: [10, 11, 12, 1, 2, 3, 4],
    regions: ["hoang-sa", "truong-sa-dk1", "nam-trung-bo"],
    note: "Khơi xa Hoàng Sa, Trường Sa mùa đông–xuân; câu kéo, câu vàng (không thành đàn lớn).",
  },

  // ── CÁ NỔI NHỎ ven bờ (bổ sung 2026-06-10) ──────────────────────────────
  {
    species: "Cá bạc má",
    months: [1, 2, 3, 9, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Vào mùa gió Đông Bắc cá tập trung dày ở Vịnh Bắc Bộ và Đông Nam Bộ.",
  },
  {
    species: "Cá tráo (mắt to)",
    months: [4, 5, 6, 9, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Đàn nổi sát mặt ăn đèn ban đêm; rộ vụ gió Đông Bắc ở miền Nam, vụ hè ở miền Trung.",
  },
  {
    species: "Cá sòng",
    months: [1, 2, 3, 4, 10, 11, 12],
    regions: ["trung-bo", "nam-trung-bo", "dong-nam-bo", "hoang-sa"],
    note: "Khai thác chính vụ gió Đông Bắc; nhiều ở Quảng Bình, Khánh Hòa, khơi Đông Nam Bộ.",
  },
  {
    species: "Cá lầm",
    months: [4, 5, 6, 7, 8, 9, 10],
    regions: ["trung-bo", "nam-trung-bo", "dong-nam-bo"],
    note: "Đàn rất đông tháng 4–10 ven bờ Trung Bộ (Cù Lao Chàm) và Nam Trung Bộ.",
  },
  {
    species: "Cá đối",
    months: [4, 5, 6, 7, 8, 9, 10],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Ven bờ, cửa sông, đầm phá; bắt nhiều mùa hè khi cá ở tầng mặt ven bờ.",
  },

  // ── MỰC & BẠCH TUỘC (bổ sung 2026-06-10) ────────────────────────────────
  {
    species: "Mực lá",
    months: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["dong-nam-bo", "tay-nam-bo", "nam-trung-bo"],
    note: "Quanh năm ở Côn Đảo, Phú Quốc, rộ tháng 3–10; câu mực đêm và lưới rê ven bờ.",
  },
  {
    species: "Mực nang",
    months: [1, 2, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Loài sống đáy; mùa chính tháng 1–2 ở Vịnh Bắc Bộ, lưới kéo và câu.",
  },
  {
    species: "Bạch tuộc",
    months: [1, 2, 3, 4, 6, 7, 8, 9],
    regions: ["tay-nam-bo", "dong-nam-bo", "nam-trung-bo"],
    note: "Loài đáy, vụ Bắc tháng 1–4, vụ Nam tháng 6–9; nghề lồng bẫy, câu đáy ven bờ.",
  },

  // ── CÁ ĐÁY (lưới kéo) — theo mùa + độ sâu (bổ sung 2026-06-10) ───────────
  {
    species: "Cá mối",
    months: [1, 2, 3, 4, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Cá đáy lưới kéo quanh năm, năng suất cao hơn mùa gió Đông Bắc.",
  },
  {
    species: "Cá đổng (cá lượng)",
    months: [1, 2, 3, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "hoang-sa", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Chủ lực lưới kéo đáy toàn quốc; đàn đông ở dải sâu 50–100 m.",
  },
  {
    species: "Cá phèn",
    months: [3, 4, 5, 6, 9, 10, 11],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Cá đáy đào cát ven bờ <60 m; bắt bằng lưới kéo đôi quanh năm.",
  },
  {
    species: "Cá đù (cá sủ)",
    months: [3, 4, 5, 9, 10, 11],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Đi đàn theo mùa đẻ ở vùng đục cửa sông xuân–thu.",
  },
  {
    species: "Cá khoai",
    months: [5, 6, 7, 8, 9, 10],
    regions: ["vinh-bac-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Mùa gió Tây Nam tập trung đàn lớn ở cửa sông đồng bằng; lưới kéo, lưới rê.",
  },
  {
    species: "Cá chim",
    months: [3, 4, 5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Mùa chính xuân–hè, đi đàn gần đáy bùn; lưới kéo, lưới rê.",
  },
  {
    species: "Cá bơn",
    months: [1, 2, 3, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Cá đáy dẹt vùi cát; lưới kéo đáy quanh năm, nhỉnh hơn mùa Đông Bắc.",
  },

  // ── CÁ RẠN (câu rạn) — gắn rạn, theo mùa (bổ sung 2026-06-10) ────────────
  {
    species: "Cá hồng",
    months: [4, 5, 6, 7, 8, 9, 10],
    regions: ["trung-bo", "hoang-sa", "nam-trung-bo", "truong-sa-dk1", "dong-nam-bo"],
    note: "Cá rạn giá cao, chính vụ T4–T10; câu rạn và lưới rê đáy.",
  },
  {
    species: "Cá mú (cá song)",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["trung-bo", "hoang-sa", "nam-trung-bo", "truong-sa-dk1", "dong-nam-bo"],
    note: "Cá rạn giá cao, vụ chính T4–T9 quanh rạn ven bờ và đảo; câu rạn.",
  },
  {
    species: "Cá kẽm",
    months: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["trung-bo", "hoang-sa", "nam-trung-bo", "truong-sa-dk1"],
    note: "Cá rạn nước trong; câu rạn và lưới rê đáy quanh rạn miền Trung, Phú Quốc.",
  },

  // ── GIÁP XÁC (tôm, ghẹ, cua) — theo mùa + vùng (bổ sung 2026-06-10) ──────
  {
    species: "Tôm bạc (tôm he)",
    months: [11, 12, 1, 2, 3, 4],
    regions: ["tay-nam-bo", "dong-nam-bo", "nam-trung-bo"],
    note: "Chính vụ mùa gió Đông Bắc; lưới kéo đáy Cà Mau, Kiên Giang, Bà Rịa–Vũng Tàu.",
  },
  {
    species: "Tôm sú biển",
    months: [3, 4, 5, 6, 7, 8, 9],
    regions: ["tay-nam-bo", "dong-nam-bo", "nam-trung-bo"],
    note: "Khai thác tự nhiên tập trung T3–9 vùng Cà Mau, Khánh Hòa, Ninh Thuận.",
  },
  {
    species: "Ghẹ xanh",
    months: [7, 8, 9, 10, 11, 12, 1, 2, 3],
    regions: ["tay-nam-bo", "dong-nam-bo", "nam-trung-bo", "trung-bo"],
    note: "Nghề lồng bẫy; nghỉ khai thác mùa sinh sản T4–6, mật độ cao ở Kiên Giang.",
  },
  {
    species: "Cua biển",
    months: [10, 11, 12, 1, 2, 3, 4, 5],
    regions: ["tay-nam-bo", "dong-nam-bo"],
    note: "Cua cửa sông, rừng ngập mặn; bẫy/lưới rê ở Cà Mau, Kiên Giang, Bến Tre.",
  },
];

/** Loài thường gặp tại một vùng trong một tháng (month 1-12). */
export function fishInRegion(
  regionId: FishRegionId,
  month: number
): FishSeason[] {
  return FISH_SEASONS.filter(
    (s) => s.regions.includes(regionId) && s.months.includes(month)
  );
}

/**
 * Vùng chứa một toạ độ (ray casting đơn giản, đa giác tự khép) —
 * null nếu nằm ngoài mọi vùng (vd trên đất liền).
 */
export function regionAt(lat: number, lon: number): FishRegion | null {
  for (const region of FISH_REGIONS) {
    if (pointInPolygon(lon, lat, region.polygon)) return region;
  }
  return null;
}

function pointInPolygon(
  x: number,
  y: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}
