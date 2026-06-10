// Doanh nghiệp thu mua / chế biến / xuất khẩu thủy sản — tổng hợp THAM KHẢO từ
// nguồn công khai (VASEP, web doanh nghiệp; liệt kê URL). KHÔNG phải danh bạ liên
// hệ trực tiếp — bà con/đại lý SDVICO cần xác minh trước khi giao dịch. (ngày: 2026-06-10)
//
// MỤC ĐÍCH: để bà con biết AI mua, Ở ĐÂU, MUA LOÀI GÌ — bán thẳng cho nhà máy
// chế biến/xuất khẩu (hoặc qua đại lý của họ) thay vì chỉ bán cho nậu vựa địa phương.
//
// TÊN TỈNH: dùng tên SAU SÁP NHẬP 2025 để khớp src/data/fishing-ports.ts. Ví dụ:
//   Bình Định → Gia Lai; Phú Yên → Đắk Lắk; Sóc Trăng/Hậu Giang → Cần Thơ;
//   Kiên Giang → An Giang; Bạc Liêu → Cà Mau; Tiền Giang → Đồng Tháp;
//   Bến Tre/Trà Vinh → Vĩnh Long; Bà Rịa-Vũng Tàu → TP. Hồ Chí Minh;
//   Bình Thuận → Lâm Đồng; Quảng Bình → Quảng Trị. Tỉnh cũ ghi trong note để dễ tra.
//
// LƯU Ý QUAN TRỌNG: nhiều nhà máy lớn (cá ngừ, cá tra) mua nguyên liệu CHỦ YẾU
// qua đại lý/vùng nuôi/nhập khẩu, KHÔNG mua lẻ tại cầu cảng. Cột "direct" chỉ đánh
// dấu khi có cơ sở công khai cho thấy có thu mua trực tiếp từ tàu/cảng; còn lại để
// trống (chưa rõ) — bà con cần hỏi đại lý thu mua của doanh nghiệp đó.
//
// NGUỒN TỔNG HỢP (tra cứu 06/2026):
//  · VASEP — Hiệp hội Chế biến và XK Thủy sản VN, danh bạ hội viên + bảng xếp hạng:
//      https://vasep.com.vn/  |  https://vasep.com.vn/hoi-vien/thong-tin
//  · Top DN xuất khẩu tôm 2024/2025 (Stapimex, Minh Phú, Sao Ta, CASES…):
//      https://thuysanvietnam.com.vn/top-doanh-nghiep-xuat-khau-tom-hang-dau-nam-2025/
//      https://mekongasean.vn/top-5-doanh-nghiep-xuat-khau-tom-lon-nhat-nam-2024-37717.html
//  · Top DN xuất khẩu cá tra (Vĩnh Hoàn, Nam Việt, IDI, Biển Đông, Vạn Đức):
//      https://vasep.com.vn/san-pham-xuat-khau/ca-tra/doanh-nghiep
//      https://mekongasean.vn/vinh-hoan-la-doanh-nghiep-xuat-khau-ca-tra-lon-nhat-trong-9-thang-dau-nam-34737.html
//  · Tập đoàn Hải Vương — đế chế cá ngừ lớn nhất VN (Havuco, Tuna Vietnam…):
//      https://vasep.com.vn/san-pham-xuat-khau/ca-ngu/doanh-nghiep/giai-ma-tap-doan-hai-vuong-de-che-ca-ngu-xuat-khau-va-ca-pelagic-lon-nhat-viet-nam-24362.html
//  · Bidifisco (Thủy sản Bình Định):
//      https://vasep.com.vn/hoi-vien/thong-tin/cong-ty-cp-thuy-san-binh-dinh-65.html
//  · Mực/bạch tuộc — top DN XK sang TQ 2023 (An Khang Thịnh, Gia Bảo, Bardo):
//      https://thuysanvietnam.com.vn/top-5-doanh-nghiep-xuat-khau-muc-bach-tuoc-lon-nhat-sang-trung-quoc-nam-2023/
//  · Surimi/chả cá miền Bắc (CB TS XK Hạ Long, Sông Việt Thanh Hóa, Hòa Thắng):
//      https://thuysanvietnam.com.vn/xuat-khau-muc-giam-sau-dn-san-xuat-cam-chung/
//  · Việt Úc Bạc Liêu — nhà máy chế biến tôm khép kín:
//      https://thuysanvietnam.com.vn/viet-uc-khanh-thanh-nha-may-che-bien-thuy-san-khep-kin-chuoi-gia-tri-nganh-tom/
//  · Hồng Ngọc, Bắc Trung Nam (hội viên VASEP):
//      https://vasep.com.vn/hoi-vien/thong-tin/cong-ty-tnhh-thuy-san-hong-ngoc-358.html
//      https://vasep.com.vn/hoi-vien/thong-tin/cong-ty-co-phan-thuy-san-bac-trung-nam-365.html
//  Chỗ nào nguồn mỏng (đặc biệt mực/bạch tuộc, surimi, miền Bắc) đã ghi rõ trong
//  docs/research/07-nha-may-thu-mua.md. Website lấy từ trang chính thức nếu có.

export type BuyerKind =
  | "che_bien_xk"     // nhà máy chế biến / xuất khẩu tổng hợp
  | "thu_mua"         // chủ yếu thu mua / sơ chế
  | "ca_ngu"          // chuyên cá ngừ
  | "tom"             // chuyên tôm
  | "ca_tra"          // chuyên cá tra
  | "muc_bach_tuoc"   // chuyên mực, bạch tuộc
  | "khac";

export interface SeafoodBuyer {
  id: string;
  name: string;
  kind?: BuyerKind;
  province?: string;          // tên tỉnh SAU sáp nhập 2025 (khớp fishing-ports.ts)
  species: string[];          // loài thu mua chính, tiếng Việt đời thường
  markets?: string[];         // "EU","Mỹ","Nhật","TQ","Hàn","Nội địa"…
  direct?: boolean;           // có thu mua trực tiếp từ tàu/cảng không (nếu biết)
  website?: string;
  note?: string;              // "tham khảo" + tỉnh cũ + cách thu mua nếu biết
}

export const SEAFOOD_BUYERS: SeafoodBuyer[] = [
  // ───────────────────────── CÁ NGỪ — Nam Trung Bộ ─────────────────────────
  {
    id: "hai-vuong-havuco",
    name: "Công ty TNHH Hải Vương (Havuco) — Tập đoàn Hải Vương",
    kind: "ca_ngu",
    province: "Khánh Hòa",
    species: ["Cá ngừ đại dương", "Cá ngừ sọc dưa (cá ngừ vằn)", "Cá biển nổi (pelagic)"],
    markets: ["EU", "Mỹ", "Nhật", "Trung Đông"],
    website: "https://havuco.com.vn",
    note: "Tham khảo. DN xuất khẩu cá ngừ lớn nhất VN, trụ sở Cam Lâm, Khánh Hòa. Phần lớn nguyên liệu nhập khẩu + mua qua đầu mối; có thu mua cá ngừ trong nước qua đại lý.",
  },
  {
    id: "tuna-vietnam",
    name: "Công ty TNHH Cá Ngừ Việt Nam (Tuna Vietnam) — thuộc Hải Vương",
    kind: "ca_ngu",
    province: "Khánh Hòa",
    species: ["Cá ngừ đại dương", "Cá ngừ sọc dưa (cá ngừ vằn)"],
    markets: ["EU", "Mỹ", "Nhật"],
    note: "Tham khảo. Thành viên hệ sinh thái Hải Vương, top 10 XK cá ngừ VN (theo VASEP).",
  },
  {
    id: "bidifisco",
    name: "Công ty CP Thủy sản Bình Định (Bidifisco)",
    kind: "ca_ngu",
    province: "Gia Lai",
    species: ["Cá ngừ đại dương", "Cá ngừ vằn", "Cá thu", "Cá cờ (marlin)", "Cá nục heo (mahi)"],
    markets: ["EU", "Mỹ", "Nhật"],
    direct: true,
    website: "https://bidifisco.com.vn",
    note: "Tham khảo. Tỉnh cũ: Bình Định (Quy Nhơn). Có thu mua cá ngừ đại dương trực tiếp từ tàu/cảng Quy Nhơn, công suất ~5.000 tấn/năm.",
  },
  {
    id: "foodtech-tin-thinh",
    name: "Công ty CP Bá Hải / Foodtech (chế biến cá ngừ Phú Yên)",
    kind: "ca_ngu",
    province: "Đắk Lắk",
    species: ["Cá ngừ đại dương", "Cá ngừ vằn"],
    markets: ["EU", "Nhật", "Mỹ"],
    direct: true,
    note: "Tham khảo. Tỉnh cũ: Phú Yên — cái nôi nghề câu cá ngừ đại dương. Thu mua từ tàu câu tay tại cảng Đông Tác/Phú Lạc. Cần xác minh pháp nhân/tên chính xác qua VASEP.",
  },
  {
    id: "hai-nam",
    name: "Công ty TNHH Hải Nam",
    kind: "che_bien_xk",
    province: "Lâm Đồng",
    species: ["Cá ngừ", "Mực", "Bạch tuộc", "Cá biển", "Tôm"],
    markets: ["EU", "Nhật", "Hàn", "Mỹ"],
    website: "https://hainam.com.vn",
    note: "Tham khảo. Tỉnh cũ: Bình Thuận (Phan Thiết). Hội viên VASEP, chế biến hải sản tổng hợp.",
  },

  // ───────────────────────── TÔM — Đồng bằng sông Cửu Long ─────────────────
  {
    id: "minh-phu",
    name: "Công ty CP Tập đoàn Thủy sản Minh Phú",
    kind: "tom",
    province: "Cà Mau",
    species: ["Tôm sú", "Tôm thẻ chân trắng"],
    markets: ["Mỹ", "Nhật", "EU", "Hàn"],
    website: "https://minhphu.com",
    note: "Tham khảo. 'Vua tôm' VN, top XK tôm. Nguyên liệu chủ yếu từ vùng nuôi + đại lý; thu mua tôm nuôi qua hệ thống đại lý/ao liên kết.",
  },
  {
    id: "minh-phu-hau-giang",
    name: "Công ty CP Thủy sản Minh Phú Hậu Giang",
    kind: "tom",
    province: "Cần Thơ",
    species: ["Tôm sú", "Tôm thẻ chân trắng"],
    markets: ["Mỹ", "Nhật", "EU"],
    website: "https://minhphu.com",
    note: "Tham khảo. Tỉnh cũ: Hậu Giang. Nhà máy lớn của Minh Phú, top 3 XK tôm.",
  },
  {
    id: "stapimex",
    name: "Công ty CP Thủy sản Sóc Trăng (Stapimex)",
    kind: "tom",
    province: "Cần Thơ",
    species: ["Tôm thẻ chân trắng", "Tôm sú"],
    markets: ["Mỹ", "Nhật", "EU"],
    website: "https://stapimex.com.vn",
    note: "Tham khảo. Tỉnh cũ: Sóc Trăng. Dẫn đầu XK tôm 2025 (~310 triệu USD). Thu mua tôm nuôi qua đại lý vùng.",
  },
  {
    id: "sao-ta-fimex",
    name: "Công ty CP Thực phẩm Sao Ta (Fimex VN)",
    kind: "tom",
    province: "Cần Thơ",
    species: ["Tôm thẻ chân trắng", "Tôm sú"],
    markets: ["Mỹ", "Nhật", "EU"],
    website: "https://fimexvn.com",
    note: "Tham khảo. Tỉnh cũ: Sóc Trăng. Top XK tôm, có vùng nuôi riêng + thu mua qua đại lý.",
  },
  {
    id: "cases-ca-mau",
    name: "Công ty CP Chế biến & Dịch vụ Thủy sản Cà Mau (CASES)",
    kind: "tom",
    province: "Cà Mau",
    species: ["Tôm sú", "Tôm thẻ chân trắng"],
    markets: ["Mỹ", "Nhật", "EU"],
    note: "Tham khảo. Tỉnh Cà Mau. Top 5 XK tôm 2024 (~180 triệu USD).",
  },
  {
    id: "camimex",
    name: "Công ty CP Camimex Group",
    kind: "tom",
    province: "Cà Mau",
    species: ["Tôm sú", "Tôm sinh thái (rừng ngập mặn)", "Tôm thẻ"],
    markets: ["EU", "Nhật", "Mỹ"],
    website: "https://camimex.com.vn",
    note: "Tham khảo. Tỉnh Cà Mau. Mạnh tôm sú sinh thái/hữu cơ, liên kết vùng nuôi rừng ngập mặn.",
  },
  {
    id: "viet-uc-bac-lieu",
    name: "Công ty CP Thủy sản Việt Úc (nhà máy Bạc Liêu)",
    kind: "tom",
    province: "Cà Mau",
    species: ["Tôm thẻ chân trắng", "Tôm sú"],
    markets: ["Mỹ", "Nhật", "EU"],
    website: "https://vietuc.com",
    note: "Tham khảo. Tỉnh cũ: Bạc Liêu (Nhà Mát). Chuỗi khép kín tôm giống–nuôi–chế biến.",
  },
  {
    id: "fimex-tom-viet",
    name: "Công ty CP Chế biến XK Tôm Việt",
    kind: "tom",
    province: "Cần Thơ",
    species: ["Tôm thẻ", "Tôm sú"],
    markets: ["Nhật", "Mỹ", "EU"],
    note: "Tham khảo. Hội viên VASEP (khu vực ĐBSCL). Cần xác minh địa chỉ chính xác.",
  },

  // ───────────────────────── CÁ TRA — ĐBSCL ────────────────────────────────
  {
    id: "vinh-hoan",
    name: "Công ty CP Vĩnh Hoàn",
    kind: "ca_tra",
    province: "Đồng Tháp",
    species: ["Cá tra"],
    markets: ["Mỹ", "EU", "Anh", "TQ"],
    website: "https://vinhhoan.com",
    note: "Tham khảo. Tỉnh Đồng Tháp. DN XK cá tra lớn nhất VN. Vùng nuôi riêng + thu mua cá tra nguyên liệu qua hộ nuôi liên kết.",
  },
  {
    id: "nam-viet-anv",
    name: "Công ty CP Nam Việt (Navico / ANV)",
    kind: "ca_tra",
    province: "An Giang",
    species: ["Cá tra"],
    markets: ["TQ", "EU", "Mỹ", "ASEAN"],
    website: "https://navicorp.com.vn",
    note: "Tham khảo. Tỉnh An Giang. Top XK cá tra, vùng nuôi lớn + thu mua hộ nuôi.",
  },
  {
    id: "idi-corp",
    name: "Công ty CP Đầu tư & Phát triển Đa Quốc Gia (IDI)",
    kind: "ca_tra",
    province: "Đồng Tháp",
    species: ["Cá tra"],
    markets: ["TQ", "Mỹ Latinh", "ASEAN", "EU"],
    website: "https://idicorp.com.vn",
    note: "Tham khảo. Tỉnh cũ: Đồng Tháp (Sa Đéc / Lấp Vò). Thuộc Sao Mai Group, top XK cá tra.",
  },
  {
    id: "bien-dong-seafood",
    name: "Công ty TNHH Thủy sản Biển Đông",
    kind: "ca_tra",
    province: "Cần Thơ",
    species: ["Cá tra"],
    markets: ["Mỹ", "EU"],
    note: "Tham khảo. Cần Thơ. Top DN XK cá tra (theo VASEP), thường được hưởng thuế suất ưu đãi vào Mỹ.",
  },
  {
    id: "van-duc-tien-giang",
    name: "Công ty CP Chế biến Thực phẩm Vạn Đức Tiền Giang",
    kind: "ca_tra",
    province: "Đồng Tháp",
    species: ["Cá tra"],
    markets: ["Mỹ", "EU"],
    note: "Tham khảo. Tỉnh cũ: Tiền Giang. Top DN XK cá tra (theo VASEP).",
  },

  // ───────────────────────── MỰC, BẠCH TUỘC, HẢI SẢN HỖN HỢP ───────────────
  {
    id: "an-khang-thinh",
    name: "Công ty TNHH An Khang Thịnh",
    kind: "muc_bach_tuoc",
    province: "Thành phố Hồ Chí Minh",
    species: ["Mực ống", "Mực nang", "Bạch tuộc", "Cá khô", "Surimi"],
    markets: ["TQ", "Hàn", "Nhật"],
    note: "Tham khảo. Tỉnh cũ: Bà Rịa - Vũng Tàu. Top DN XK mực/bạch tuộc sang TQ; lâu năm, có sấy khô + surimi.",
  },
  {
    id: "gia-bao-seafood",
    name: "Công ty Thủy sản Gia Bảo",
    kind: "muc_bach_tuoc",
    province: "Thành phố Hồ Chí Minh",
    species: ["Mực", "Bạch tuộc"],
    markets: ["TQ", "Hàn"],
    note: "Tham khảo. Khu vực Nam Bộ. Top 3 DN XK mực/bạch tuộc sang TQ 2023. Cần xác minh tỉnh chính xác.",
  },
  {
    id: "bardo-foods",
    name: "Công ty Thực phẩm Bardo",
    kind: "muc_bach_tuoc",
    province: "Thành phố Hồ Chí Minh",
    species: ["Mực", "Bạch tuộc"],
    markets: ["TQ", "Hàn", "Nhật"],
    note: "Tham khảo. Top 3 DN XK mực/bạch tuộc sang TQ 2023. Cần xác minh địa chỉ.",
  },
  {
    id: "hai-san-binh-minh",
    name: "Công ty TNHH Hải Sản Bình Minh",
    kind: "che_bien_xk",
    province: "Lâm Đồng",
    species: ["Cá biển", "Mực", "Cá ngừ"],
    markets: ["Nhật", "EU", "Hàn"],
    website: "https://haisanbinhminh.vn",
    note: "Tham khảo. Tỉnh cũ: Bình Thuận. Chế biến hải sản, hội viên ngành.",
  },
  {
    id: "hong-ngoc-seafood",
    name: "Công ty TNHH Thủy sản Hồng Ngọc",
    kind: "che_bien_xk",
    province: "Thành phố Hồ Chí Minh",
    species: ["Mực", "Bạch tuộc", "Cá biển", "Tôm"],
    markets: ["Nhật", "Hàn", "EU"],
    note: "Tham khảo. Hội viên VASEP. Cần xác minh tỉnh/địa chỉ qua danh bạ VASEP.",
  },

  // ───────────────────────── SURIMI / CHẢ CÁ ───────────────────────────────
  {
    id: "cb-ts-xk-ha-long",
    name: "Công ty CP Chế biến Thủy sản XK Hạ Long",
    kind: "che_bien_xk",
    province: "Thành phố Hải Phòng",
    species: ["Chả cá / surimi", "Cá biển", "Mực", "Bạch tuộc", "Tôm"],
    markets: ["TQ", "Hàn", "Đài Loan", "Nhật", "Mỹ", "EU"],
    note: "Tham khảo. Miền Bắc. Nhà cung cấp hải sản đông lạnh & chế biến (chả cá, há cảo, cá tẩm) lớn ở phía Bắc.",
  },
  {
    id: "song-viet-thanh-hoa",
    name: "Công ty CP Sông Việt Thanh Hóa",
    kind: "che_bien_xk",
    province: "Thanh Hóa",
    species: ["Chả cá / surimi", "Bột cá"],
    markets: ["Nhật", "Malaysia", "Indonesia", "Thái Lan", "EU"],
    note: "Tham khảo. Thanh Hóa. Chế biến surimi chả cá + bột cá; thu mua cá tạp/cá nguyên liệu số lượng lớn từ tàu.",
    direct: true,
  },
  {
    id: "hoa-thang-surimi",
    name: "Công ty Thủy sản Hòa Thắng (surimi)",
    kind: "che_bien_xk",
    province: "Thành phố Hồ Chí Minh",
    species: ["Chả cá / surimi", "Cá tạp"],
    markets: ["Hàn", "Nhật", "EU"],
    note: "Tham khảo. Công suất surimi ~800–900 tấn/tháng. Cần xác minh tỉnh chính xác (khu vực Nam Bộ).",
  },
  {
    id: "bac-trung-nam-seafood",
    name: "Công ty CP Thủy sản Bắc Trung Nam",
    kind: "che_bien_xk",
    province: "Thành phố Hải Phòng",
    species: ["Cá biển", "Mực", "Chả cá / surimi"],
    markets: ["TQ", "Hàn", "Nhật"],
    note: "Tham khảo. Hội viên VASEP, khu vực phía Bắc. Cần xác minh địa chỉ qua danh bạ VASEP.",
  },
  {
    id: "ts-xnk-hai-phong",
    name: "Công ty CP Kinh doanh XNK Thủy sản Hải Phòng",
    kind: "che_bien_xk",
    province: "Thành phố Hải Phòng",
    species: ["Cá biển", "Mực", "Tôm", "Surimi"],
    markets: ["TQ", "Hàn", "Nhật", "EU"],
    website: "https://thuysanhp.com.vn",
    note: "Tham khảo. Hải Phòng. Kinh doanh & chế biến thủy sản XNK ở miền Bắc.",
  },

  // ───────────────────────── HỖN HỢP / KHÁC ────────────────────────────────
  {
    id: "amanda-foods",
    name: "Công ty Amanda Foods Vietnam",
    kind: "che_bien_xk",
    province: "Đồng Nai",
    species: ["Tôm", "Cá ngừ", "Mực", "Cá biển"],
    markets: ["EU", "Mỹ", "Úc"],
    website: "https://amandafoods.com.vn",
    note: "Tham khảo. Hội viên VASEP, chế biến giá trị gia tăng đa loài.",
  },
  {
    id: "highland-dragon",
    name: "Highland Dragon Enterprise",
    kind: "ca_ngu",
    province: "Thành phố Hồ Chí Minh",
    species: ["Cá ngừ", "Cá biển"],
    markets: ["EU", "Mỹ"],
    note: "Tham khảo. Tỉnh cũ: Bình Dương. Chế biến cá ngừ XK (hội viên VASEP).",
  },
  {
    id: "everwin",
    name: "Everwin Industrial Co., Ltd",
    kind: "ca_ngu",
    province: "Thành phố Hồ Chí Minh",
    species: ["Cá ngừ", "Cá biển"],
    markets: ["EU", "Mỹ", "Nhật"],
    note: "Tham khảo. Chế biến cá ngừ/hải sản XK (hội viên VASEP).",
  },
  {
    id: "cadovimex",
    name: "Công ty CP Chế biến & XNK Thủy sản Cà Mau (Cadovimex)",
    kind: "che_bien_xk",
    province: "Cà Mau",
    species: ["Tôm", "Mực", "Bạch tuộc", "Cá biển"],
    markets: ["Mỹ", "Nhật", "EU"],
    note: "Tham khảo. Cà Mau. Chế biến tôm + hải sản XK. Cần kiểm tra tình trạng hoạt động hiện tại.",
  },
  {
    id: "trang-khanh",
    name: "Công ty CP Thủy sản Trang Khanh",
    kind: "tom",
    province: "Cà Mau",
    species: ["Tôm thẻ", "Tôm sú"],
    markets: ["Mỹ", "Nhật"],
    note: "Tham khảo. Khu vực Cà Mau/ĐBSCL. Cần xác minh địa chỉ qua danh bạ VASEP.",
  },
  {
    id: "kien-giang-seafood",
    name: "Doanh nghiệp chế biến hải sản Kiên Giang (Rạch Giá/Tắc Cậu)",
    kind: "che_bien_xk",
    province: "An Giang",
    species: ["Mực", "Bạch tuộc", "Cá biển", "Tôm"],
    markets: ["TQ", "Hàn", "Nội địa"],
    note: "Tham khảo. Tỉnh cũ: Kiên Giang — cụm chế biến quanh cảng Tắc Cậu, An Thới. Nhóm chung; cần xác minh từng pháp nhân (vd. công suất, đầu mối thu mua tại cảng).",
  },
];

/** Lọc theo nhóm loài/kiểu doanh nghiệp. */
export function buyersByKind(kind: BuyerKind): SeafoodBuyer[] {
  return SEAFOOD_BUYERS.filter((b) => b.kind === kind);
}

/** Lọc theo tỉnh (tên sau sáp nhập 2025, khớp fishing-ports.ts). */
export function buyersByProvince(province: string): SeafoodBuyer[] {
  return SEAFOOD_BUYERS.filter((b) => b.province === province);
}

/** Tìm doanh nghiệp có thu mua một loài (so khớp gần đúng theo chuỗi). */
export function buyersForSpecies(keyword: string): SeafoodBuyer[] {
  const k = keyword.toLowerCase();
  return SEAFOOD_BUYERS.filter((b) =>
    b.species.some((s) => s.toLowerCase().includes(k)),
  );
}
