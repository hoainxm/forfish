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
    // "Cá ngừ đại dương" TÁCH 2 LOÀI (2026-07-25): vây vàng + mắt to. Cả hai loài
    // nổi lớn di cư, có mặt QUANH NĂM ở khơi VN (Biển Đông ấm cả 12 tháng) — đổi
    // theo mùa là NGƯ TRƯỜNG + SẢN LƯỢNG, không phải sự hiện diện. Cùng ngư trường
    // (câu vàng/câu tay bắt lẫn nhau), khác biệt chính là TẦNG NƯỚC nên vùng/mùa
    // để giống nhau. Nguồn: RIMF/Thủy sản VN, Báo Khánh Hòa 1/2024 (chính vụ gấp
    // 3–4 lần giữa năm ⇒ giữa năm ≠ 0), SEAFDEC (đỉnh phụ T7–9 Trường Sa),
    // FishBase/WCPFC. (agent khảo cứu 2026-07-25)
    // TÁCH THEO GIÓ MÙA 2026-10-03 (RIMF tinid-143): gió Đông Bắc 10–3 ngư trường
    // 14°–16°30N, 112°–115°E (Hoàng Sa); gió Tây Nam 4–9 ngư trường 6°–11°30N,
    // 108°–113°E (Trường Sa, khơi Đông Nam Bộ). Trung Bộ/Nam Trung Bộ/Trường Sa
    // giữ quanh năm (SGGP: luồng cá 11 âm–3 chủ yếu Trường Sa–DK1; SEAFDEC đỉnh
    // phụ 7–9 Trường Sa). Hoàng Sa 9–4 (vạt đệm cho 6–7 = 0,5, không tắt hẳn).
    species: "Cá ngừ vây vàng",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    regions: ["trung-bo", "nam-trung-bo", "truong-sa-dk1"],
    note: "Có quanh năm ở biển khơi; rộ mùa gió Đông Bắc (khoảng tháng 12–6), câu tay/câu vàng khơi Trung Bộ – Trường Sa. Cá bám tầng mặt, dễ trúng khi biển êm.",
  },
  {
    species: "Cá ngừ vây vàng",
    months: [9, 10, 11, 12, 1, 2, 3, 4],
    regions: ["hoang-sa"],
    note: "Gió Đông Bắc (tháng 10–3, kéo 9–4): ngư trường dịch lên Hoàng Sa, đáy 400–4000 m; hè vẫn có mặt nhưng thưa.",
  },
  {
    species: "Cá ngừ vây vàng",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["dong-nam-bo"],
    note: "Gió Tây Nam (tháng 4–9): ngư trường dịch xuống khơi Đông Nam Bộ (6°–11°30N, 108–113°E), đáy 200–3000 m; Trường Sa – DK1 có quanh năm (SGGP: luồng cá 11 âm–3 chủ yếu Trường Sa).",
  },
  {
    species: "Cá ngừ mắt to",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    regions: ["trung-bo", "nam-trung-bo", "truong-sa-dk1"],
    note: "Có quanh năm, đi cùng ngư trường vây vàng (câu vàng khơi xa Trung Bộ – Trường Sa). Cá ở tầng sâu ban ngày, thường dính câu vàng thả sâu; sản lượng lẫn với vây vàng.",
  },
  {
    species: "Cá ngừ mắt to",
    months: [9, 10, 11, 12, 1, 2, 3, 4],
    regions: ["hoang-sa"],
    note: "Gió Đông Bắc: cùng ngư trường vây vàng ở Hoàng Sa.",
  },
  {
    species: "Cá ngừ mắt to",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["dong-nam-bo"],
    note: "Gió Tây Nam: cùng ngư trường vây vàng ở khơi Đông Nam Bộ.",
  },
  {
    species: "Cá ngừ vằn",
    months: [10, 11, 12, 1, 2, 3],
    regions: ["trung-bo", "nam-trung-bo", "hoang-sa", "truong-sa-dk1"],
    note: "Có quanh năm, rộ mùa gió Đông Bắc (tháng 10–3) ở khơi Trung Bộ – Hoàng Sa – Trường Sa.",
  },
  {
    // THÊM 2026-10-03 (RIMF "Ngư trường, nguồn lợi cá ngừ"): gió Tây Nam cá vằn
    // vào ven bờ Bình Định–Khánh Hoà và Phú Quý; loài chiếm 47–68 % sản lượng
    // lưới vây — hồ sơ cũ chỉ 11–5 nên bỏ trống đúng vụ hè. Cổng cách bờ nới
    // riêng (coastKm [10,25]) để không tắt ô sát bờ.
    species: "Cá ngừ vằn",
    months: [4, 5, 6, 7, 8, 9],
    regions: ["nam-trung-bo", "dong-nam-bo", "truong-sa-dk1"],
    note: "Gió Tây Nam (tháng 4–9): đàn vào ven bờ Bình Định–Khánh Hoà và quanh Phú Quý, lưới vây, câu tay.",
  },
  {
    // 2026-10-03: tàu câu mực xà ra khơi từ 16–20 tháng Giêng âm (RIMF, VOV);
    // CPUE đỉnh tháng 5 (bắc) – 6 (Trường Sa). Khai cũ 4–9 bỏ 2 tháng đầu vụ.
    species: "Mực xà",
    months: [2, 3, 4, 5, 6, 7, 8, 9],
    regions: ["hoang-sa", "truong-sa-dk1"],
    note: "Ngư trường xa bờ trên 150 hải lý, đáy >800 m; vụ chính tháng 2–9, rộ 5–6.",
  },
  {
    // 2026-10-03: RIMF tinid-783 năng suất mực ống VBB đỉnh 8–10, cao nhất
    // tháng 9 (32,96 kg/h); GAM lưới chụp 2018–2023 CPUE đỉnh 9–10. Khai cũ
    // 5–9 cắt đúng tháng đỉnh.
    species: "Mực ống",
    months: [5, 6, 7, 8, 9, 10, 11],
    regions: ["vinh-bac-bo", "trung-bo"],
    note: "Nghề chụp mực, câu mực; mùa 5–11, rộ nhất tháng 8–10.",
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
    months: [7, 8, 10, 11, 12, 1],
    regions: ["tay-nam-bo"],
    note: "Vùng Phú Quốc hai vụ: tháng 7–8 và tháng 10–1 (đẻ rộ 11–1) — nguyên liệu nước mắm; mùa rộ thay đổi theo năm.",
  },
  {
    species: "Cá cơm",
    months: [2, 3, 4, 5],
    regions: ["trung-bo"],
    note: "Quảng Trị – Huế vụ sớm tháng Giêng–Tư âm lịch (báo địa phương, hai nguồn độc lập, 2026-10-03).",
  },
  {
    species: "Cá trích",
    months: [1, 2, 3, 4],
    regions: ["vinh-bac-bo"],
    note: "Rộ đầu xuân (khoảng tháng Giêng tới tháng Ba âm lịch), nước lạnh nhất năm.",
  },
  {
    species: "Cá trích",
    months: [9, 10, 11, 12, 1, 2, 3, 4],
    regions: ["trung-bo"],
    note: "Quảng Nam đánh quanh Cù Lao Chàm từ tháng 9 tới tháng 4 (báo địa phương, 2026-10-03).",
  },
  {
    species: "Cá trích",
    months: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    regions: ["dong-nam-bo"],
    note: "Vùng Vũng Tàu mùa cá trích kéo dài tháng 3–11.",
  },
  {
    species: "Cá thu",
    months: [10, 11, 12, 1, 2, 3],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo"],
    note: "Rộ vụ cá Bắc, được giá dịp giáp Tết.",
  },
  {
    // 2026-10-03: setnet Bích Đầm (Nha Trang) 2005–2016: 68 % sản lượng cá thu
    // vạch rơi vào tháng 4–5, 93 % ở 26–30 °C (Nguyen K.Q. et al.).
    species: "Cá thu",
    months: [2, 3, 4, 5, 6, 7, 8, 9],
    regions: ["nam-trung-bo"],
    note: "Nam Trung Bộ vụ 2–9, rộ tháng 4–5 (đăng, lưới rê Nha Trang).",
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
    regions: ["vinh-bac-bo", "dong-nam-bo", "nam-trung-bo"],
    note: "Có gần quanh năm, rộ vụ cá Nam.",
  },
  {
    species: "Cá chỉ vàng",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    regions: ["tay-nam-bo"],
    note: "Vịnh Thái Lan có quanh năm, đẻ rộ tháng 2–4 (2026-10-03).",
  },
  {
    // SỬA 2026-10-03 (6 báo địa phương nhất quán): VBB có vụ hè 6–7 (Thanh Hoá
    // chính vụ cuối tháng 6) + vụ mùa 9–2; Trung Bộ rộ 12–5 (Quảng Ngãi đầu
    // tháng 11→hết tháng 4 âm) + 9–10; NAM TRUNG BỘ rộ 10–4 (Nhơn Lý), khai cũ
    // 5–10 NGƯỢC 180°; Nam Bộ 3–10 (ĐH Cần Thơ 2014: tháng 3–8; Cà Mau tới 9 âm).
    species: "Ruốc",
    months: [6, 7, 9, 10, 11, 12, 1, 2],
    regions: ["vinh-bac-bo"],
    note: "Vụ chiêm tháng 6–7 và vụ mùa tháng 9–2; bè mảng 5–10 hải lý (Thanh Hoá, Nghệ An).",
  },
  {
    species: "Ruốc",
    months: [12, 1, 2, 3, 4, 5, 9, 10],
    regions: ["trung-bo"],
    note: "Rộ từ cuối năm tới tháng 5, thêm vụ phụ tháng 9–10 (Quảng Bình, Huế, Quảng Ngãi); ruốc nổi dày sau bão khi biển lặng lại.",
  },
  {
    species: "Ruốc",
    months: [10, 11, 12, 1, 2, 3, 4],
    regions: ["nam-trung-bo"],
    note: "Bình Định (Nhơn Lý) rộ tháng 9–10 âm tới tháng 2–3 âm; sâu 5–7 m ven gành — nghề te, dạ.",
  },
  {
    species: "Ruốc",
    months: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["dong-nam-bo", "tay-nam-bo"],
    note: "Nam Bộ vụ tháng 3–10, lưới đáy xa bờ 1,5–10 km cho năng suất cao hơn.",
  },

  // ── CÁ NỔI LỚN xa bờ (bổ sung 2026-06-10) ───────────────────────────────
  {
    species: "Cá ngừ chù",
    months: [3, 4, 5, 6, 7, 8, 9],
    regions: ["hoang-sa", "truong-sa-dk1", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Cá ngừ nhỏ, xuất hiện xuân–hè ở Hoàng Sa, Trường Sa; bắt kèm câu tay ngừ vằn.",
  },
  {
    // Sửa 2026-09-30: khai cũ 11–5 NGƯỢC mùa (biên bản kiểm cá ngừ 2026-07-28,
    // 01-product). Nguồn VN: rộ tháng 3–8; Nhơn Lý (Quy Nhơn) rộ khoảng tháng
    // 5–6 DL; Đức Phổ (Quảng Ngãi) trúng ngừ ồ gần bờ tháng 9. Ngoài vụ vẫn có
    // lác đác quanh năm.
    // Tháng 10 (bà con còn đánh): KHÔNG khai thêm — luật nới vụ chung 2026-10-03
    // (SEASON_FULL_PAD_MONTHS) đã cho tháng 2 và 10 đủ điểm; 1 và 11 = 0,5;
    // tháng 12 = 0 (giữa đông). Lịch này giữ đúng nghĩa "tháng RỘ".
    species: "Cá ngừ ồ",
    months: [3, 4, 5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo"],
    note: "Rộ tháng 3–9; đàn nổi gần bờ và quanh đảo theo đàn cá cơm — lưới vây, lưới rút, rê. Khác cá ngừ chù.",
  },
  {
    species: "Cá ngừ chấm",
    months: [1, 2, 3, 4, 5, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Cá ngừ ven bờ (neritic), lưới vây/rê ở vịnh Thái Lan, Đông Nam Bộ, Vịnh Bắc Bộ. Tháng rộ chưa có nguồn VN (2026-10-03).",
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
    // SỬA 2026-10-03: NĐ 37/2024 PLV mục 29 "cá ngân" = Atule mate — cá nổi NHỎ
    // ven bờ 1–80 m, ăn zooplankton (FishBase). Hồ sơ cũ mô tả "cá khơi câu
    // kéo Hoàng Sa" KHÔNG khớp loài nào; nếu đội từng muốn loài khác (cá bè
    // Elagatis?) thì tên đã nhầm — chờ BA. Tháng rộ chưa có nguồn → quanh năm.
    species: "Cá ngân",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Cá nổi nhỏ ven bờ 1–80 m, đàn gần rạn và cửa vịnh; lưới vây, lưới rê. Tháng rộ chưa có nguồn.",
  },

  // ── CÁ NỔI NHỎ ven bờ (bổ sung 2026-06-10) ──────────────────────────────
  {
    species: "Cá bạc má",
    months: [1, 2, 3, 9, 10, 11, 12],
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Vào mùa gió Đông Bắc cá tập trung dày ở Vịnh Bắc Bộ và Đông Nam Bộ.",
  },
  {
    // THÊM 2026-10-03 (RIMF, ĐH Cần Thơ 2020): đỉnh đẻ 3–6, tháng 4 cá VBB vào bờ.
    species: "Cá bạc má",
    months: [3, 4, 5, 6],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Vụ xuân–hè theo đỉnh đẻ tháng 3–6; tháng 4 cá Vịnh Bắc Bộ vào gần bờ.",
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
    // THÊM 2026-10-03: "cá sòng" gộp sòng gió (Megalaspis cordyla, vụ Đông Bắc)
    // và sòng nhật (Trachurus japonicus, loài VBB, RIMF 2006–2013 CPUE đỉnh
    // tháng 7). Chưa tách hồ sơ (schema/UI) — thêm vụ hè VBB.
    species: "Cá sòng",
    months: [5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo"],
    note: "Sòng nhật Vịnh Bắc Bộ vụ hè 5–9, đỉnh tháng 7 (lưới kéo, vây).",
  },
  {
    species: "Cá lầm",
    months: [4, 5, 6, 7, 8, 9, 10],
    regions: ["trung-bo", "nam-trung-bo", "dong-nam-bo"],
    note: "Đàn rất đông tháng 4–10 ven bờ Trung Bộ (Cù Lao Chàm) và Nam Trung Bộ.",
  },
  // "Cá đối" RÚT 2026-10-03: loài cửa sông/đầm phá 0–10 m, catadromous — ô biển
  // 0,25° không chứa sinh cảnh, front/xoáy/D20 vô nghĩa (tiêu chí "không nói
  // dối bà con"). Vẫn có trong danh bạ chợ (market-channels).

  // ── MỰC & BẠCH TUỘC (bổ sung 2026-06-10) ────────────────────────────────
  {
    species: "Mực lá",
    months: [3, 4, 5, 6, 7, 8, 9, 10],
    regions: ["dong-nam-bo", "tay-nam-bo", "nam-trung-bo"],
    note: "Quanh năm ở Côn Đảo, Phú Quốc, rộ tháng 3–10; câu mực đêm và lưới rê ven bờ.",
  },
  {
    species: "Mực nang",
    months: [11, 12, 1, 2, 3],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Loài sống đáy; VBB mùa 11–3, đỉnh tháng 1–2 (đẻ 1–3 vào bờ, RIMF); vùng khác chưa có nguồn.",
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
    regions: ["vinh-bac-bo", "trung-bo", "nam-trung-bo", "dong-nam-bo", "tay-nam-bo"],
    note: "Chủ lực lưới kéo đáy toàn quốc; đáy bùn cát 10–200 m, CPUE cao nhất <50 m, mùa đông ra 50–100 m.",
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
    species: "Cá đù (cá sủ)",
    months: [6, 7, 8, 9, 10],
    regions: ["dong-nam-bo", "tay-nam-bo"],
    note: "Mùa mưa mật độ cao ở cửa sông Cà Mau (ĐH Cần Thơ, 2026-10-03).",
  },
  {
    // SỬA 2026-10-03: vụ chính Thái Bình–Quảng Bình là tháng 9–12 ÂM (báo, 2 bài
    // độc lập; FishBase xác nhận dồn cửa sông theo gió mùa). Khai cũ 5–10 tắt
    // loài đúng vụ.
    species: "Cá khoai",
    months: [10, 11, 12, 1, 2, 3],
    regions: ["vinh-bac-bo", "trung-bo", "dong-nam-bo"],
    note: "Vụ chính mùa lạnh tháng 10–3, đàn dồn cửa sông Bắc Bộ – Bắc Trung Bộ; lưới kéo, lưới rê.",
  },
  {
    species: "Cá khoai",
    months: [4, 5],
    regions: ["tay-nam-bo", "dong-nam-bo"],
    note: "Nam Bộ rộ tháng 3–4 âm lịch.",
  },
  {
    species: "Cá chim",
    months: [3, 4, 5, 6, 7, 8, 9, 10],
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
    regions: ["vinh-bac-bo", "trung-bo", "hoang-sa", "nam-trung-bo", "truong-sa-dk1", "dong-nam-bo"],
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
    regions: ["vinh-bac-bo", "trung-bo", "hoang-sa", "nam-trung-bo", "truong-sa-dk1"],
    note: "Rạn, mỏm đá và đáy mềm vịnh kín 1–50 m, chịu nước đục; câu rạn, lưới rê đáy, có trong lưới kéo Vịnh Bắc Bộ.",
  },

  // ── GIÁP XÁC (tôm, ghẹ, cua) — theo mùa + vùng (bổ sung 2026-06-10) ──────
  {
    species: "Tôm bạc (tôm he)",
    months: [11, 12, 1, 2, 3, 4],
    regions: ["tay-nam-bo", "dong-nam-bo", "nam-trung-bo"],
    note: "Tôm bạc thẻ (F. merguiensis, gộp tôm he ven bờ); vụ gió Đông Bắc — chưa có nguồn theo tháng (2026-10-03).",
  },
  {
    // THÊM 2026-10-03: VBB trữ lượng tôm mùa Tây Nam 5.116 t gấp đôi Đông Bắc
    // 2.494 t (VJAS 1087); Nam Bộ RIMF 2007–08 có cả hai mùa.
    species: "Tôm bạc (tôm he)",
    months: [5, 6, 7, 8, 9],
    regions: ["vinh-bac-bo", "tay-nam-bo", "dong-nam-bo"],
    note: "Mùa gió Tây Nam năng suất lưới kéo tôm cao hơn Đông Bắc ở Vịnh Bắc Bộ; đáy bùn 10–55 m, thường ≤20 m.",
  },
  {
    // SỬA 2026-10-03 (Frontiers Mar. Sci. 2024): tôm sú thương phẩm hầu hết là
    // nuôi; nghề tự nhiên còn lại = bắt tôm BỐ MẸ ở Bãi Cạn (7°00–8°45N,
    // 103–105°E, sâu 45–55 m), đỉnh 9–2; nghề Khánh Hoà/Ninh Thuận đã cạn.
    // Khai cũ 3–9 NGƯỢC mùa.
    species: "Tôm sú biển",
    months: [9, 10, 11, 12, 1, 2],
    regions: ["tay-nam-bo"],
    note: "Tôm sú bố mẹ tự nhiên ở Bãi Cạn (Cà Mau), đáy cát bùn 45–55 m, lưới rê ba lớp; rộ tháng 9–2.",
  },
  {
    // SỬA 2026-10-03 (RIMF/WWF 2013, Seafood Watch 2023): Kiên Giang chính vụ
    // 4–8 (CPUE lồng đỉnh tháng 5, lưới rê đỉnh tháng 7); khai cũ TẮT đúng chính
    // vụ. Lệnh cấm 1/4–30/6 chỉ áp trong 3 hải lý ven bờ (QĐ 13/2022 Kiên Giang).
    species: "Ghẹ xanh",
    months: [4, 5, 6, 7, 8, 9, 10, 11],
    regions: ["tay-nam-bo", "dong-nam-bo", "nam-trung-bo", "trung-bo"],
    note: "Nghề lồng bẫy; chính vụ tháng 4–8, có quanh năm. Kiên Giang cấm bắt ghẹ 1/4–30/6 trong 3 hải lý ven bờ — ngoài vùng cấm vẫn là chính vụ.",
  },
  // "Cua biển" RÚT 2026-10-03: sống trong rừng ngập mặn/kênh rạch cửa sông
  // (Vũ Ngọc Út 2002; Le Vay 2001), ~40.000 t/năm là nuôi; bắt tự nhiên bằng
  // câu/rập/móc hang — không phải nghề đi biển. Ô 0,25° ngoài biển không chứa
  // sinh cảnh ⇒ vẽ điểm nóng là nói dối bà con.
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
 * NỚI VỤ (chủ dự án chốt 2026-10-03 "nới vụ ra", áp MỌI loài): số tháng sát
 * vụ vẫn tính ĐỦ điểm. Lịch mùa vụ khai tháng RỘ; cá có mặt trước/sau rộ —
 * bản cũ (0 tháng đệm đủ) làm loài tắt ngúm đúng lúc bà con còn đánh (ngừ ồ
 * đầu tháng 10 bị ×0,5 ⇒ bản đồ trống).
 */
export const SEASON_FULL_PAD_MONTHS = 1;
/**
 * Độ rộng vạt dốc SAU phần đệm đủ: với 2 thì cách vụ 2 tháng = 0,5, cách 3
 * tháng = 0. Vẫn có điểm 0: loài trái vụ hẳn không hiện (KHÔNG quanh năm).
 */
export const SEASON_TAPER_MONTHS = 2;

/**
 * PRIOR MÙA VỤ MỀM ∈ [0,1] cho một loài ở một tháng — THAY cổng nhị phân cũ
 * (trong vụ = 1, ngoài vụ = 0, điểm NHẢY VÁCH ở ranh giới tháng). Quy tắc:
 *   · tháng chính vụ + SEASON_FULL_PAD_MONTHS tháng sát hai đầu → 1
 *   · xa hơn                    → giảm tuyến tính (đầu/cuối vụ, khả năng thấp hơn)
 *   · ngoài vụ hẳn              → 0
 * Khoảng cách tính VÒNG TRÒN (tháng 12 nối tháng 1). Loài có mặt QUANH NĂM
 * (đủ 12 tháng, vd cá ngừ) → luôn 1, không đổi.
 *
 * Đây CHỈ mã hoá độ bất định ở ranh giới tốt hơn cổng cứng — KHÔNG bịa đường
 * cong sản lượng theo loài (muốn đường cong thật phải học từ CPUE, chưa có).
 */
export function seasonPrior(months: number[], month: number): number {
  if (months.length === 0) return 0;
  if (months.includes(month)) return 1;
  let dmin = Infinity;
  for (const m of months) {
    const raw = Math.abs(m - month);
    const d = Math.min(raw, 12 - raw); // vòng tròn 12 tháng
    if (d < dmin) dmin = d;
  }
  if (dmin <= SEASON_FULL_PAD_MONTHS) return 1;
  return Math.max(0, 1 - (dmin - SEASON_FULL_PAD_MONTHS) / SEASON_TAPER_MONTHS);
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

/**
 * Vùng GẦN NHẤT một toạ độ — luôn trả về một vùng nếu điểm còn TRONG TẦM
 * vùng biển VN (≤ `maxDeg` độ tới đa giác vùng gần nhất), KHÔNG còn lỗ hổng
 * giữa 7 đa giác thô. null nếu xa hẳn mọi vùng (ngoài vùng biển VN / nước
 * ngoài). Dùng để gán LOÀI cho mọi ô biển khi tính dự báo cá toàn vùng —
 * thay cho việc chỉ tính trong các đa giác khoanh sẵn (vốn bỏ trắng phần lớn
 * biển). Vùng chỉ còn là BỘ LỌC loài theo mùa, không phải giới hạn tính toán.
 */
export function nearestRegionWithin(
  lat: number,
  lon: number,
  maxDeg: number
): FishRegion | null {
  // nằm hẳn trong một vùng → dùng vùng đó
  const inside = regionAt(lat, lon);
  if (inside) return inside;
  // không thì gán vùng có CẠNH gần nhất, nếu còn trong tầm
  let best: FishRegion | null = null;
  let bd = Infinity;
  for (const region of FISH_REGIONS) {
    const d = distanceToPolygonDeg(lon, lat, region.polygon);
    if (d < bd) {
      bd = d;
      best = region;
    }
  }
  return bd <= maxDeg ? best : null;
}

/**
 * Khoảng cách (độ, mặt phẳng lon/lat như phần còn lại của file) từ một điểm tới
 * ĐA GIÁC — đo tới CẠNH gần nhất, không phải tới ĐỈNH gần nhất.
 *
 * VÌ SAO (sửa 2026-07-26): bản cũ quét từng ĐỈNH bằng `Math.hypot`. Đa giác vùng
 * chỉ có 7–9 đỉnh nên cạnh rất DÀI (có cạnh > 1,4°); một ô nằm sát GIỮA cạnh dài
 * của vùng A vẫn bị gán vùng B chỉ vì B tình cờ có một đỉnh nhô ra gần hơn.
 * Ví dụ đã xác minh: (10,75°N; 107,75°E) khơi Vũng Tàu — cách cạnh bắc Đông Nam
 * Bộ 0,55° nhưng cách đỉnh gần nhất của nó 0,85°, trong khi Nam Trung Bộ có đỉnh
 * cách 0,75° ⇒ bản cũ gán nhầm `nam-trung-bo`. Sai vùng ⇒ sai bộ lọc loài, và ô
 * quá `maxDeg` tới mọi ĐỈNH mà vẫn sát một CẠNH thì bị BỎ HẲN khỏi bản đồ.
 *
 * Điểm nằm TRONG đa giác vẫn trả khoảng cách tới cạnh (≥ 0) — `nearestRegionWithin`
 * đã lọc ca "nằm trong" bằng `regionAt` trước khi gọi, nên ý nghĩa `maxDeg` (tầm
 * với tính từ MÉP vùng) giữ nguyên như trước.
 */
export function distanceToPolygonDeg(
  x: number,
  y: number,
  polygon: [number, number][]
): number {
  let best = Infinity;
  // đa giác không khép điểm cuối → cạnh cuối nối đỉnh cuối về đỉnh đầu
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d = pointToSegmentDeg(x, y, polygon[j], polygon[i]);
    if (d < best) best = d;
  }
  return best;
}

/** Khoảng cách từ điểm (x,y) tới ĐOẠN THẲNG a→b (không phải đường thẳng vô hạn) */
function pointToSegmentDeg(
  x: number,
  y: number,
  a: [number, number],
  b: [number, number]
): number {
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  // đoạn suy biến thành một điểm
  if (len2 === 0) return Math.hypot(x - ax, y - ay);
  // chiếu điểm lên đoạn rồi KẸP về [0,1] để không rơi ra ngoài hai đầu mút
  let t = ((x - ax) * dx + (y - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
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
